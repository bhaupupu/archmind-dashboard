import { Octokit } from '@octokit/rest';
import pLimit from 'p-limit';
import { Graph } from './graph';
import prisma from './db';

const repoNodeId = (r: string) => `repo:${r}`;

// Caps concurrent GitHub API calls so a large org doesn't blow through GitHub's
// secondary rate limits or hold the serverless function open indefinitely.
const CONCURRENCY = 5;
const MAX_RETRIES = 3;

async function getPackageJsonWithBackoff(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<any | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path: 'package.json' });
      if (!Array.isArray(data) && data.type === 'file' && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return JSON.parse(content);
      }
      return null;
    } catch (err: any) {
      const status = err?.status;
      if (status === 404) return null; // genuinely no package.json — not an error
      if ((status === 403 || status === 429) && attempt < MAX_RETRIES) {
        const retryAfter = Number(err?.response?.headers?.['retry-after']);
        const resetAt = Number(err?.response?.headers?.['x-ratelimit-reset']);
        const waitMs = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : Number.isFinite(resetAt)
          ? Math.max(0, resetAt * 1000 - Date.now())
          : 2 ** attempt * 1000;
        console.warn(`[github-graph] rate-limited fetching ${owner}/${repo} package.json, retrying in ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, Math.min(waitMs, 30_000)));
        continue;
      }
      console.error(`[github-graph] failed to fetch ${owner}/${repo} package.json (status ${status ?? 'unknown'})`, err);
      return null;
    }
  }
  return null;
}

export async function buildGitHubGraph(token: string, tenantId: string) {
  const octokit = new Octokit({ auth: token });

  // 1. Fetch repositories the user has selected from the DB
  const repos = await prisma.repository.findMany({ where: { userId: tenantId } });
  const graph = new Graph();
  const publisherOf = new Map<string, string>(); // packageName -> repoId
  const repoManifests = new Map<string, any>();
  const repoNames: string[] = [];

  for (const repo of repos) {
    graph.addNode({
      id: repoNodeId(repo.name),
      type: 'Repo',
      name: repo.name,
      tenantId,
      repoIds: [repo.name],
      props: { fullName: repo.fullName, url: `https://github.com/${repo.fullName}` }
    });
    repoNames.push(repo.name);
  }

  // Pass 1: fetch package.json for every repo concurrently (bounded), and discover published packages
  const limit = pLimit(CONCURRENCY);
  const manifestResults = await Promise.all(
    repos.map((repo) => limit(async () => ({ repo, pkg: await getPackageJsonWithBackoff(octokit, repo.owner, repo.name) })))
  );
  for (const { repo, pkg } of manifestResults) {
    if (!pkg) continue;
    repoManifests.set(repo.name, pkg);
    if (pkg.name) {
      publisherOf.set(pkg.name, repo.name);
    }
  }

  // Pass 2: Map dependencies to edges
  let crossRepoEdges = 0;
  for (const repo of repos) {
    const pkg = repoManifests.get(repo.name);
    if (!pkg) continue;

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    for (const depName of Object.keys(allDeps)) {
      const publisherRepoId = publisherOf.get(depName);
      if (publisherRepoId && publisherRepoId !== repo.name) {
        // Cross-repo dependency!
        graph.addEdge({
          srcId: repoNodeId(repo.name),
          dstId: repoNodeId(publisherRepoId),
          type: 'DEPENDS_ON',
          mechanism: 'npm-manifest',
          confidence: 0.95,
          evidence: [],
          firstSeenCommit: 'latest',
          lastSeenCommit: 'latest',
          repoIds: [repo.name, publisherRepoId],
        });
        crossRepoEdges++;
      }
    }
  }

  return { graph, repos: repoNames, crossRepoEdges };
}

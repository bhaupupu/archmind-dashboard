import { Octokit } from '@octokit/rest';
import { Graph } from '../../../../packages/graph-core/src/index';

const repoNodeId = (r: string) => `repo:${r}`;

export async function buildGitHubGraph(token: string, tenantId: string) {
  const octokit = new Octokit({ auth: token });
  
  // 1. Fetch repositories the user has access to
  const reposResponse = await octokit.rest.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 30
  });
  
  const repos = reposResponse.data;
  const graph = new Graph();
  const publisherOf = new Map<string, string>(); // packageName -> repoId
  const repoManifests = new Map<string, any>();
  const repoNames: string[] = [];

  // Pass 1: Add nodes and discover published packages
  for (const repo of repos) {
    graph.addNode({ 
      id: repoNodeId(repo.name), 
      type: 'Repo', 
      name: repo.name, 
      tenantId, 
      repoIds: [repo.name],
      props: { fullName: repo.full_name, url: repo.html_url }
    });
    repoNames.push(repo.name);
    
    // Try to fetch package.json
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: repo.owner.login,
        repo: repo.name,
        path: 'package.json',
      });
      
      if (!Array.isArray(data) && data.type === 'file' && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        const pkg = JSON.parse(content);
        repoManifests.set(repo.name, pkg);
        
        if (pkg.name) {
          publisherOf.set(pkg.name, repo.name);
        }
      }
    } catch (err) {
      // No package.json found or other error, skip
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

import { ingestRepo } from '../../indexer-spike/src/pipeline.ts';
import { extractManifests } from '../../indexer-spike/src/extractors/dependencies.ts';
import { BagOfWordsEmbedder } from '../../indexer-spike/src/embedder.ts';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import * as crypto from 'node:crypto';
import type { RepoFinding, RepoChangePlan } from '../../../packages/shared-types/src/index.ts';
import { generatePR } from '../../indexer-spike/src/agents/pr.ts';
import { makeLLMClient } from '../../../packages/agent-core/src/llm.ts';
import { GitHubProvider, type GitHubProviderConfig } from '../../../packages/scm-github/src/index.ts';
import { loadConfig } from '../../../packages/config/src/index.ts';

/**
 * Mocks cloning a repository to an ephemeral disk.
 * In a real implementation, this would use `@atlas/scm-provider` to perform a git clone.
 */
export async function cloneRepository(repoId: string, cloneUrl: string, commitSha: string): Promise<string> {
  // For the spike/mock, we assume the repo is already on disk in the org directory
  // or we'd clone it to /tmp. We'll just return a mock path or the workspace path.
  console.log(`[Activity] Cloned ${repoId} at ${commitSha} from ${cloneUrl}`);
  return join(process.cwd(), '..', '..', 'orgs', 'sample-org', repoId);
}

/**
 * Wraps the spike ingestion logic to chunk and embed a local repository.
 */
export async function indexRepository(repoPath: string, repoId: string, commit: string): Promise<number> {
  console.log(`[Activity] Indexing ${repoId} at ${repoPath}`);
  const embedder = new BagOfWordsEmbedder();
  const summary = await ingestRepo(repoPath, { repoId, commit, embedder });
  console.log(`[Activity] Indexed ${repoId} - ${summary.chunks} chunks written`);
  return summary.chunks;
}

/**
 * Extracts all coupling edges (dependencies, apis, env, datastore) to emit Neo4j edges.
 * To resolve write amplification, it writes them to an intermediate blob store instead of Neo4j directly.
 */
export async function extractGraphEdges(repoPath: string, repoId: string): Promise<number> {
  console.log(`[Activity] Extracting graph edges for ${repoId}`);
  
  // Here we would run all extractors: buildApiGraph, buildEnvGraph, etc.
  // For the spike, we'll just mock extracting dependencies and saving to a file.
  const manifests = extractManifests(repoPath, repoId);
  let edgeCount = 0;
  for (const manifest of manifests) {
    edgeCount += manifest.deps.length;
  }
  
  // Simulate writing to blob store
  const outDir = join(process.cwd(), '.atlas', repoId);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'edges.json'), JSON.stringify({ repoId, edgeCount }));
  
  console.log(`[Activity] Extracted ${edgeCount} edges for ${repoId}`);
  return edgeCount;
}

/**
 * Batched Neo4j Persist activity
 * Reads intermediate blobs and simulates a bulk UNWIND write to Neo4j.
 */
export async function batchPersistGraph(repoIds: string[]): Promise<void> {
  console.log(`[Activity] Batch persisting graph edges for ${repoIds.length} repositories to Neo4j (UNWIND)`);
  let totalEdges = 0;
  for (const repoId of repoIds) {
    const edgeFile = join(process.cwd(), '.atlas', repoId, 'edges.json');
    if (existsSync(edgeFile)) {
      const data = JSON.parse(readFileSync(edgeFile, 'utf8'));
      totalEdges += data.edgeCount;
    }
  }
  console.log(`[Activity] Successfully persisted ${totalEdges} total graph edges.`);
}

/**
 * Cleans up the ephemeral disk after indexing.
 */
export async function cleanupEphemeralDisk(repoPath: string): Promise<void> {
  console.log(`[Activity] Cleaning up ephemeral disk: ${repoPath}`);
  // In a real environment, we'd `rm -rf repoPath`. 
  // We mock it here to avoid deleting our sample-org fixture.
  // await rm(repoPath, { recursive: true, force: true });
}

/**
 * Autonomously creates a PR based on a finding and plan.
 */
export async function autonomousPullRequest(
  prompt: string,
  repoId: string,
  finding: RepoFinding,
  plan: RepoChangePlan
): Promise<string> {
  console.log(`[Activity] Generating Autonomous PR for ${repoId}`);
  const client = makeLLMClient();
  
  // Collect file contents
  const fileContents = finding.evidence
    .filter(e => e.kind === 'file')
    .map((e: any) => {
      // Find the file locally for the spike
      const repoPath = join(process.cwd(), '..', '..', 'orgs', 'sample-org', repoId);
      const filePath = join(repoPath, e.path);
      return {
        path: e.path,
        content: existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
      };
    }).filter((f: any) => f.content !== '');
    
  const prDraft = await generatePR(client, prompt, finding, plan, fileContents);
  
  const cfg = loadConfig();
  if (cfg.github?.appId) {
    const provider = new GitHubProvider(cfg.github as GitHubProviderConfig);
    // Hardcoded installation ID for spike, in a real app this would be passed in or looked up
    const token = await provider.mintInstallationToken('1', [repoId]);
    
    // We append a timestamp to the branch name
    const branchName = `atlas/auto-pr-${Date.now()}`;
    
    const prResult = await provider.openPullRequest(token, {
      repoId,
      title: prDraft.prTitle,
      body: prDraft.prBody,
      headBranch: branchName,
      baseBranch: 'main', // Assuming main
      changes: prDraft.changes.map(c => ({
        ...c,
        contentHash: crypto.createHash('sha256').update(c.content).digest('hex')
      })),
      reviewedDiffHash: 'auto-generated'
    });
    
    console.log(`[Activity] Opened PR for ${repoId} at ${prResult.url}`);
    return prResult.url;
  } else {
    console.log(`[Activity] GitHub not configured, skipping PR creation. Generated draft: ${prDraft.prTitle}`);
    return 'mock-pr-url';
  }
}

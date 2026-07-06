import { proxyActivities, executeChild } from '@temporalio/workflow';
import type * as activities from './activities.ts';

const {
  cloneRepository,
  indexRepository,
  extractGraphEdges,
  batchPersistGraph,
  cleanupEphemeralDisk,
  autonomousPullRequest,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 hour',
});

export interface IncrementalIndexArgs {
  repoId: string;
  cloneUrl: string;
  commitSha: string;
}

export interface FullIndexOrgArgs {
  orgId: string;
  installationId: string;
  repositories: IncrementalIndexArgs[];
}

/**
 * Child workflow that indexes a single repository durably.
 * Follows the PROJECT_HANDOFF specs.
 */
export async function incrementalIndexRepo(args: IncrementalIndexArgs): Promise<void> {
  const { repoId, cloneUrl, commitSha } = args;
  
  let repoPath = '';
  try {
    // 1. Activity: cloneRepository
    repoPath = await cloneRepository(repoId, cloneUrl, commitSha);
    
    // 2. Activity: indexRepository
    await indexRepository(repoPath, repoId, commitSha);
    
    // 3. Activity: extractGraphEdges (simulates edge blob generation)
    await extractGraphEdges(repoPath, repoId);
    
    // For incremental indexing of a SINGLE repo, we can batchPersist it right away.
    // However, when called from fullIndexOrg, we batch at the end.
    // For simplicity of this spike, incrementalIndexRepo just extracts edges.
    
  } finally {
    // 4. Activity: cleanupEphemeralDisk (always runs via defer/finally)
    if (repoPath) {
      await cleanupEphemeralDisk(repoPath);
    }
  }
}

/**
 * Parent workflow that orchestrates the ingestion of an entire org.
 * Spawns child workflows for each repository in parallel with bounded concurrency.
 */
export async function fullIndexOrg(args: FullIndexOrgArgs): Promise<void> {
  const { orgId, repositories } = args;
  
  const MAX_CONCURRENCY = 5;
  const active = new Set<Promise<void>>();
  const errors: Error[] = [];
  
  for (const repo of repositories) {
    if (active.size >= MAX_CONCURRENCY) {
      await Promise.race(active);
    }
    
    const p: Promise<void> = executeChild(incrementalIndexRepo, {
      args: [repo],
      workflowId: `index-${orgId}-${repo.repoId}-${repo.commitSha}`,
    }).catch(e => {
      errors.push(e);
    }).finally(() => {
      active.delete(p);
    });
    
    active.add(p);
  }
  
  await Promise.all(active);
  if (errors.length > 0) {
    throw new Error(`Failed to index ${errors.length} repositories.`);
  }

  // 2. Batched graph persistence: once all repos are indexed and their edges extracted
  // to blob storage, we dispatch a single UNWIND batch persist to Neo4j.
  const repoIds = repositories.map(r => r.repoId);
  await batchPersistGraph(repoIds);
}
import type { RepoFinding, RepoChangePlan } from '../../../packages/shared-types/src/index.ts';

export interface AutonomousChangeArgs {
  prompt: string;
  repoId: string;
  finding: RepoFinding;
  plan: RepoChangePlan;
}

/**
 * Autonomous workflow that enacts a RepoChangePlan by spinning up a CodeGen
 * agent and opening a Pull Request via GitHubProvider.
 */
export async function autonomousChangeWorkflow(args: AutonomousChangeArgs): Promise<string> {
  const { prompt, repoId, finding, plan } = args;
  
  // 1. Activity: autonomousPullRequest
  const prUrl = await autonomousPullRequest(prompt, repoId, finding, plan);
  
  return prUrl;
}

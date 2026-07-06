/**
 * Agent orchestrator (docs/05 orchestrator-worker). Replaces the deterministic
 * scope/expand in analyze.ts with real agent stages:
 *   Scope (Opus) → per-repo Analysis (Sonnet, parallel, ISOLATED contexts) →
 *   evidence verification → graph expansion → ImpactReport.
 * With no ANTHROPIC_API_KEY the MockLLMClient makes every stage deterministic,
 * so the whole pipeline still runs and is testable offline.
 */
import { join } from 'node:path';
import { ingestRepo } from '../pipeline.ts';
import { BagOfWordsEmbedder } from '../embedder.ts';
import { RetrievalIndex, type Scored } from '../retrieval.ts';
import { QdrantRetrievalIndex } from '../qdrant.ts';
import { loadConfig } from '../../../../packages/config/src/index.ts';
import { buildOrgGraph, repoNodeId } from '../org.ts';
import { buildFullGraph, computeImpactTransitive } from '../fullgraph.ts';
import { runScope, type RepoCard } from './scope.ts';
import { runAnalysis, toEvidence } from './analysis.ts';
import { runPlanning } from './planning.ts';
import { runSynthesis } from './synthesis.ts';
import { generatePR } from './pr.ts';
import { verifyEvidence } from './guards.ts';
import { makeLLMClient, type LLMClient } from '../../../../packages/agent-core/src/llm.ts';
import type { AnalyzeEvent } from '../analyze.ts';
import type { ImpactReport, RepoFinding, Evidence } from '../../../../packages/shared-types/src/index.ts';

export interface AgentAnalyzeOptions { client?: LLMClient; onEvent?: (e: AnalyzeEvent) => void }
export interface AgentAnalyzeResult { report: ImpactReport; graph: { nodes: number; edges: number }; llmSource: string }

export async function runAgentAnalysis(
  orgDir: string,
  prompt: string,
  opts: AgentAnalyzeOptions = {},
): Promise<AgentAnalyzeResult> {
  const client = opts.client ?? makeLLMClient();
  const emit = (stage: string, message: string, data?: unknown) => opts.onEvent?.({ stage, message, data });
  const embedder = new BagOfWordsEmbedder();

  emit('started', `Agent analysis (${client.kind}): "${prompt}"`);
  const { graph, repos } = buildFullGraph(orgDir);

  // Retrieve pre-indexed data.
  // In production, this queries Postgres + Qdrant. For the spike, we load local stores.
  const dirs: string[] = [];
  for (const repoId of repos) {
    dirs.push(join(orgDir, repoId, '.atlas', repoId));
  }
  const cfg = loadConfig();
  let index: RetrievalIndex | QdrantRetrievalIndex;
  if (cfg.qdrant?.url) {
    index = new QdrantRetrievalIndex(cfg.qdrant.url, orgDir);
  } else {
    index = RetrievalIndex.load(dirs);
  }
  const hits = await index.search(prompt, embedder, 100, client);

  // Context assembly under token budget (assume 1 token ~= 4 chars).
  // We budget ~25,000 tokens per repo to leave room for the agent instructions.
  const BUDGET_CHARS = 25000 * 4;
  const topByRepo = new Map<string, Scored[]>();
  const bytesByRepo = new Map<string, number>();

  for (const h of hits) {
    const arr = topByRepo.get(h.chunk.repoId) ?? [];
    let curBytes = bytesByRepo.get(h.chunk.repoId) ?? 0;
    
    if (curBytes + h.chunk.text.length < BUDGET_CHARS) {
      arr.push(h);
      curBytes += h.chunk.text.length;
      topByRepo.set(h.chunk.repoId, arr);
      bytesByRepo.set(h.chunk.repoId, curBytes);
    }
  }
  const validPathsByRepo = new Map<string, Set<string>>();
  if (index instanceof RetrievalIndex) {
    for (const c of index.chunks) {
      const set = validPathsByRepo.get(c.repoId) ?? new Set<string>();
      set.add(c.path); validPathsByRepo.set(c.repoId, set);
    }
  } else {
    // For Qdrant we don't load all chunks in memory, so we assume paths from hits are valid.
    // Or we skip verification. For the spike we just allow paths seen in hits.
    for (const h of hits) {
      const set = validPathsByRepo.get(h.chunk.repoId) ?? new Set<string>();
      set.add(h.chunk.path); validPathsByRepo.set(h.chunk.repoId, set);
    }
  }

  // Scope stage.
  const cards: RepoCard[] = repos.map((r) => ({
    repoId: r,
    topPaths: [...(validPathsByRepo.get(r) ?? [])],
    dependencies: graph.outgoing(repoNodeId(r), 'DEPENDS_ON').map((e) => e.dstId.replace('repo:', '')),
    dependents: graph.dependents(repoNodeId(r)).map((n) => n.name),
  }));
  const seeds = [...new Set(hits.map((h) => h.chunk.repoId))];
  const scope = await runScope(client, prompt, cards, seeds);
  const candidates = scope.candidates.map((c) => c.repoId);
  emit('scope', `Scoped to ${candidates.length} candidate repo(s): ${candidates.join(', ')}`, { candidates });

  // Per-repo Analysis — parallel, isolated contexts.
  emit('analysis', `Analyzing ${candidates.length} candidate repo(s) in isolation`);
  const findings: RepoFinding[] = [];
  const analyzed = await Promise.all(candidates.map(async (repoId) => {
    const chunks = topByRepo.get(repoId) ?? [];
    const a = await runAnalysis(client, prompt, repoId, chunks);
    const raw: RepoFinding = {
      repoId, repoFullName: repoId, disposition: a.disposition,
      rationale: a.rationale, evidence: toEvidence(a, repoId), confidence: a.confidence,
    };
    const { finding, removed } = verifyEvidence(raw, validPathsByRepo.get(repoId) ?? new Set());
    if (removed) emit('guard', `Dropped ${removed} unverifiable citation(s) from ${repoId}`, { repoId, removed });
    return finding;
  }));
  for (const f of analyzed) {
    if (f.disposition === 'no_change') continue;
    findings.push(f);
    emit('finding', `${f.disposition}: ${f.repoId}`, { repoId: f.repoId, disposition: f.disposition });
  }

  // Graph expansion — true blast radius via computeImpactTransitive.
  // (The Synthesis stage that emits the 'synthesis' event runs after planning/PR.)
  const covered = new Set(findings.map((f) => f.repoId));
  for (const seed of [...covered]) {
    const ti = computeImpactTransitive(graph, seed, 5);
    for (const depName of ti.impacted) {
      if (covered.has(depName)) continue;
      
      const parent = ti.causalPaths[depName];
      const graphEv: Evidence = {
        kind: 'graph', edgeId: `multi-hop`, // We use a generic ID for multi-hop
        edgeType: 'DEPENDS_ON', confidence: 0.85,
      };
      findings.push({
        repoId: depName, repoFullName: depName, disposition: 'may_change',
        rationale: `Pulled into blast radius via ${parent} (transitive coupling); review for downstream impact.`,
        evidence: [graphEv], confidence: 0.85,
      });
      covered.add(depName);
      emit('finding', `may_change: ${depName} (via ${parent})`, { repoId: depName, disposition: 'may_change' });
    }
  }

  // Planning stage — a per-repo change plan for every affected repo (Advisory
  // mode ends here; Autonomous mode would continue to CodeGen → Review → PR).
  emit('planning', `Planning changes for ${findings.length} repo(s)`);
  const plans = await Promise.all(findings.map((f) => runPlanning(client, prompt, f)));

  // PR Generation stage (Advisory Mode)
  emit('pr_gen', `Generating suggested diffs and PR descriptions for ${findings.length} repo(s)`);
  const prs = await Promise.all(findings.map(async (f) => {
    const plan = plans.find(p => p.repoId === f.repoId)!;
    const draft = await generatePR(client, prompt, f, plan);
    return { repoId: f.repoId, title: draft.prTitle, body: draft.prBody, diff: JSON.stringify(draft.changes) };
  }));

  // Synthesis stage — cross-repo verdict and executive summary
  emit('synthesis', `Synthesizing global impact across ${findings.length} repo(s)`);
  const synthesis = await runSynthesis(client, prompt, findings);

  const s = graph.stats();
  const report: ImpactReport = {
    analysisId: `agent-${repos.length}repo-${covered.size}affected`,
    prompt,
    globalVerdict: synthesis.globalVerdict,
    executiveSummary: synthesis.executiveSummary,
    affectedRepos: findings, plans, prs, createdAt: new Date().toISOString(),
  };
  emit('complete', `Analysis complete: ${findings.length} affected repos, ${plans.length} plans, verdict: ${synthesis.globalVerdict}`, { affected: findings.length, plans: plans.length, globalVerdict: synthesis.globalVerdict });
  return { report, graph: { nodes: s.nodes, edges: s.edges }, llmSource: client.kind };
}

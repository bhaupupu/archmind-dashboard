/**
 * Impact analysis (deterministic Phase-0 stand-in for the agent pipeline, docs/05).
 * Ties the two capabilities together to produce the product's core artifact — an
 * evidence-linked ImpactReport:
 *   1. index every repo in the org (ingestion),
 *   2. retrieve query-relevant chunks across the org (lexical + semantic + RRF),
 *   3. SCOPE: seed repos = repos that directly match → `must_change` (file evidence),
 *   4. EXPAND: graph dependents of seeds → `may_change` (graph evidence).
 *
 * In production steps 3–4 are LLM agents (Scope, Analysis, Synthesis) with far
 * richer reasoning; this deterministic version proves the data flow and that
 * every finding is backed by verifiable evidence. Planning (step 5) is a separate
 * agent stage and is intentionally left empty here. `onEvent` streams stage
 * progress so the API can surface it over SSE (docs/01 streaming).
 */
import { join } from 'node:path';
import { ingestRepo } from './pipeline.ts';
import { BagOfWordsEmbedder } from './embedder.ts';
import { RetrievalIndex, type Scored } from './retrieval.ts';
import { QdrantRetrievalIndex } from './qdrant.ts';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { buildOrgGraph, repoNodeId } from './org.ts';
import type { ImpactReport, RepoFinding, Evidence } from '../../../packages/shared-types/src/index.ts';

export interface AnalyzeEvent { stage: string; message: string; data?: unknown }
export interface AnalyzeOptions { onEvent?: (e: AnalyzeEvent) => void }

export interface AnalyzeResult {
  report: ImpactReport;
  graph: { nodes: number; edges: number };
}

export async function runImpactAnalysis(
  orgDir: string,
  prompt: string,
  opts: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const emit = (stage: string, message: string, data?: unknown) => opts.onEvent?.({ stage, message, data });
  const embedder = new BagOfWordsEmbedder();

  emit('started', `Analyzing: "${prompt}"`);
  const { graph, repos } = buildOrgGraph(orgDir);
  emit('scope', `Scoped org: ${repos.length} repos, ${graph.stats().edges} edges`, { repos });

  // 1. In production, this queries Postgres + Qdrant. For the spike, we load local stores.
  const atlasDirs: string[] = [];
  for (const repoId of repos) {
    atlasDirs.push(join(orgDir, repoId, '.atlas', repoId));
  }

  // 2. Retrieve across the whole org.
  const cfg = loadConfig();
  let index: RetrievalIndex | QdrantRetrievalIndex;
  if (cfg.qdrant?.url) {
    index = new QdrantRetrievalIndex(cfg.qdrant.url, orgDir);
  } else {
    index = RetrievalIndex.load(atlasDirs);
  }
  const hits = await index.search(prompt, embedder, 12);
  emit('retrieval', `Retrieved ${hits.length} relevant chunks`, { hits: hits.length });

  // 3. Scope — seed repos and their top evidence.
  const topByRepo = new Map<string, Scored[]>();
  for (const h of hits) {
    const arr = topByRepo.get(h.chunk.repoId) ?? [];
    if (arr.length < 3) arr.push(h);
    topByRepo.set(h.chunk.repoId, arr);
  }

  const findings: RepoFinding[] = [];
  const covered = new Set<string>();

  for (const repoId of topByRepo.keys()) {
    const ev: Evidence[] = (topByRepo.get(repoId) ?? []).map((h) => ({
      kind: 'file', repo: repoId, path: h.chunk.path,
      startLine: h.chunk.startLine, endLine: h.chunk.endLine,
      quote: h.chunk.symbol ?? undefined,
    }));
    findings.push({
      repoId, repoFullName: repoId, disposition: 'must_change',
      rationale: `Directly matches the request; retrieval found relevant code in ${ev.length} location(s).`,
      evidence: ev, confidence: 0.7,
    });
    covered.add(repoId);
    emit('finding', `must_change: ${repoId}`, { repoId, disposition: 'must_change' });
  }

  // 4. Expand — dependents of seed repos become may_change via graph evidence.
  for (const seed of [...covered]) {
    for (const dep of graph.dependents(repoNodeId(seed))) {
      if (covered.has(dep.name)) continue;
      const edge = graph.incoming(repoNodeId(seed), 'DEPENDS_ON').find((e) => e.srcId === dep.id);
      const graphEv: Evidence = {
        kind: 'graph', edgeId: `${dep.id}->${repoNodeId(seed)}`,
        edgeType: 'DEPENDS_ON', confidence: edge?.confidence ?? 0.9,
      };
      const fileEv: Evidence[] = (topByRepo.get(dep.name) ?? []).slice(0, 1).map((h) => ({
        kind: 'file', repo: dep.name, path: h.chunk.path, startLine: h.chunk.startLine, endLine: h.chunk.endLine,
      }));
      findings.push({
        repoId: dep.name, repoFullName: dep.name, disposition: 'may_change',
        rationale: `Depends on ${seed} (cross-repo DEPENDS_ON) which must change; review for downstream impact.`,
        evidence: [graphEv, ...fileEv], confidence: edge?.confidence ?? 0.9,
      });
      covered.add(dep.name);
      emit('finding', `may_change: ${dep.name} (via ${seed})`, { repoId: dep.name, disposition: 'may_change' });
    }
  }

  const report: ImpactReport = {
    analysisId: `local-${repos.length}repo-${covered.size}affected`,
    prompt,
    affectedRepos: findings,
    plans: [], // Planning agent stage (docs/05) — not implemented in Phase 0
    createdAt: new Date().toISOString(),
  };
  const s = graph.stats();
  emit('complete', `Analysis complete: ${findings.length} affected repos`, { affected: findings.length });
  return { report, graph: { nodes: s.nodes, edges: s.edges } };
}

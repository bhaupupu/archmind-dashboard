/**
 * @atlas/shared-types — the contracts that cross service boundaries.
 *
 * These mirror the canonical decisions in docs/02, docs/03, docs/05, docs/06.
 * Kept dependency-free (plain TS types + light runtime guards) so every service
 * — Node, and eventually the Rust indexer via a generated equivalent — agrees
 * on the same shapes. When we adopt a schema library (zod) these become the
 * single source; for now the guards below are enough for the Phase-0 spike.
 */

// ---------------------------------------------------------------------------
// Languages (Phase 1 launch subset is ts/js/python; full set is the 10 in docs/04)
// ---------------------------------------------------------------------------

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'csharp'
  | 'cpp'
  | 'php'
  | 'ruby'
  | 'markdown'
  | 'yaml'
  | 'json'
  | 'unknown';

/** Languages Atlas indexes at Phase 1 launch (docs/09). */
export const PHASE_1_LANGUAGES: readonly Language[] = ['typescript', 'javascript', 'python'];

/** Languages Atlas indexes at Phase 2 (Multi-Language Support). */
export const PHASE_2_LANGUAGES: readonly Language[] = [
  ...PHASE_1_LANGUAGES,
  'java', 'go', 'rust', 'csharp', 'cpp', 'php', 'ruby'
];

// ---------------------------------------------------------------------------
// Chunks (docs/02 §chunking, docs/06 chunks table)
// ---------------------------------------------------------------------------

export type ChunkKind = 'function' | 'class' | 'method' | 'block' | 'doc' | 'config' | 'spec';

export interface CodeChunk {
  /** content-addressed id = sha256(normalized redacted content); see content-address.ts */
  id: string;
  repoId: string;
  commit: string;
  path: string;
  language: Language;
  kind: ChunkKind;
  /** symbol name when the chunk is a function/class/method, else null */
  symbol: string | null;
  startLine: number;
  endLine: number;
  /** POST-redaction content only — secrets are removed before this exists (docs/04 §3.5) */
  redactedContent: string;
  /** number of secret spans redacted from this chunk (0 in the common case) */
  redactedSpanCount: number;
}

// ---------------------------------------------------------------------------
// Embeddings (docs/02: voyage-code-3, 1024-dim int8 in prod)
// ---------------------------------------------------------------------------

export interface EmbeddedChunk extends CodeChunk {
  embedding: number[];
  embeddingModel: string;
  embeddingDim: number;
}

// ---------------------------------------------------------------------------
// Evidence + findings (docs/05 §evidence discipline — every claim is cited)
// ---------------------------------------------------------------------------

export interface FileEvidence {
  kind: 'file';
  repo: string;
  path: string;
  startLine: number;
  endLine: number;
  /** verbatim quote, checked to exist at repo@commit before emission */
  quote?: string;
}

export interface GraphEvidence {
  kind: 'graph';
  edgeId: string;
  edgeType: EdgeType;
  confidence: number;
}

export type Evidence = FileEvidence | GraphEvidence;

export type ChangeDisposition = 'must_change' | 'may_change' | 'no_change';

export interface RepoFinding {
  repoId: string;
  repoFullName: string;
  disposition: ChangeDisposition;
  /** why this repo is affected — one sentence, must be backed by evidence[] */
  rationale: string;
  evidence: Evidence[];
  /** 0..1 calibrated confidence surfaced in the UI */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Change plans (docs/05 §Planning — the five required fields)
// ---------------------------------------------------------------------------

export interface RepoChangePlan {
  repoId: string;
  requiredChanges: string[];
  technicalApproach: string;
  sideEffects: string[];
  testingRequirements: string[];
  migrationRequirements: string[];
}

// ---------------------------------------------------------------------------
// Impact report (docs/05 §Synthesis)
// ---------------------------------------------------------------------------

export interface ImpactReport {
  analysisId: string;
  prompt: string;
  globalVerdict?: 'feasible' | 'blocked' | 'needs_clarification';
  executiveSummary?: string;
  affectedRepos: RepoFinding[];
  plans: RepoChangePlan[];
  prs?: { repoId: string; title: string; body: string; diff: string }[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Graph taxonomy (docs/03 — kept in sync with the Neo4j schema)
// ---------------------------------------------------------------------------

export type NodeType =
  | 'Org' | 'Repo' | 'Service' | 'Deployable' | 'Package' | 'APIEndpoint'
  | 'MessageTopic' | 'DataStore' | 'Table' | 'EnvVar' | 'ConfigKey'
  | 'Team' | 'Person' | 'Domain';

export type EdgeType =
  | 'DEPENDS_ON' | 'CALLS' | 'EXPOSES' | 'CONSUMES' | 'PUBLISHES' | 'SUBSCRIBES'
  | 'READS' | 'WRITES' | 'OWNS' | 'DEPLOYS' | 'REFERENCES_ENV' | 'SHARES_SCHEMA' | 'USES_SYMBOL';

export const NODE_TYPES: readonly NodeType[] = [
  'Org', 'Repo', 'Service', 'Deployable', 'Package', 'APIEndpoint',
  'MessageTopic', 'DataStore', 'Table', 'EnvVar', 'ConfigKey', 'Team', 'Person', 'Domain',
];

export const EDGE_TYPES: readonly EdgeType[] = [
  'DEPENDS_ON', 'CALLS', 'EXPOSES', 'CONSUMES', 'PUBLISHES', 'SUBSCRIBES',
  'READS', 'WRITES', 'OWNS', 'DEPLOYS', 'REFERENCES_ENV', 'SHARES_SCHEMA',
  'USES_SYMBOL',
];

/** Universal edge envelope — every derived edge carries this (docs/03 §2.3). */
export interface GraphEdge {
  srcId: string;
  dstId: string;
  type: EdgeType;
  mechanism: string;
  /** deterministic extractors >= 0.7; LLM soft edges capped at 0.6 (docs/03) */
  confidence: number;
  evidence: FileEvidence[];
  firstSeenCommit: string;
  lastSeenCommit: string;
  /** repos whose assertions justify this edge — powers permission-scoped serving (docs/03 §6.4) */
  repoIds: string[];
}

// ---------------------------------------------------------------------------
// Light runtime guards (until zod is adopted)
// ---------------------------------------------------------------------------

export function isValidConfidence(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1;
}

/** A soft (LLM-extracted) edge may not exceed 0.6 confidence (docs/03 §4.3). */
export function assertSoftEdgeConfidence(mechanism: string, confidence: number): void {
  if (mechanism.startsWith('llm:') && confidence > 0.6) {
    throw new Error(`soft edge ${mechanism} confidence ${confidence} exceeds 0.6 cap`);
  }
}

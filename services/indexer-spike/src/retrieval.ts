/**
 * Retrieval (docs/02). Phase-0 stand-ins for two of the four primitives:
 *   - lexical  : term-frequency match over redacted blob text (prod: Zoekt trigram)
 *   - semantic : cosine over chunk embeddings (prod: Qdrant + voyage-code-3)
 * fused with reciprocal-rank fusion (k=60), exactly as docs/02 §5.2 specifies.
 * The graph and SCIP primitives live in graph-core / SCIP (not fused here yet).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Embedder } from './embedder.ts';
import type { LLMClient } from '../../../packages/agent-core/src/llm.ts';

export interface LoadedChunk {
  id: string;
  repoId: string;
  path: string;
  symbol: string | null;
  startLine: number;
  endLine: number;
  language: string;
  text: string;
  embedding: number[];
}

export interface Scored { chunk: LoadedChunk; score: number }

const RRF_K = 60;

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot; // vectors are L2-normalized at index time
}

function tokenize(q: string): string[] {
  return q.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
}

export interface IntentClassification {
  intent: string;
  weights: { lexical: number; semantic: number };
}

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['impact_analysis', 'symbol_lookup', 'concept_search', 'freeform'] },
    weights: {
      type: 'object',
      properties: {
        lexical: { type: 'number' },
        semantic: { type: 'number' },
      },
      required: ['lexical', 'semantic'],
    },
  },
  required: ['intent', 'weights'],
};

export async function classifyIntent(client: LLMClient, query: string): Promise<IntentClassification> {
  const { value } = await client.structured<IntentClassification>({
    tier: 'haiku',
    system: 'You are the intent classification agent for a code retrieval pipeline. Classify the user query and assign weights (summing to 1.0) to lexical vs semantic search primitives. Use high lexical weights for specific symbols/paths, and high semantic weights for conceptual questions.',
    user: `Query: "${query}"`,
    toolName: 'classify_intent',
    schema: INTENT_SCHEMA,
    fallback: () => {
      // Deterministic fallback for tests: if query contains camelCase or paths, lean lexical.
      if (/[a-z][A-Z]/.test(query) || query.includes('/')) return { intent: 'symbol_lookup', weights: { lexical: 0.8, semantic: 0.2 } };
      return { intent: 'concept_search', weights: { lexical: 0.5, semantic: 0.5 } };
    },
  });
  return value;
}

export class RetrievalIndex {
  readonly chunks: LoadedChunk[];
  constructor(chunks: LoadedChunk[]) { this.chunks = chunks; }

  /** Load a single `.atlas/<repo>` store produced by the ingestion pipeline. */
  static loadStore(atlasRepoDir: string): LoadedChunk[] {
    const metaFile = join(atlasRepoDir, 'chunks.jsonl');
    const vecFile = join(atlasRepoDir, 'vectors.jsonl');
    if (!existsSync(metaFile) || !existsSync(vecFile)) return [];
    const vectors = new Map<string, number[]>();
    for (const line of readFileSync(vecFile, 'utf8').split('\n').filter(Boolean)) {
      const v = JSON.parse(line) as { id: string; embedding: number[] };
      vectors.set(v.id, v.embedding);
    }
    const out: LoadedChunk[] = [];
    for (const line of readFileSync(metaFile, 'utf8').split('\n').filter(Boolean)) {
      const m = JSON.parse(line) as Omit<LoadedChunk, 'text' | 'embedding'>;
      const blob = join(atlasRepoDir, 'blobs', `${m.id}.txt`);
      const text = existsSync(blob) ? readFileSync(blob, 'utf8') : '';
      out.push({ ...m, text, embedding: vectors.get(m.id) ?? [] });
    }
    return out;
  }

  /** Load and merge many stores (e.g. every repo in an org). */
  static load(atlasRepoDirs: string[]): RetrievalIndex {
    return new RetrievalIndex(atlasRepoDirs.flatMap((d) => RetrievalIndex.loadStore(d)));
  }

  lexical(query: string, topK = 20): Scored[] {
    const terms = tokenize(query);
    const scored: Scored[] = [];
    for (const chunk of this.chunks) {
      const hay = chunk.text.toLowerCase();
      let score = 0;
      for (const t of terms) {
        let idx = hay.indexOf(t);
        while (idx !== -1) { score++; idx = hay.indexOf(t, idx + t.length); }
      }
      if (score > 0) scored.push({ chunk, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  semantic(queryVec: number[], topK = 20): Scored[] {
    return this.chunks
      .map((chunk) => ({ chunk, score: cosine(queryVec, chunk.embedding) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /** Reciprocal-rank fusion of lexical + semantic (docs/02 §5.2). Uses Haiku intent classification if client is provided. */
  async search(query: string, embedder: Embedder, topK = 10, client?: LLMClient): Promise<Scored[]> {
    const [qvec] = await embedder.embed([query]);
    const lex = this.lexical(query, 50);
    const sem = this.semantic(qvec!, 50);

    let weights = { lexical: 1.0, semantic: 1.0 };
    if (client) {
      const intent = await classifyIntent(client, query);
      weights = intent.weights;
    }

    const fused = new Map<string, { chunk: LoadedChunk; score: number }>();
    const fuse = (list: Scored[], weight: number) => list.forEach((s, rank) => {
      const cur = fused.get(s.chunk.id) ?? { chunk: s.chunk, score: 0 };
      cur.score += weight / (RRF_K + rank + 1);
      fused.set(s.chunk.id, cur);
    });
    
    fuse(lex, weights.lexical); 
    fuse(sem, weights.semantic);
    
    return [...fused.values()].sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

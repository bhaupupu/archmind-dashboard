/**
 * Embedding (docs/02: voyage-code-3, 1024-dim). Two implementations behind one
 * interface so the pipeline is testable offline:
 *   - MockEmbedder: deterministic hash-based vectors, no network, no key. Default.
 *   - VoyageEmbedder: real voyage-code-3 via the API when VOYAGE_API_KEY is set.
 * Production also int8-quantizes before Qdrant; the spike keeps float for clarity.
 */
import { createHash } from 'node:crypto';

export interface Embedder {
  readonly model: string;
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

/** Deterministic, dependency-free stand-in. Same text → same vector. */
export class MockEmbedder implements Embedder {
  readonly model = 'mock-hash-v1';
  readonly dim: number;
  constructor(dim = 256) { this.dim = dim; }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.vec(t));
  }

  private vec(text: string): number[] {
    const out = new Array<number>(this.dim);
    // Expand a sha256 stream to dim floats in [-1,1], then L2-normalize.
    let seed = createHash('sha256').update(text).digest();
    let idx = 0;
    for (let i = 0; i < this.dim; i++) {
      if (idx >= seed.length) { seed = createHash('sha256').update(seed).digest(); idx = 0; }
      out[i] = (seed[idx++]! / 127.5) - 1;
    }
    let norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
    for (let i = 0; i < this.dim; i++) out[i] = out[i]! / norm;
    return out;
  }
}

/**
 * Bag-of-words feature-hash embedder. A deterministic, offline stand-in whose
 * cosine similarity reflects shared identifiers/tokens — good enough to make
 * semantic search meaningful in the spike without a live model. Production uses
 * voyage-code-3 (which captures real semantics); this only exists so the
 * retrieval + fusion pipeline can be run and tested offline.
 */
export class BagOfWordsEmbedder implements Embedder {
  readonly model = 'bow-hash-v1';
  readonly dim: number;
  // Larger dim => fewer hash collisions (false semantic matches). Real models
  // don't have this failure mode; this is a stand-in limitation.
  constructor(dim = 8192) { this.dim = dim; }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.vec(t));
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // split camelCase
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2);
  }

  private hash(s: string): number {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  }

  private vec(text: string): number[] {
    const v = new Array<number>(this.dim).fill(0);
    for (const tok of this.tokenize(text)) v[this.hash(tok) % this.dim]! += 1;
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    for (let i = 0; i < this.dim; i++) v[i] = v[i]! / norm;
    return v;
  }
}

/** Real embeddings via the Voyage API. Batches of <= 128 (docs/04 batching). */
export class VoyageEmbedder implements Embedder {
  readonly model: string;
  readonly dim = 1024;
  private readonly apiKey: string;
  constructor(apiKey: string, model = process.env.VOYAGE_EMBED_MODEL ?? 'voyage-code-3') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 128) {
      const batch = texts.slice(i, i + 128);
      const res = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, input: batch, input_type: 'document' }),
      });
      if (!res.ok) throw new Error(`Voyage API ${res.status}: ${await res.text()}`);
      const json = (await res.json()) as { data: { embedding: number[] }[] };
      for (const d of json.data) out.push(d.embedding);
    }
    return out;
  }
}

export function makeEmbedder(): Embedder {
  const key = process.env.VOYAGE_API_KEY;
  return key ? new VoyageEmbedder(key) : new MockEmbedder();
}

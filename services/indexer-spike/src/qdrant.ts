import { QdrantClient } from '@qdrant/js-client-rest';
import type { EmbeddedChunk } from '../../../packages/shared-types/src/index.ts';
import type { ChunkStore } from './store.ts';
import type { Scored, IntentClassification } from './retrieval.ts';
import type { Embedder } from './embedder.ts';
import type { LLMClient } from '../../../packages/agent-core/src/llm.ts';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const COLLECTION_NAME = 'atlas_chunks';

export function hashToUuid(hash: string): string {
  const h = hash.slice(0, 32).padStart(32, '0');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

export class QdrantChunkStore implements ChunkStore {
  private client: QdrantClient;
  private blobDir: string;
  private rootDir: string;
  private repoId: string;

  constructor(url: string, rootDir: string, repoId: string) {
    this.client = new QdrantClient({ url });
    this.rootDir = rootDir;
    this.repoId = repoId;
    this.blobDir = join(rootDir, '.atlas', repoId, 'blobs');
  }

  async initCollection(dim: number): Promise<void> {
    const res = await this.client.getCollections();
    const exists = res.collections.some(c => c.name === COLLECTION_NAME);
    if (!exists) {
      await this.client.createCollection(COLLECTION_NAME, {
        vectors: { size: dim, distance: 'Cosine' },
      });
      await this.client.createPayloadIndex(COLLECTION_NAME, { field_name: 'repoId', field_schema: 'keyword' });
    }
  }

  async upsert(chunks: EmbeddedChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    
    // Defer fs require
    const fs = await import('node:fs');
    fs.mkdirSync(this.blobDir, { recursive: true });
    
    await this.initCollection(chunks[0]!.embeddingDim);

    const points = chunks.map(c => {
      fs.writeFileSync(join(this.blobDir, `${c.id}.txt`), c.redactedContent);
      
      return {
        id: hashToUuid(c.id),
        vector: c.embedding,
        payload: {
          original_id: c.id,
          repoId: c.repoId,
          path: c.path,
          language: c.language,
          symbol: c.symbol,
          startLine: c.startLine,
          endLine: c.endLine
        }
      };
    });

    await this.client.upsert(COLLECTION_NAME, { wait: true, points });
  }

  async finalize(manifest: Record<string, unknown>): Promise<void> {
    const fs = await import('node:fs');
    fs.writeFileSync(join(this.rootDir, '.atlas', this.repoId, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }
}

export class QdrantRetrievalIndex {
  private client: QdrantClient;
  private localAtlasDir: string; // Used to fetch blobs locally. Should point to org root or similar.

  constructor(url: string, localAtlasDir: string) {
    this.client = new QdrantClient({ url });
    this.localAtlasDir = localAtlasDir;
  }

  async search(query: string, embedder: Embedder, limit: number, llm?: LLMClient, repoIds?: string[]): Promise<Scored[]> {
    let intent: IntentClassification = { intent: 'concept_search', weights: { lexical: 0.5, semantic: 0.5 } };
    if (llm) {
      if (/[a-z][A-Z]/.test(query) || query.includes('/')) {
        intent = { intent: 'symbol_lookup', weights: { lexical: 0.8, semantic: 0.2 } };
      }
    }

    const [vector] = await embedder.embed([query]);
    if (!vector) return [];
    
    let filter: any = undefined;
    if (repoIds && repoIds.length > 0) {
      filter = {
        must: [
          {
            key: 'repoId',
            match: {
              any: repoIds
            }
          }
        ]
      };
    }

    const semanticResults = await this.client.search(COLLECTION_NAME, {
      vector,
      limit: limit * 2,
      with_payload: true,
      filter
    });

    // We don't have Zoekt, so we do a crude fallback for lexical using node.js filtering or just rely on Semantic.
    // For MVP Phase 1.5, we will return only the semantic results, treating lexical score as 0.
    
    const results = semanticResults.map((p, idx) => {
      const payload = p.payload as any;
      const original_id = payload.original_id;
      const repoId = payload.repoId;
      
      const blobPath = join(this.localAtlasDir, repoId, '.atlas', repoId, 'blobs', `${original_id}.txt`);
      const text = existsSync(blobPath) ? readFileSync(blobPath, 'utf8') : '';

      const chunk = {
        id: original_id,
        repoId: payload.repoId,
        path: payload.path,
        language: payload.language,
        symbol: payload.symbol,
        startLine: payload.startLine,
        endLine: payload.endLine,
        text,
        embedding: [] // Drop vectors in results
      };

      const RRF_K = 60;
      const semanticRank = idx + 1;
      let score = 0;
      score += intent.weights.semantic * (1 / (RRF_K + semanticRank));

      return { chunk, score };
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
}

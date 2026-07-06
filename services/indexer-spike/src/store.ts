/**
 * Chunk store (docs/06). The Phase-0 store writes to local files but preserves
 * the production separation of concerns:
 *   - blobs/<redacted_sha>.txt   → the ONLY place chunk text lives (redacted)
 *   - chunks.jsonl               → metadata only (mirrors the Postgres chunks table)
 *   - vectors.jsonl              → {id, embedding} (mirrors the Qdrant collection)
 * Crucially, vectors.jsonl carries NO source code — matching "no source code in
 * Qdrant, ever" (docs/06 TL;DR #4). Production swaps these three sinks for S3 +
 * Postgres + Qdrant behind the same interface.
 */
import { mkdirSync, writeFileSync, appendFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { EmbeddedChunk } from '../../../packages/shared-types/src/index.ts';

export interface ChunkStore {
  upsert(chunks: EmbeddedChunk[]): Promise<void>;
  finalize(manifest: Record<string, unknown>): Promise<void>;
}

export class JsonFileStore implements ChunkStore {
  private readonly dir: string;
  private readonly blobDir: string;
  private readonly chunksFile: string;
  private readonly vectorsFile: string;

  constructor(rootDir: string, repoId: string) {
    this.dir = join(rootDir, '.atlas', repoId);
    this.blobDir = join(this.dir, 'blobs');
    this.chunksFile = join(this.dir, 'chunks.jsonl');
    this.vectorsFile = join(this.dir, 'vectors.jsonl');
    if (existsSync(this.dir)) rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.blobDir, { recursive: true });
    writeFileSync(this.chunksFile, '');
    writeFileSync(this.vectorsFile, '');
  }

  async upsert(chunks: EmbeddedChunk[]): Promise<void> {
    for (const c of chunks) {
      // Blob: redacted content only, addressed by content id (== redacted_sha here).
      writeFileSync(join(this.blobDir, `${c.id}.txt`), c.redactedContent);
      // Metadata row (no vector, no raw code beyond the redacted excerpt pointer).
      const meta = {
        id: c.id, repoId: c.repoId, commit: c.commit, path: c.path, language: c.language,
        kind: c.kind, symbol: c.symbol, startLine: c.startLine, endLine: c.endLine,
        redactedSpanCount: c.redactedSpanCount, embeddingModel: c.embeddingModel, embeddingDim: c.embeddingDim,
      };
      appendFileSync(this.chunksFile, JSON.stringify(meta) + '\n');
      // Vector row: id + embedding ONLY — no source text.
      appendFileSync(this.vectorsFile, JSON.stringify({ id: c.id, embedding: c.embedding }) + '\n');
    }
  }

  async finalize(manifest: Record<string, unknown>): Promise<void> {
    writeFileSync(join(this.dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }

  get outputDir(): string { return this.dir; }
}

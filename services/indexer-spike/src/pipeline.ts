/**
 * Ingestion pipeline (docs/04 §ingestion). Order matters and encodes the core
 * invariant: read -> detect -> SECRET-SCAN -> chunk(redacted) -> content-address
 * -> embed -> store. Secrets are removed before any hash, embedding, or persist.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { CodeChunk, EmbeddedChunk } from '../../../packages/shared-types/src/index.ts';
import { detectLanguage } from './languages.ts';
import { scanAndRedact } from './secret-scan.ts';
import { chunk } from './chunker.ts';
import { contentHash } from './content-address.ts';
import { makeEmbedder, type Embedder } from './embedder.ts';
import { JsonFileStore, type ChunkStore } from './store.ts';
import { QdrantChunkStore } from './qdrant.ts';
import { loadConfig } from '../../../packages/config/src/index.ts';

const SKIP_DIRS = new Set(['node_modules', '.git', '.atlas', 'dist', 'build', 'target', '.next', '.turbo']);
const MAX_FILE_BYTES = 512 * 1024; // skip very large/binary-ish files in the spike
const REDACTION_PLACEHOLDER = '«REDACTED-SECRET»';

/** Heuristic binary detector: any NUL or low control byte (except tab/newline/cr). */
function looksBinary(s: string): boolean {
  const limit = Math.min(s.length, 4096);
  for (let i = 0; i < limit; i++) {
    const c = s.charCodeAt(i);
    if (c === 0) return true;
    if (c < 9 || (c > 13 && c < 32)) return true;
  }
  return false;
}

export interface IngestStats {
  repoId: string;
  commit: string;
  filesScanned: number;
  filesIndexed: number;
  chunks: number;
  secretsRedacted: number;
  embeddings: number;
  byLanguage: Record<string, number>;
  outputDir: string;
  durationMs: number;
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(join(dir, entry.name));
    } else if (entry.isFile()) {
      yield join(dir, entry.name);
    }
  }
}

export async function ingestRepo(
  repoDir: string,
  opts: { repoId: string; commit: string; embedder?: Embedder },
): Promise<IngestStats> {
  const startedAt = Date.now();
  const embedder = opts.embedder ?? makeEmbedder();
  const cfg = loadConfig();
  let store: ChunkStore;
  let outputDir: string;
  if (cfg.qdrant?.url) {
    store = new QdrantChunkStore(cfg.qdrant.url, repoDir, opts.repoId);
    outputDir = join(repoDir, '.atlas', opts.repoId); // local blob storage
  } else {
    const jsonStore = new JsonFileStore(repoDir, opts.repoId);
    store = jsonStore;
    outputDir = jsonStore.outputDir;
  }

  const stats: IngestStats = {
    repoId: opts.repoId, commit: opts.commit,
    filesScanned: 0, filesIndexed: 0, chunks: 0, secretsRedacted: 0, embeddings: 0,
    byLanguage: {}, outputDir, durationMs: 0,
  };

  const pending: CodeChunk[] = [];

  for (const abs of walk(repoDir)) {
    stats.filesScanned++;
    let size = 0;
    try { size = statSync(abs).size; } catch { continue; }
    if (size === 0 || size > MAX_FILE_BYTES) continue;

    const language = detectLanguage(abs);
    if (language === 'unknown') continue;

    let raw: string;
    try { raw = readFileSync(abs, 'utf8'); } catch { continue; }
    if (looksBinary(raw)) continue;

    // --- INVARIANT: redact secrets from the whole file BEFORE anything else ---
    const scan = scanAndRedact(raw);
    stats.secretsRedacted += scan.spanCount;

    const relPath = relative(repoDir, abs).split(sep).join('/');
    const rawChunks = chunk(scan.redacted, language);
    if (rawChunks.length === 0) continue;

    for (const rc of rawChunks) {
      const id = contentHash(rc.content);
      const redactedSpanCount = rc.content.split(REDACTION_PLACEHOLDER).length - 1;
      pending.push({
        id, repoId: opts.repoId, commit: opts.commit, path: relPath, language,
        kind: rc.kind, symbol: rc.symbol, startLine: rc.startLine, endLine: rc.endLine,
        redactedContent: rc.content, redactedSpanCount,
      });
    }

    stats.filesIndexed++;
    stats.byLanguage[language] = (stats.byLanguage[language] ?? 0) + 1;
  }

  // Content-addressed dedupe: identical chunks (vendored code, forks) embed once.
  const unique = new Map<string, CodeChunk>();
  for (const c of pending) if (!unique.has(c.id)) unique.set(c.id, c);
  const chunks = [...unique.values()];
  stats.chunks = chunks.length;

  // Embed in batches, then persist.
  const BATCH = 128;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await embedder.embed(batch.map((c) => c.redactedContent));
    const embedded: EmbeddedChunk[] = batch.map((c, k) => ({
      ...c, embedding: vectors[k]!, embeddingModel: embedder.model, embeddingDim: embedder.dim,
    }));
    await store.upsert(embedded);
    stats.embeddings += embedded.length;
  }

  stats.durationMs = Date.now() - startedAt;
  await store.finalize({ ...stats });
  return stats;
}

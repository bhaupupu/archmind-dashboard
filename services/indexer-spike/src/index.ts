/**
 * CLI entry for the ingestion spike.
 *   node src/index.ts <repoDir>
 * Runs with plain Node 22+ (native TS type-stripping); no build, no install,
 * no external services. Uses the mock embedder unless VOYAGE_API_KEY is set.
 */
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { ingestRepo } from './pipeline.ts';
import { makeEmbedder } from './embedder.ts';

function resolveCommit(dir: string): string {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().slice(0, 12);
  } catch {
    return 'WORKINGDIR';
  }
}

async function main(): Promise<void> {
  const repoDir = resolve(process.argv[2] ?? 'fixtures/sample-repo');
  if (!existsSync(repoDir)) {
    console.error(`repo dir not found: ${repoDir}`);
    process.exit(2);
  }
  const repoId = basename(repoDir);
  const commit = resolveCommit(repoDir);
  const embedder = makeEmbedder();

  console.log(`\n▶ Atlas ingestion spike`);
  console.log(`  repo:     ${repoId}  (@${commit})`);
  console.log(`  embedder: ${embedder.model} (dim ${embedder.dim})${embedder.model === 'mock-hash-v1' ? '  — set VOYAGE_API_KEY for real voyage-code-3' : ''}\n`);

  const stats = await ingestRepo(repoDir, { repoId, commit, embedder });

  console.log(`✔ done in ${stats.durationMs}ms`);
  console.log(`  files scanned:    ${stats.filesScanned}`);
  console.log(`  files indexed:    ${stats.filesIndexed}`);
  console.log(`  chunks:           ${stats.chunks}`);
  console.log(`  embeddings:       ${stats.embeddings}`);
  console.log(`  secrets redacted: ${stats.secretsRedacted}`);
  console.log(`  by language:      ${JSON.stringify(stats.byLanguage)}`);
  console.log(`  output:           ${stats.outputDir}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });

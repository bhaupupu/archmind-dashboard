/**
 * Impact analysis CLI — the first end-to-end product artifact.
 *   node src/analyze-cli.ts "<prompt>" [orgDir]
 */
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { runImpactAnalysis } from './analyze.ts';

async function main(): Promise<void> {
  const prompt = process.argv[2] ?? 'jsonwebtoken authentication';
  const orgDir = resolve(process.argv[3] ?? 'fixtures/sample-org');
  if (!existsSync(orgDir)) { console.error(`org dir not found: ${orgDir}`); process.exit(2); }

  const { report, graph } = await runImpactAnalysis(orgDir, prompt);

  console.log(`\n▶ Atlas impact analysis`);
  console.log(`  prompt: "${report.prompt}"`);
  console.log(`  graph:  ${graph.nodes} nodes, ${graph.edges} edges`);
  console.log(`  affected repos: ${report.affectedRepos.length}\n`);

  for (const f of report.affectedRepos) {
    const tag = f.disposition === 'must_change' ? 'MUST CHANGE' : f.disposition === 'may_change' ? 'may change ' : 'no change  ';
    console.log(`  [${tag}] ${f.repoFullName}  (confidence ${f.confidence})`);
    console.log(`      ${f.rationale}`);
    for (const e of f.evidence) {
      if (e.kind === 'file') console.log(`      • file: ${e.repo}/${e.path}:${e.startLine}${e.quote ? `  (${e.quote})` : ''}`);
      else console.log(`      • graph: ${e.edgeType} ${e.edgeId} (conf ${e.confidence})`);
    }
    console.log('');
  }
  console.log(`  plans: ${report.plans.length} (Planning is the LLM agent stage — not implemented in Phase 0)\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });

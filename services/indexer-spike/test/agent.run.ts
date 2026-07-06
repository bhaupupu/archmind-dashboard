/**
 * Agent-layer gate tests — orchestrator runs offline via the mock client, and the
 * hallucination guard drops fabricated citations (docs/05 §6).
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { runAgentAnalysis } from '../src/agents/orchestrator.ts';
import { MockLLMClient, makeLLMClient } from '../../../packages/agent-core/src/llm.ts';
import { verifyEvidence } from '../src/agents/guards.ts';
import type { RepoFinding } from '../../../packages/shared-types/src/index.ts';
import { ingestRepo } from '../src/pipeline.ts';
import { buildOrgGraph } from '../src/org.ts';
import { BagOfWordsEmbedder } from '../src/embedder.ts';
import { join } from 'node:path';

const ORG = resolve(import.meta.dirname, '../../../fixtures/sample-org');

let failures = 0;
async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n      ${(err as Error).message}`); }
}

console.log('\n▶ agent tests\n');

const { repos } = buildOrgGraph(ORG);
const embedder = new BagOfWordsEmbedder();
for (const r of repos) {
  await ingestRepo(join(ORG, r), { repoId: r, commit: 'WORKINGDIR', embedder });
}

const { report, llmSource } = await runAgentAnalysis(ORG, 'jsonwebtoken', { client: new MockLLMClient() });
const byRepo = new Map(report.affectedRepos.map((f) => [f.repoId, f]));

await check('orchestrator runs offline via the mock client', () => assert.equal(llmSource, 'mock'));
await check('scope + analysis mark auth-lib must_change', () => assert.equal(byRepo.get('auth-lib')?.disposition, 'must_change'));
await check('graph expansion adds dependents as may_change', () => {
  assert.equal(byRepo.get('web-app')?.disposition, 'may_change');
  assert.equal(byRepo.get('billing-svc')?.disposition, 'may_change');
});
await check('every finding carries evidence', () => {
  for (const f of report.affectedRepos) assert.ok(f.evidence.length > 0, `${f.repoId} has no evidence`);
});
await check('Planning agent produces a plan per affected repo', () => {
  assert.equal(report.plans.length, report.affectedRepos.length, 'plan count != affected repo count');
  const planIds = new Set(report.plans.map((p) => p.repoId));
  for (const f of report.affectedRepos) assert.ok(planIds.has(f.repoId), `no plan for ${f.repoId}`);
});
await check('each change plan has the five required fields populated', () => {
  const plan = report.plans.find((p) => p.repoId === 'auth-lib');
  assert.ok(plan, 'no auth-lib plan');
  assert.ok(plan.requiredChanges.length > 0, 'requiredChanges empty');
  assert.ok(plan.technicalApproach.length > 0, 'technicalApproach empty');
  assert.ok(Array.isArray(plan.sideEffects) && Array.isArray(plan.testingRequirements) && Array.isArray(plan.migrationRequirements));
  assert.ok(plan.testingRequirements.length > 0, 'testingRequirements empty');
});
await check('makeLLMClient exposes a structured() method', () => {
  const c = makeLLMClient();
  assert.ok(['mock', 'anthropic', 'gemini'].includes(c.kind) && typeof c.structured === 'function');
});
await check('makeLLMClient picks gemini when only GEMINI_API_KEY is set', () => {
  const saved = { anthropic: process.env.ANTHROPIC_API_KEY, gemini: process.env.GEMINI_API_KEY, provider: process.env.ATLAS_LLM_PROVIDER };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ATLAS_LLM_PROVIDER;
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    assert.equal(makeLLMClient().kind, 'gemini');
  } finally {
    if (saved.anthropic === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved.anthropic;
    if (saved.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = saved.gemini;
    if (saved.provider === undefined) delete process.env.ATLAS_LLM_PROVIDER; else process.env.ATLAS_LLM_PROVIDER = saved.provider;
  }
});
await check('ATLAS_LLM_PROVIDER=gemini overrides an ANTHROPIC_API_KEY that is also set', () => {
  const saved = { anthropic: process.env.ANTHROPIC_API_KEY, gemini: process.env.GEMINI_API_KEY, provider: process.env.ATLAS_LLM_PROVIDER };
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.ATLAS_LLM_PROVIDER = 'gemini';
  try {
    assert.equal(makeLLMClient().kind, 'gemini');
  } finally {
    if (saved.anthropic === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved.anthropic;
    if (saved.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = saved.gemini;
    if (saved.provider === undefined) delete process.env.ATLAS_LLM_PROVIDER; else process.env.ATLAS_LLM_PROVIDER = saved.provider;
  }
});
await check('guard drops a fabricated path, keeps a real one', () => {
  const finding: RepoFinding = {
    repoId: 'r', repoFullName: 'r', disposition: 'must_change', rationale: 'x', confidence: 0.7,
    evidence: [
      { kind: 'file', repo: 'r', path: 'real.ts', startLine: 1, endLine: 2 },
      { kind: 'file', repo: 'r', path: 'FABRICATED.ts', startLine: 1, endLine: 2 },
    ],
  };
  const { finding: v, removed } = verifyEvidence(finding, new Set(['real.ts']));
  assert.equal(removed, 1);
  assert.equal(v.evidence.length, 1);
  assert.equal((v.evidence[0] as { path: string }).path, 'real.ts');
});
await check('guard downgrades a finding left with no valid evidence', () => {
  const finding: RepoFinding = {
    repoId: 'r', repoFullName: 'r', disposition: 'must_change', rationale: 'x', confidence: 0.9,
    evidence: [{ kind: 'file', repo: 'r', path: 'ghost.ts', startLine: 1, endLine: 2 }],
  };
  const { finding: v } = verifyEvidence(finding, new Set());
  assert.equal(v.disposition, 'no_change');
  assert.ok(v.confidence <= 0.2);
});

console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
process.exit(failures === 0 ? 0 : 1);

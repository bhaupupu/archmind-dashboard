/**
 * Per-repo Planning agent (docs/05 Planning stage, Opus tier). For each affected
 * repo it produces a concrete change plan with the five founder-required fields:
 * required changes, technical approach, side effects, testing requirements,
 * migration requirements. Advisory mode stops after this stage. The deterministic
 * fallback derives a sensible plan from the finding so the pipeline runs offline.
 */
import type { LLMClient } from '../../../../packages/agent-core/src/llm.ts';
import type { RepoChangePlan, RepoFinding } from '../../../../packages/shared-types/src/index.ts';

const SCHEMA = {
  type: 'object',
  properties: {
    requiredChanges: { type: 'array', items: { type: 'string' } },
    technicalApproach: { type: 'string' },
    sideEffects: { type: 'array', items: { type: 'string' } },
    testingRequirements: { type: 'array', items: { type: 'string' } },
    migrationRequirements: { type: 'array', items: { type: 'string' } },
  },
  required: ['requiredChanges', 'technicalApproach', 'sideEffects', 'testingRequirements', 'migrationRequirements'],
};

export async function runPlanning(
  client: LLMClient,
  prompt: string,
  finding: RepoFinding,
): Promise<RepoChangePlan> {
  const files = finding.evidence
    .filter((e): e is Extract<typeof e, { kind: 'file' }> => e.kind === 'file')
    .map((e) => `${e.path}:${e.startLine}`);
  const originates = finding.disposition === 'must_change';

  const system = [
    'You are the Planning agent for a multi-repository change.',
    `Produce a concrete change plan for repository "${finding.repoId}".`,
    'Return: required changes, technical approach, side effects, testing requirements, and migration requirements.',
    'Ground every item in the finding and its cited evidence. Be specific and honest — if no migration is needed, say so explicitly rather than inventing one.',
  ].join(' ');

  const user = [
    `Change request: "${prompt}"`,
    `Repository: ${finding.repoId} (${finding.disposition})`,
    `Why affected: ${finding.rationale}`,
    `Evidence: ${files.join(', ') || '(graph dependency only)'}`,
  ].join('\n');

  const { value } = await client.structured<Omit<RepoChangePlan, 'repoId'>>({
    tier: 'opus',
    system,
    user,
    toolName: 'write_change_plan',
    schema: SCHEMA,
    fallback: () => originates
      ? {
          requiredChanges: files.length
            ? files.map((f) => `Implement the requested change in ${f}`)
            : [`Implement "${prompt}" in ${finding.repoId}`],
          technicalApproach: `Modify the cited code paths to satisfy the request, keeping the public interface stable where possible.`,
          sideEffects: ['Downstream dependents may require coordinated updates (see dependency graph).'],
          testingRequirements: ['Unit tests for the changed functions', 'Integration test covering the affected path'],
          migrationRequirements: ['No data migration required (code-level change).'],
        }
      : {
          requiredChanges: [`Review integration with the upstream change and update call sites if the contract changes.`],
          technicalApproach: `Assess the upstream change's contract impact on this repo; adjust callers and types as needed.`,
          sideEffects: ['May be a no-op if the upstream change is backwards compatible.'],
          testingRequirements: ['Regression test the integration points that consume the upstream repo.'],
          migrationRequirements: ['None expected.'],
        },
  });

  return { repoId: finding.repoId, ...value };
}

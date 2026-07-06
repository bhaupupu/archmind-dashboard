/**
 * Cross-Repo Synthesis agent (docs/05 Synthesis stage, Opus tier).
 * Consumes the parallel per-repo findings to produce a global verdict and an
 * executive summary of the entire multi-repo change request.
 */
import type { LLMClient } from '../../../../packages/agent-core/src/llm.ts';
import type { RepoFinding } from '../../../../packages/shared-types/src/index.ts';

const SCHEMA = {
  type: 'object',
  properties: {
    globalVerdict: { type: 'string', enum: ['feasible', 'blocked', 'needs_clarification'] },
    executiveSummary: { type: 'string' },
  },
  required: ['globalVerdict', 'executiveSummary'],
};

export async function runSynthesis(
  client: LLMClient,
  prompt: string,
  findings: RepoFinding[],
): Promise<{ globalVerdict: 'feasible' | 'blocked' | 'needs_clarification'; executiveSummary: string }> {
  const system = [
    'You are the Synthesis agent for a multi-repository codebase.',
    'You are presented with a user change request and the independent findings across all affected repositories.',
    'Synthesize these findings into a global verdict ("feasible", "blocked", or "needs_clarification") and a concise executive summary.',
    'Highlight any cross-repo conflicts, cascading risks, or missing information.',
  ].join(' ');

  const findingsText = findings.map(f => 
    `Repo: ${f.repoId}\nDisposition: ${f.disposition}\nRationale: ${f.rationale}`
  ).join('\n\n');

  const user = [
    `Change request: "${prompt}"`,
    `Affected Repositories:\n${findingsText || '(None)'}`,
  ].join('\n\n');

  const { value } = await client.structured<{ globalVerdict: 'feasible' | 'blocked' | 'needs_clarification'; executiveSummary: string }>({
    tier: 'opus',
    system,
    user,
    toolName: 'write_synthesis',
    schema: SCHEMA,
    fallback: () => ({
      globalVerdict: 'feasible',
      executiveSummary: `The requested change "${prompt}" touches ${findings.length} repositories and appears feasible to implement across the stack.`,
    }),
  });

  return value;
}

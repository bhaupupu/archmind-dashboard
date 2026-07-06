/**
 * Scope agent (docs/05 Scope stage). Given the change request and a compact
 * summary of the org's repos, selects which repos are DIRECTLY affected (where
 * the change originates). Opus tier — this is the singular, highest-leverage
 * cross-repo decision. The deterministic fallback seeds from retrieval so the
 * pipeline behaves sensibly offline.
 */
import type { LLMClient } from '../../../../packages/agent-core/src/llm.ts';

export interface RepoCard { repoId: string; topPaths: string[]; dependencies: string[]; dependents: string[] }
export interface ScopeCandidate { repoId: string; reason: string }
export interface ScopeOutput { candidates: ScopeCandidate[] }

const SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: { repoId: { type: 'string' }, reason: { type: 'string' } },
        required: ['repoId', 'reason'],
      },
    },
  },
  required: ['candidates'],
};

export async function runScope(
  client: LLMClient,
  prompt: string,
  cards: RepoCard[],
  retrievalSeeds: string[],
): Promise<ScopeOutput> {
  const cardText = cards
    .map((c) => `- ${c.repoId}: files[${c.topPaths.slice(0, 4).join(', ') || 'none'}] dependencies[${c.dependencies?.join(', ') || 'none'}] dependents[${c.dependents?.join(', ') || 'none'}]`)
    .join('\n');

  const system = [
    'You are the Scope agent for a multi-repository impact-analysis platform.',
    'Given a change request and a summary of the organization\'s repositories (including dependency graph edges), select ONLY the repositories where the requested change MUST originate.',
    'Use the graph edges (dependencies/dependents) to understand the architecture, but do NOT select a repo solely because it is a downstream dependent. Downstream blast radius is calculated automatically.',
    'Use only repository ids from the provided list. Give a one-line reason for each.',
  ].join(' ');

  const user = [
    `Change request: "${prompt}"`,
    '',
    'Repositories in the org:',
    cardText,
  ].join('\n');

  const validIds = new Set(cards.map((c) => c.repoId));
  const { value } = await client.structured<ScopeOutput>({
    tier: 'opus',
    system,
    user,
    toolName: 'select_candidate_repos',
    schema: SCHEMA,
    fallback: () => ({
      candidates: (retrievalSeeds.length ? retrievalSeeds : cards.slice(0, 1).map((c) => c.repoId))
        .map((repoId) => ({ repoId, reason: 'Matched the request via retrieval.' })),
    }),
  });

  // Never trust a repo id the model invented.
  return { candidates: value.candidates.filter((c) => validIds.has(c.repoId)) };
}

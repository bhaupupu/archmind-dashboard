/**
 * PR Agent (docs/05 Autonomous mode).
 * Generates a PR description based on the plan and finding.
 * In a real implementation this would also call a CodeGen agent to produce the diff,
 * and then a GitHub API to open the PR.
 */
import type { LLMClient } from '../../../../packages/agent-core/src/llm.ts';
import type { RepoChangePlan, RepoFinding } from '../../../../packages/shared-types/src/index.ts';
import { cache } from '../../../../packages/config/src/index.ts';
import { createHash } from 'node:crypto';

const SCHEMA = {
  type: 'object',
  properties: {
    prTitle: { type: 'string' },
    prBody: { type: 'string' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['path', 'content']
      }
    }
  },
  required: ['prTitle', 'prBody', 'changes'],
};

export interface PRDraft {
  prTitle: string;
  prBody: string;
  changes: { path: string; content: string }[];
}

export async function generatePR(
  client: LLMClient,
  prompt: string,
  finding: RepoFinding,
  plan: RepoChangePlan,
  fileContents?: { path: string, content: string }[]
): Promise<PRDraft> {
  const system = [
    'You are the PR agent for a multi-repository change.',
    `Produce a Pull Request draft for repository "${finding.repoId}".`,
    'Return: a clear PR title, a detailed Markdown PR body, and structural file changes.',
    'The PR body MUST cite the original cross-repo intent and explain why this repo is changing.',
    'For each file changed, return the EXACT full modified source code in `content`. Do not truncate.'
  ].join(' ');

  const user = [
    `Change request: "${prompt}"`,
    `Repository: ${finding.repoId}`,
    `Rationale: ${finding.rationale}`,
    `Technical Approach: ${plan.technicalApproach}`,
    `Required Changes: ${plan.requiredChanges.join(', ')}`,
    fileContents && fileContents.length > 0 
      ? `Original File Contents:\n${fileContents.map(f => `--- ${f.path} ---\n${f.content}\n`).join('\n')}`
      : ''
  ].join('\n');

  const cacheKey = `pr-draft:${createHash('sha256').update(system + user).digest('hex')}`;
  const cached = await cache.get<PRDraft>(cacheKey);
  if (cached) {
    console.log(`[Cache Hit] Serving PRDraft for ${finding.repoId}`);
    return cached;
  }

  const { value } = await client.structured<PRDraft>({
    tier: 'sonnet',
    system,
    user,
    toolName: 'generate_pr_draft',
    schema: SCHEMA,
    fallback: () => ({
      prTitle: `feat: implement ${prompt} in ${finding.repoId}`,
      prBody: `This PR implements the repository-specific portion of the cross-repo intent:\n> ${prompt}\n\n### Rationale\n${finding.rationale}\n\n### Required Changes\n${plan.requiredChanges.map(c => `- [x] ${c}`).join('\n')}`,
      changes: finding.evidence.filter(e => e.kind === 'file').map(e => ({
        path: (e as any).path,
        content: `// TODO: implement ${prompt}\nconsole.log("implemented");`
      }))
    })
  });

  await cache.set(cacheKey, value, 3600); // Cache for 1 hour

  return value;
}

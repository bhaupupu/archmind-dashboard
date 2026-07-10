import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '../auth';
import prisma from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getEnv } from '@/lib/env';
import { makeRateLimiter, checkRateLimit } from '@/lib/ratelimit';
import { readJsonBody } from '@/lib/request';

export const maxDuration = 60;

const ratelimit = makeRateLimiter(5, '10 s');

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    checklist: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'body', 'checklist'],
};

async function draftWithGemini(geminiKey: string, prompt: string, repoId: string, rationale: string, disposition: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: 'You draft concise, professional pull request descriptions for software engineers. Return only the requested JSON.' }],
      },
      contents: [{
        parts: [{
          text: `Change request: "${prompt}"\nTarget repository: ${repoId}\nWhy this repo is affected (${disposition}): ${rationale}\n\nDraft a PR title, a Markdown PR body (include a "Why" section referencing the change request), and a checklist of 3-5 concrete required changes.`,
        }],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: DRAFT_SCHEMA,
        maxOutputTokens: 1024,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('no text in Gemini response');
  // Never trust LLM output shape — a wrong-typed checklist would otherwise blow
  // up at prisma.create, outside the simulated-draft fallback.
  return z
    .object({ title: z.string().min(1), body: z.string().min(1), checklist: z.array(z.string()) })
    .parse(JSON.parse(text));
}

function simulatedDraft(prompt: string, repoId: string, rationale: string) {
  return {
    title: `feat: ${prompt} (${repoId})`,
    body: `## Why\n${rationale}\n\n_This is a simulated draft — configure GEMINI_API_KEY for AI-generated PR descriptions._`,
    checklist: ['Implement the required change', 'Add/update tests', 'Update documentation if needed'],
  };
}

export async function POST(req: NextRequest) {
  const { GEMINI_API_KEY } = getEnv();
  const id = requireRole(req, ['member', 'admin']);
  if (id instanceof NextResponse) return id;

  const limit = await checkRateLimit(ratelimit, id.tenantId);
  if (!limit.ok) return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });

  const body = await readJsonBody(req);
  const parsedBody = z
    .object({ analysisId: z.string().trim().min(1), repoId: z.string().trim().min(1) })
    .safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'analysisId_and_repoId_required' }, { status: 400 });
  }
  const { analysisId, repoId } = parsedBody.data;

  // Scope to the caller's own analysis — prevents drafting a PR against another
  // tenant's analysis by guessing an analysisId.
  const analysis = await prisma.analysis.findFirst({ where: { id: analysisId, userId: id.tenantId } });
  if (!analysis) return NextResponse.json({ error: 'analysis_not_found' }, { status: 404 });

  let parsed: { prompt?: string; affectedRepos?: { repoId: string; disposition: string; rationale?: string }[] };
  try {
    parsed = JSON.parse(analysis.result);
  } catch {
    return NextResponse.json({ error: 'analysis_result_corrupt' }, { status: 500 });
  }

  const finding = parsed.affectedRepos?.find((f) => f.repoId === repoId);
  if (!finding) return NextResponse.json({ error: 'repo_not_in_analysis' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: id.tenantId } });
  let geminiKey = GEMINI_API_KEY;
  if (user?.geminiKey) {
    try {
      geminiKey = decrypt(user.geminiKey);
    } catch (err) {
      console.error('[pull-requests] stored gemini key undecryptable, using server fallback', err);
    }
  }
  const prompt = parsed.prompt ?? analysis.prompt;
  const rationale = finding.rationale ?? 'Affected by the requested change.';

  let draft: { title: string; body: string; checklist: string[] };
  try {
    draft = geminiKey
      ? await draftWithGemini(geminiKey, prompt, repoId, rationale, finding.disposition)
      : simulatedDraft(prompt, repoId, rationale);
  } catch (err) {
    console.error('[pull-requests] draft generation failed, falling back to simulated draft', err);
    draft = simulatedDraft(prompt, repoId, rationale);
  }

  try {
    const pr = await prisma.pullRequest.create({
      data: {
        repoId,
        title: draft.title,
        body: draft.body,
        checklist: draft.checklist,
        userId: id.tenantId,
        analysisId,
      },
    });
    return NextResponse.json(pr, { status: 201 });
  } catch (err) {
    console.error('[pull-requests] failed to persist draft', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const id = requireRole(req, ['viewer', 'member', 'admin']);
  if (id instanceof NextResponse) return id;

  const pullRequests = await prisma.pullRequest.findMany({
    where: { userId: id.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ pullRequests });
}

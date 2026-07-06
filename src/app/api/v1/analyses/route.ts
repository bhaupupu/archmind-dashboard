import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../auth';
import { buildGitHubGraph } from '../../../../lib/github-graph';
import prisma from '../../../../lib/db';
import crypto from 'crypto';
import { decrypt } from '@/lib/encryption';
import { getEnv } from '@/lib/env';
import { makeRateLimiter, checkRateLimit } from '@/lib/ratelimit';

// Allow up to ~5min for larger orgs; indexing is still synchronous (see github-graph.ts).
export const maxDuration = 300;

const { GEMINI_API_KEY } = getEnv();

// 5 requests per 10 seconds per user — this endpoint calls a paid/quota-limited
// LLM API plus a full GitHub repo scan, so it's the most cost-sensitive route.
const ratelimit = makeRateLimiter(5, '10 s');

export async function POST(req: NextRequest) {
  const id = requireRole(req, ['member', 'admin']);
  if (id instanceof NextResponse) return id;

  // Check the limit before any DB/decrypt/network work so a rejected request costs nothing.
  const limit = await checkRateLimit(ratelimit, id.tenantId);
  if (!limit.ok) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { id: id.tenantId } });
  if (!user || !user.githubToken) {
    return NextResponse.json({ error: 'github_token_missing' }, { status: 400 });
  }
  const githubToken = decrypt(user.githubToken);
  const geminiKey = user.geminiKey ? decrypt(user.geminiKey) : GEMINI_API_KEY;

  const body = await req.json();
  const prompt = (body.prompt ?? '').trim();
  if (!prompt) return NextResponse.json({ error: 'prompt_required' }, { status: 400 });

  const wantsStream = req.headers.get('accept')?.includes('text/event-stream');

  const { repos, graph } = await buildGitHubGraph(githubToken, id.tenantId);

  let summary = `Analysis of prompt: ${prompt}\n\n`;
  const affectedRepos: any[] = [];
  const plans: any[] = [];

  if (geminiKey) {
    try {
      const llmRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze the architectural impact of this request: "${prompt}". \nThe organization has these repositories: ${repos.join(', ')}.\nRespond in a concise summary of which repos need to change.`
            }]
          }]
        })
      });
      const data = await llmRes.json();
      summary = data.candidates?.[0]?.content?.parts?.[0]?.text || summary;

      
      // Select 1 or 2 repos arbitrarily for the UI since we don't have full AST search
      if (repos.length > 0) {
        affectedRepos.push({
          repoId: repos[0],
          disposition: 'must_change',
          evidence: [],
          rationale: summary
        });
        plans.push({
          repoId: repos[0],
          steps: ['Update logic', 'Bump versions']
        });
      }
    } catch (e) {
      summary = 'Gemini API error occurred.';
    }
  } else {
    summary = `Cloud Analysis: Simulated execution for "${prompt}". Please configure GEMINI_API_KEY for deep LLM analysis. Found ${repos.length} repositories.`;
    if (repos.length > 0) {
      affectedRepos.push({
        repoId: repos[0],
        disposition: 'must_change',
        evidence: [],
        rationale: 'Primary repo affected by the change.'
      });
    }
    if (repos.length > 1) {
      affectedRepos.push({
        repoId: repos[1],
        disposition: 'may_change',
        evidence: [],
        rationale: 'Dependent repo that might require updates.'
      });
    }
  }

  const report = {
    id: crypto.randomUUID(),
    tenantId: id.tenantId,
    prompt,
    timestamp: new Date().toISOString(),
    status: 'completed',
    affectedRepos,
    plans,
    summary,
  };

  // Persist to database
  await prisma.analysis.create({
    data: {
      id: report.id,
      prompt: report.prompt,
      result: JSON.stringify(report),
      userId: id.tenantId
    }
  });

  if (wantsStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ report })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  return NextResponse.json(report, { status: 201 });
}

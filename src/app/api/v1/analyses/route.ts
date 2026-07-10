import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '../auth';
import { buildGitHubGraph } from '../../../../lib/github-graph';
import prisma from '../../../../lib/db';
import crypto from 'crypto';
import { decrypt } from '@/lib/encryption';
import { getEnv } from '@/lib/env';
import { makeRateLimiter, checkRateLimit } from '@/lib/ratelimit';
import { readJsonBody } from '@/lib/request';
import { Octokit } from '@octokit/rest';

// Caps what we forward into paid Gemini calls; real change requests fit well within this.
const MAX_PROMPT_LENGTH = 4000;

// Allow up to ~5min for larger orgs; indexing is still synchronous (see github-graph.ts).
export const maxDuration = 300;



// 5 requests per 10 seconds per user — this endpoint calls a paid/quota-limited
// LLM API plus a full GitHub repo scan, so it's the most cost-sensitive route.
const ratelimit = makeRateLimiter(5, '10 s');

export async function POST(req: NextRequest) {
  const { GEMINI_API_KEY } = getEnv();
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
  let githubToken: string;
  try {
    githubToken = decrypt(user.githubToken);
  } catch (err) {
    console.error('[analyses] stored GitHub token undecryptable (rotated ENCRYPTION_KEY?)', err);
    return NextResponse.json(
      { error: 'github_token_unreadable', message: 'Stored GitHub credentials could not be read. Please sign in again.' },
      { status: 500 }
    );
  }
  let geminiKey = GEMINI_API_KEY;
  if (user.geminiKey) {
    try {
      geminiKey = decrypt(user.geminiKey);
    } catch (err) {
      console.error('[analyses] stored gemini key undecryptable, using server fallback', err);
    }
  }

  const body = await readJsonBody(req);
  const parsedBody = z
    .object({ prompt: z.string().trim().min(1).max(MAX_PROMPT_LENGTH) })
    .safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'prompt_required', message: `prompt must be a non-empty string of at most ${MAX_PROMPT_LENGTH} characters` },
      { status: 400 }
    );
  }
  const prompt = parsedBody.data.prompt;

  const wantsStream = req.headers.get('accept')?.includes('text/event-stream');

  let repos: string[];
  let graph;
  try {
    ({ repos, graph } = await buildGitHubGraph(githubToken, id.tenantId));
  } catch (err) {
    console.error('[analyses] failed to build repository graph', err);
    return NextResponse.json({ error: 'github_api_error' }, { status: 502 });
  }

  let summary = `Analysis of prompt: ${prompt}\n\n`;
  let affectedRepos: any[] = [];
  let plans: any[] = [];
  let analysisFailed = false;

  const edges = graph.allEdges().map(e => `${e.srcId.replace('repo:', '')} depends on ${e.dstId.replace('repo:', '')}`);
  const architectureContext = `Organization Repositories: ${repos.join(', ')}\nCross-Repository Dependencies:\n${edges.length > 0 ? edges.join('\n') : 'None found.'}`;

  let searchKeywords: string[] = [];
  let deepSearchContext = "None found.";

  if (geminiKey) {
    try {
      const keywordRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Extract 1-2 highly specific technical keywords or function names from this prompt for a codebase search. Ignore generic words. Prompt: "${prompt}". Return a JSON object: { "keywords": ["keyword1", "keyword2"] }` }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const keywordData = await keywordRes.json();
      const rawText = keywordData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        searchKeywords = parsed.keywords || [];
      }
    } catch (e) {
      console.warn('Keyword extraction failed', e);
    }
  }

  if (searchKeywords.length > 0 && githubToken) {
    try {
      const octokit = new Octokit({ auth: githubToken });
      const repoScope = repos.slice(0, 5).map(r => `repo:${r}`).join(' ');
      
      const searchPromises = searchKeywords.map(async (kw) => {
        const q = `${kw} ${repoScope}`;
        const res = await octokit.rest.search.code({
          q,
          per_page: 3,
          headers: { accept: 'application/vnd.github.v3.text-match+json' }
        });
        return { keyword: kw, items: res.data.items };
      });

      const searchResults = await Promise.allSettled(searchPromises);
      const contextLines: string[] = [];

      for (const result of searchResults) {
        if (result.status === 'fulfilled') {
          const { keyword, items } = result.value;
          if (items.length > 0) {
            contextLines.push(`\nResults for "${keyword}":`);
            for (const item of items) {
               const textMatches = (item as any).text_matches;
               if (textMatches && textMatches.length > 0) {
                 contextLines.push(`- File: ${item.repository.full_name}/${item.path}`);
                 contextLines.push(`  Snippet: ...${textMatches[0].fragment.replace(/\n/g, ' ')}...`);
               }
            }
          }
        }
      }
      
      if (contextLines.length > 0) {
        deepSearchContext = contextLines.join('\n');
      }
    } catch (e) {
      console.warn('GitHub search failed', e);
    }
  }

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
              text: `You are an expert software architect. Analyze the architectural impact of the following request: "${prompt}".\n\nArchitecture Context:\n${architectureContext}\n\nDeep Code Search Snippets:\n${deepSearchContext}\n\nYou must return a JSON object with the following schema:\n{\n  "summary": "A concise reasoning of the overall architectural impact.",\n  "affectedRepos": [\n    {\n      "repoId": "name of the repository",\n      "disposition": "must_change" | "may_change",\n      "rationale": "Reason why this repo needs to change"\n    }\n  ],\n  "plans": [\n    {\n      "repoId": "name of the repository",\n      "steps": ["Step 1", "Step 2"]\n    }\n  ]\n}`
            }]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });
      const data = await llmRes.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('empty Gemini response');
      const parsed = JSON.parse(rawText);
      // Validate the LLM's shape before persisting/returning: a malformed entry
      // (missing repoId/disposition) would crash the results UI on dereference.
      const validated = z
        .object({
          summary: z.string().optional(),
          affectedRepos: z
            .array(z.object({
              repoId: z.string(),
              disposition: z.enum(['must_change', 'may_change']),
              rationale: z.string().optional(),
            }))
            .optional(),
          plans: z
            .array(z.object({ repoId: z.string(), steps: z.array(z.string()) }))
            .optional(),
        })
        .parse(parsed);
      summary = validated.summary || summary;
      affectedRepos = validated.affectedRepos || [];
      plans = validated.plans || [];
    } catch (e) {
      summary = 'The AI provider returned an error or an unusable response. This analysis did not complete — please try again.';
      analysisFailed = true;
      console.error('[analyses] LLM analysis failed', e);
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
    // 'failed' lets the client distinguish a provider error from a real result
    // instead of rendering an empty report as success.
    status: analysisFailed ? 'failed' : 'completed',
    affectedRepos,
    plans,
    summary,
  };

  // Persist to database (failed runs too — they're part of history)
  try {
    await prisma.analysis.create({
      data: {
        id: report.id,
        prompt: report.prompt,
        result: JSON.stringify(report),
        userId: id.tenantId
      }
    });
  } catch (err) {
    console.error('[analyses] failed to persist analysis', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

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

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../auth';
import prisma from '@/lib/db';
import { Octokit } from '@octokit/rest';
import { decrypt } from '@/lib/encryption';
import { makeRateLimiter, checkRateLimit } from '@/lib/ratelimit';

const ratelimit = makeRateLimiter(10, '10 s');

export async function GET(req: NextRequest) {
  const id = requireRole(req, ['viewer', 'member', 'admin']);
  if (id instanceof NextResponse) return id;

  const limit = await checkRateLimit(ratelimit, id.tenantId);
  if (!limit.ok) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  const query = req.nextUrl.searchParams.get('q')?.trim() || '';

  try {
    const repos = await prisma.repository.findMany({
      where: { userId: id.tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    const matchingRepos = repos.filter(r =>
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      r.fullName.toLowerCase().includes(query.toLowerCase())
    );

    let codeResults: any[] = [];

    if (query.length >= 3 && repos.length > 0) {
      const user = await prisma.user.findUnique({ where: { id: id.tenantId } });
      if (user?.githubToken) {
        try {
          const githubToken = decrypt(user.githubToken);
          const octokit = new Octokit({ auth: githubToken });
          const repoScope = repos.slice(0, 5).map(r => `repo:${r.fullName}`).join(' ');
          const searchRes = await octokit.rest.search.code({
            q: `${query} ${repoScope}`,
            per_page: 5,
            headers: { accept: 'application/vnd.github.v3.text-match+json' }
          });
          codeResults = searchRes.data.items.map((item: any) => ({
            path: item.path,
            repo: item.repository.full_name,
            url: item.html_url,
            textMatches: item.text_matches?.map((tm: any) => tm.fragment) || []
          }));
        } catch (e) {
          console.warn('[search] GitHub code search failed:', e);
        }
      }
    }

    return NextResponse.json({
      repos: matchingRepos,
      code: codeResults
    });
  } catch (err) {
    console.error('Search endpoint failed', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

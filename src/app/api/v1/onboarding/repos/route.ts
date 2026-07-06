import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import prisma from '@/lib/db';
import { Octokit } from '@octokit/rest';
import { decrypt } from '@/lib/encryption';
import { getEnv } from '@/lib/env';
import { makeRateLimiter, checkRateLimit } from '@/lib/ratelimit';

export const maxDuration = 60;


const ratelimit = makeRateLimiter(10, '10 s');

async function getSession() {
  const { JWT_SECRET } = getEnv();
  const cookieStore = await cookies();
  const token = cookieStore.get('atlas_session')?.value;
  if (!token) return null;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string, username: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) return null;
    return { ...decoded, gh_token: decrypt(user.githubToken) };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const limit = await checkRateLimit(ratelimit, session.sub);
  if (!limit.ok) return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });

  try {
    const octokit = new Octokit({ auth: session.gh_token });
    
    // Fetch repositories user has access to (paginated)
    const reposResponse = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      sort: 'updated',
      per_page: 100
    });
    
    const repos = reposResponse.map((r: any) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner.login,
      description: r.description,
      language: r.language,
      stargazersCount: r.stargazers_count,
    }));
    
    return NextResponse.json({ repositories: repos });
  } catch (error) {
    console.error('Error fetching repos from GitHub:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const limit = await checkRateLimit(ratelimit, session.sub);
  if (!limit.ok) return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });

  try {
    const { repositories } = await req.json() as { repositories: any[] };
    if (!Array.isArray(repositories) || repositories.length === 0) {
      return NextResponse.json({ error: 'Invalid repositories payload' }, { status: 400 });
    }

    const octokit = new Octokit({ auth: session.gh_token });
    
    // Fetch all user repos to validate incoming IDs (IDOR protection)
    const validRepos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      per_page: 100
    });
    const validRepoIds = new Set(validRepos.map((r: any) => r.id));

    const savedRepos = [];
    
    // Upsert selected repositories into the database
    for (const repo of repositories) {
      if (!validRepoIds.has(repo.id)) {
        continue; // Skip unauthorized repos
      }
      const saved = await prisma.repository.upsert({
        where: { githubId: repo.id },
        update: {
          name: repo.name,
          fullName: repo.fullName,
          owner: repo.owner,
        },
        create: {
          githubId: repo.id,
          name: repo.name,
          fullName: repo.fullName,
          owner: repo.owner,
          userId: session.sub
        }
      });
      savedRepos.push(saved);
    }

    return NextResponse.json({ success: true, saved: savedRepos.length });
  } catch (error) {
    console.error('Error saving selected repos:', error);
    return NextResponse.json({ error: 'Failed to save selected repositories' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '@/lib/db';
import { Octokit } from '@octokit/rest';
import { decrypt } from '@/lib/encryption';
import { getEnv } from '@/lib/env';
import { makeRateLimiter, checkRateLimit } from '@/lib/ratelimit';
import { readJsonBody } from '@/lib/request';

export const maxDuration = 60;


const ratelimit = makeRateLimiter(10, '10 s');

// Caps octokit.paginate: 10 pages × 100 = 1000 repos. Users in very large orgs
// would otherwise trigger dozens of sequential GitHub calls per request.
const MAX_REPO_PAGES = 10;

async function listUserRepos(octokit: Octokit) {
  let pages = 0;
  const repos = await octokit.paginate(
    octokit.rest.repos.listForAuthenticatedUser,
    { sort: 'updated', per_page: 100 },
    (response, done) => {
      if (++pages >= MAX_REPO_PAGES) {
        console.warn(`[onboarding] repo list truncated at ${MAX_REPO_PAGES * 100} repos`);
        done();
      }
      return response.data;
    }
  );
  return repos;
}

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

    // Fetch repositories user has access to (paginated, capped)
    const reposResponse = await listUserRepos(octokit);

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

  const body = await readJsonBody(req);
  // Only ids are taken from the client; all metadata comes from GitHub below.
  const parsedBody = z
    .object({ repositories: z.array(z.object({ id: z.number().int() }).loose()).min(1).max(1000) })
    .safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Invalid repositories payload' }, { status: 400 });
  }

  try {
    const octokit = new Octokit({ auth: session.gh_token });

    // Fetch all user repos to validate incoming IDs (IDOR protection) and to
    // source trusted metadata — never persist client-supplied name/owner.
    const validRepos = await listUserRepos(octokit);
    const validById = new Map<number, any>(validRepos.map((r: any) => [r.id, r]));

    const savedRepos = [];

    // Upsert selected repositories into the database
    for (const repo of parsedBody.data.repositories) {
      const ghRepo = validById.get(repo.id);
      if (!ghRepo) {
        continue; // Skip unauthorized repos
      }
      const metadata = {
        name: ghRepo.name,
        fullName: ghRepo.full_name,
        owner: ghRepo.owner.login,
      };
      const saved = await prisma.repository.upsert({
        where: { githubId_userId: { githubId: repo.id, userId: session.sub } },
        update: metadata,
        create: {
          githubId: repo.id,
          ...metadata,
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

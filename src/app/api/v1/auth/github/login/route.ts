import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';

// 'repo' is required to read file contents (including private repos) for graph/impact
// analysis — see the disclosure on the login page and Privacy Policy §1.
const GITHUB_OAUTH_SCOPE = 'repo';

export async function GET(req: NextRequest) {
  const { GITHUB_CLIENT_ID, BASE_URL } = getEnv();
  const redirectUri = encodeURIComponent(`${BASE_URL}/api/v1/auth/github/callback`);
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${GITHUB_OAUTH_SCOPE}`;

  return NextResponse.redirect(url, 302);
}

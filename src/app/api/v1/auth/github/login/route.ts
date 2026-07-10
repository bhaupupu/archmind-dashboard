import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getEnv } from '@/lib/env';

// 'repo' is required to read file contents (including private repos) for graph/impact
// analysis — see the disclosure on the login page and Privacy Policy §1.
const GITHUB_OAUTH_SCOPE = 'repo';

export async function GET(req: NextRequest) {
  try {
    const { GITHUB_CLIENT_ID, BASE_URL } = getEnv();
    const redirectUri = encodeURIComponent(`${BASE_URL}/api/v1/auth/github/callback`);

    // OAuth CSRF protection: the callback rejects any response whose state
    // doesn't match this cookie, so an attacker can't splice their own
    // authorization code into a victim's session (login CSRF / session fixation).
    const state = crypto.randomBytes(24).toString('hex');
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${GITHUB_OAUTH_SCOPE}&state=${state}`;

    const res = NextResponse.redirect(url, 302);
    res.cookies.set('atlas_oauth_state', state, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // must survive the top-level redirect back from github.com
      maxAge: 600,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: 'config_error', message: (err as Error).message }, { status: 500 });
  }
}

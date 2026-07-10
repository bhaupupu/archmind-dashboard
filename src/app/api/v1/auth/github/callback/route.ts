import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { getEnv } from '@/lib/env';
import { signSessionToken } from '../../../auth';

// OAuth failures land a real person on this URL, so every error path redirects
// back to /login with a machine-readable code the login page can explain —
// never a dead JSON page.
function loginRedirect(baseUrl: string, error: string): NextResponse {
  const res = NextResponse.redirect(new URL(`/login?error=${error}`, baseUrl), 302);
  res.cookies.set('atlas_oauth_state', '', { path: '/', maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  let env;
  try {
    env = getEnv();
  } catch (err) {
    // Misconfigured deployment: no BASE_URL to redirect to, so surface the
    // validation error directly (same behavior as the login route).
    return NextResponse.json({ error: 'config_error', message: (err as Error).message }, { status: 500 });
  }
  const { BASE_URL, GITHUB_CLIENT_ID: clientId, GITHUB_CLIENT_SECRET: clientSecret } = env;

  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) return loginRedirect(BASE_URL, 'missing_code');

    // CSRF check: state must match the value we set when starting the flow.
    const state = req.nextUrl.searchParams.get('state');
    const expectedState = req.cookies.get('atlas_oauth_state')?.value;
    if (!state || !expectedState || state !== expectedState) {
      return loginRedirect(BASE_URL, 'state_mismatch');
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    const tokenData = await tokenRes.json() as { access_token?: string, error?: string };
    if (!tokenRes.ok || !tokenData.access_token) {
      return loginRedirect(BASE_URL, 'oauth_failed');
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': 'Atlas-API'
      }
    });
    if (!userRes.ok) {
      return loginRedirect(BASE_URL, 'github_user_failed');
    }

    const userData = await userRes.json() as { id: number, login: string };
    if (typeof userData.id !== 'number' || !userData.login) {
      return loginRedirect(BASE_URL, 'github_user_failed');
    }

    // UPSERT USER IN DATABASE
    const encryptedToken = encrypt(tokenData.access_token);
    let user = await prisma.user.findUnique({ where: { githubId: userData.id } });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { username: userData.login, githubToken: encryptedToken }
      });
    } else {
      user = await prisma.user.create({
        data: {
          githubId: userData.id,
          username: userData.login,
          githubToken: encryptedToken
        }
      });
    }

    const token = signSessionToken({ sub: user.id, username: userData.login });

    const res = NextResponse.redirect(new URL('/onboarding', BASE_URL), 302);
    res.cookies.set('atlas_session', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 604800
    });
    res.cookies.set('atlas_oauth_state', '', { path: '/', maxAge: 0 });

    return res;
  } catch (err) {
    console.error('[auth/callback] OAuth flow failed', err);
    return loginRedirect(BASE_URL, 'internal_error');
  }
}

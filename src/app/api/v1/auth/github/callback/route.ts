import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { getEnv } from '@/lib/env';
import { signSessionToken } from '../../../auth';


export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'missing_code' }, { status: 400 });

  try {
    const { BASE_URL, GITHUB_CLIENT_ID: clientId, GITHUB_CLIENT_SECRET: clientSecret } = getEnv();
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
    if (!tokenData.access_token) {
      return NextResponse.json({ error: 'oauth_failed', details: tokenData }, { status: 400 });
    }
    
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': 'Atlas-API'
      }
    });
    
    const userData = await userRes.json() as { id: number, login: string };
    
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
      sameSite: 'lax',
      maxAge: 604800
    });
    
    return res;
  } catch (err) {
    return NextResponse.json({ error: 'internal_error', message: (err as Error).message }, { status: 500 });
  }
}

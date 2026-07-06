import { NextRequest, NextResponse } from 'next/server';
import { loadConfig } from '../../../../../../../packages/config/src/index';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-do-not-use-in-prod';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'missing_code' }, { status: 400 });
  
  const cfg = loadConfig();
  if (!cfg.github?.clientId || !cfg.github?.clientSecret) {
    return NextResponse.json({ error: 'github_not_configured' }, { status: 500 });
  }
  
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: cfg.github.clientId,
        client_secret: cfg.github.clientSecret,
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
    
    const token = jwt.sign(
      { sub: userData.login, gh_token: tokenData.access_token },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    const res = NextResponse.redirect(BASE_URL, 302);
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

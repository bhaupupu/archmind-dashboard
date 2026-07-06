import { NextRequest, NextResponse } from 'next/server';
import { loadConfig } from '../../../../../../../../../packages/config/src/index';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const cfg = loadConfig();
  if (!cfg.github?.clientId) {
    return NextResponse.json({ error: 'github_not_configured' }, { status: 500 });
  }
  const redirectUri = encodeURIComponent(`${BASE_URL}/api/v1/auth/github/callback`);
  const url = `https://github.com/login/oauth/authorize?client_id=${cfg.github.clientId}&redirect_uri=${redirectUri}`;
  
  return NextResponse.redirect(url, 302);
}

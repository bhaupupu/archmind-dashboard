import { NextRequest, NextResponse } from 'next/server';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-do-not-use-in-prod';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get('role') || 'admin';
  const tenantId = req.nextUrl.searchParams.get('tenantId') || '00000000-0000-0000-0000-000000000000';
  const userId = '22222222-2222-2222-2222-222222222222';
  
  // Notice we provide a dummy gh_token so the GitHub graph can be built with the user's real token if they paste it in ENV, or they just test locally
  const token = jwt.sign({ 
    sub: tenantId, 
    user_id: userId, 
    role,
    gh_token: process.env.GITHUB_TOKEN 
  }, JWT_SECRET, { expiresIn: '1h' });
  
  const res = NextResponse.redirect(BASE_URL, 302);
  res.cookies.set('atlas_session', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 3600
  });
  
  return res;
}

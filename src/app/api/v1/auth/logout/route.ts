import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Create a response that redirects to the landing page
  const res = NextResponse.redirect(new URL('/', req.url));
  
  // Clear the atlas_session cookie
  res.cookies.set('atlas_session', '', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0 // instantly expire
  });

  return res;
}

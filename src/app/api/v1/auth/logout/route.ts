import { NextRequest, NextResponse } from 'next/server';

// Logout is a POST: a GET logout is triggerable cross-site via <img src> and by
// link prefetchers (Next's <Link> prefetch would sign users out on hover).
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });

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

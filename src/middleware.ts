import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('atlas_session');
  
  if (request.nextUrl.pathname === '/login') {
    if (token) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  // Denylist, not allowlist: every UI route requires auth except these public pages.
  const publicUIRoutes = ['/login', '/terms', '/privacy'];
  const isProtectedUI = !request.nextUrl.pathname.startsWith('/api/') &&
                        !publicUIRoutes.includes(request.nextUrl.pathname);
  const isProtectedApi = request.nextUrl.pathname.startsWith('/api/v1/') &&
                         !request.nextUrl.pathname.startsWith('/api/v1/auth/github') &&
                         request.nextUrl.pathname !== '/api/v1/health';
  
  if ((isProtectedUI || isProtectedApi) && !token) {
    if (isProtectedApi) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

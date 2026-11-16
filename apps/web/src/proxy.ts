import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route guard (Next.js 16 "proxy", formerly middleware). It only checks that a session
 * *may* exist — the API verifies every request. Unauthenticated users go to /login.
 */
const PUBLIC = ['/login', '/register', '/forgot-password', '/reset-password', '/accept-invite'];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = req.cookies.has('has_session') || req.cookies.has('access_token');

  if (!isPublic && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (isPublic && hasSession && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API proxying, health, Next internals and static files.
  matcher: ['/((?!api|health|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

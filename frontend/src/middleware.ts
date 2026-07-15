import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side route protection middleware.
 * Runs at the Edge before any page is rendered.
 * The wme_token httpOnly cookie is readable here (server-side only).
 */
export function middleware(req: NextRequest) {
  const token = req.cookies.get('wme_token')?.value;
  const userCookie = req.cookies.get('wme_user')?.value;
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isBuyerPage = pathname.startsWith('/buyer');
  const isTalentPage = pathname.startsWith('/talent');

  // If no session, redirect all protected routes to login
  if (!token || !userCookie) {
    if (!isAuthPage) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.next();
  }

  // Parse role from the user cookie
  let role: string | null = null;
  try {
    role = JSON.parse(decodeURIComponent(userCookie))?.role ?? null;
  } catch {
    // Corrupted cookie — treat as unauthenticated
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete('wme_token');
    res.cookies.delete('wme_user');
    return res;
  }

  // Authenticated users don't need to see login/register
  if (isAuthPage) {
    if (role === 'BUYER') return NextResponse.redirect(new URL('/buyer', req.url));
    if (role === 'TALENT') return NextResponse.redirect(new URL('/talent', req.url));
    return NextResponse.next();
  }

  // Role-based access enforcement
  if (isBuyerPage && role !== 'BUYER' && role !== 'ADMIN' && role !== 'AGENT') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isTalentPage && role !== 'TALENT' && role !== 'ADMIN' && role !== 'AGENT') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Apply to all routes except static assets and Next internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};

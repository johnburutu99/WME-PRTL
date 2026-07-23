import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Middleware — runs at the Edge on every request.
 * 1. Refreshes the Supabase session (keeps JWT alive).
 * 2. Enforces route-level auth and role-based access.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

<<<<<<< HEAD
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  const isBuyerPage  = pathname.startsWith('/buyer');
=======
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isVerificationPage = pathname.startsWith('/auth/check-email') || pathname.startsWith('/auth/callback');
  const isBuyerPage = pathname.startsWith('/buyer');
>>>>>>> 7e9895255cda77ae73651a8bd219885a222727ce
  const isTalentPage = pathname.startsWith('/talent');
  const isAgentPage  = pathname.startsWith('/agent');

  // Always refresh session — Supabase SSR manages the cookie rotation
  const { supabaseResponse, user, appRole } = await updateSession(req);

  // Not authenticated
  if (!user) {
    if (!isAuthPage && !isVerificationPage) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return supabaseResponse;
  }

<<<<<<< HEAD
  // Role from user_metadata (set at registration and stored in JWT)
  const role: string = (user.user_metadata?.role as string) ?? '';

  // Authenticated users skip auth pages — redirect to their portal
=======
  // The application profile is the authoritative role source. Supabase metadata
  // is only used for identity and must not grant portal access.
  const role = appRole ?? '';

>>>>>>> 7e9895255cda77ae73651a8bd219885a222727ce
  if (isAuthPage) {
    if (role === 'BUYER')                             return NextResponse.redirect(new URL('/buyer', req.url));
    if (role === 'TALENT')                            return NextResponse.redirect(new URL('/talent', req.url));
    if (role === 'AGENT' || role === 'ADMIN')         return NextResponse.redirect(new URL('/agent', req.url));
    return supabaseResponse;
  }

<<<<<<< HEAD
  // Role-gated route protection
  if (isBuyerPage  && !['BUYER',  'ADMIN', 'AGENT'].includes(role)) return NextResponse.redirect(new URL('/login', req.url));
  if (isTalentPage && !['TALENT', 'ADMIN', 'AGENT'].includes(role)) return NextResponse.redirect(new URL('/login', req.url));
  if (isAgentPage  && !['AGENT',  'ADMIN'          ].includes(role)) return NextResponse.redirect(new URL('/login', req.url));
=======
  if (isBuyerPage && role !== 'BUYER') {
    return NextResponse.redirect(new URL(role === 'TALENT' ? '/talent' : '/login', req.url));
  }
  if (isTalentPage && role !== 'TALENT') {
    return NextResponse.redirect(new URL(role === 'BUYER' ? '/buyer' : '/login', req.url));
  }
>>>>>>> 7e9895255cda77ae73651a8bd219885a222727ce

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/).*)'],
};

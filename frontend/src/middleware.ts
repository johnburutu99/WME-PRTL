import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Middleware — runs at the Edge on every request.
 * 1. Refreshes the Supabase session (keeps JWT alive).
 * 2. Enforces route-level auth and role-based access.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isVerificationPage = pathname.startsWith('/auth/check-email') || pathname.startsWith('/auth/callback');
  const isBuyerPage = pathname.startsWith('/buyer');
  const isTalentPage = pathname.startsWith('/talent');

  // Always refresh session — Supabase SSR manages the cookie rotation
  const { supabaseResponse, user, appRole } = await updateSession(req);

  // Not authenticated
  if (!user) {
    if (!isAuthPage && !isVerificationPage) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return supabaseResponse;
  }

  // The application profile is the authoritative role source. Supabase metadata
  // is only used for identity and must not grant portal access.
  const role = appRole ?? '';

  if (isAuthPage) {
    if (role === 'BUYER') return NextResponse.redirect(new URL('/buyer', req.url));
    if (role === 'TALENT') return NextResponse.redirect(new URL('/talent', req.url));
    return supabaseResponse;
  }

  if (isBuyerPage && role !== 'BUYER') {
    return NextResponse.redirect(new URL(role === 'TALENT' ? '/talent' : '/login', req.url));
  }
  if (isTalentPage && role !== 'TALENT') {
    return NextResponse.redirect(new URL(role === 'BUYER' ? '/buyer' : '/login', req.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/).*)'],
};

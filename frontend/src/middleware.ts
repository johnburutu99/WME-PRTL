import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Middleware — runs at the Edge on every request.
 * 1. Refreshes the Supabase session (keeps JWT alive).
 * 2. Enforces route-level auth and role-based access.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  const isBuyerPage  = pathname.startsWith('/buyer');
  const isTalentPage = pathname.startsWith('/talent');
  const isAgentPage  = pathname.startsWith('/agent');

  // Always refresh session — Supabase SSR manages the cookie rotation
  const { supabaseResponse, user } = await updateSession(req);

  // Not authenticated
  if (!user) {
    if (!isAuthPage) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return supabaseResponse;
  }

  // Role from user_metadata (set at registration and stored in JWT)
  const role: string = (user.user_metadata?.role as string) ?? '';

  // Authenticated users skip auth pages — redirect to their portal
  if (isAuthPage) {
    if (role === 'BUYER')                             return NextResponse.redirect(new URL('/buyer', req.url));
    if (role === 'TALENT')                            return NextResponse.redirect(new URL('/talent', req.url));
    if (role === 'AGENT' || role === 'ADMIN')         return NextResponse.redirect(new URL('/agent', req.url));
    return supabaseResponse;
  }

  // Role-gated route protection
  if (isBuyerPage  && !['BUYER',  'ADMIN', 'AGENT'].includes(role)) return NextResponse.redirect(new URL('/login', req.url));
  if (isTalentPage && !['TALENT', 'ADMIN', 'AGENT'].includes(role)) return NextResponse.redirect(new URL('/login', req.url));
  if (isAgentPage  && !['AGENT',  'ADMIN'          ].includes(role)) return NextResponse.redirect(new URL('/login', req.url));

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/).*)'],
};

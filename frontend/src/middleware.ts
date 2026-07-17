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
  const isBuyerPage = pathname.startsWith('/buyer');
  const isTalentPage = pathname.startsWith('/talent');

  // Always refresh session — Supabase SSR manages the cookie rotation
  const { supabaseResponse, user } = await updateSession(req);

  // Not authenticated
  if (!user) {
    if (!isAuthPage) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return supabaseResponse;
  }

  // Read role from the custom JWT claim embedded by custom_access_token_hook
  const jwt = user.app_metadata; // available server-side from getUser()
  // Role is in user_metadata from our signUp options, and custom claim in JWT
  // We'll read it from user_metadata as the safe server-side source
  const role: string = (user.user_metadata?.role as string) ?? '';

  // Authenticated users skip auth pages
  if (isAuthPage) {
    if (role === 'BUYER') return NextResponse.redirect(new URL('/buyer', req.url));
    if (role === 'TALENT') return NextResponse.redirect(new URL('/talent', req.url));
    return supabaseResponse;
  }

  // Role-gated route protection
  if (isBuyerPage && !['BUYER', 'ADMIN', 'AGENT'].includes(role)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (isTalentPage && !['TALENT', 'ADMIN', 'AGENT'].includes(role)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/).*)'],
};

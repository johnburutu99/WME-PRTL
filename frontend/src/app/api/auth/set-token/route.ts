import { NextRequest, NextResponse } from 'next/server';

const IS_PROD = process.env.NODE_ENV === 'production';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * POST /api/auth/set-token
 * Receives { token, user } from the login/register flow and stores the JWT
 * in an httpOnly, Secure, SameSite=Strict cookie — never exposed to JavaScript.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.token || !body?.user) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set('wme_token', body.token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });

  // Store non-sensitive user profile in a separate readable cookie for the UI
  res.cookies.set('wme_user', JSON.stringify(body.user), {
    httpOnly: false,   // readable by JS for UI rendering only — no sensitive data
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });

  return res;
}

/**
 * DELETE /api/auth/set-token
 * Clears both auth cookies on logout.
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('wme_token');
  res.cookies.delete('wme_user');
  return res;
}

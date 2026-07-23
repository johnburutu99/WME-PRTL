import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/set-token
 * Exchanges an access_token (e.g. from a magic link) for a server-side session cookie.
 * Used as an intermediary for OAuth and magic-link flows when the client can't
 * set cookies directly (e.g. server-to-server callbacks).
 *
 * Body: { access_token: string, refresh_token: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { access_token, refresh_token } = await req.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'access_token and refresh_token are required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error || !data.session) {
      return NextResponse.json(
        { error: error?.message ?? 'Invalid token' },
        { status: 401 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

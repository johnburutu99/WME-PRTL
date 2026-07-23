import { NextRequest, NextResponse } from 'next/server';

/**
 * API Proxy — /api/proxy/[...path]
 *
 * This route is intentionally disabled. All data access has been migrated
 * to Supabase server actions (src/lib/actions/) and Edge Functions.
 * The BACKEND_API_URL env var and this proxy are no longer needed.
 *
 * If a future external API integration is required, implement it here
 * by forwarding requests to process.env.BACKEND_API_URL with proper
 * authentication headers and input validation.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Proxy endpoint not active. Use Supabase server actions.' },
    { status: 501 },
  );
}

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Proxy endpoint not active. Use Supabase server actions.' },
    { status: 501 },
  );
}

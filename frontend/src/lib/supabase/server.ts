import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client (Server Components, Server Actions, Route Handlers).
 * Uses the SERVICE ROLE KEY so server actions can bypass RLS when needed
 * (e.g. inserting a User row during registration before the session exists).
 * The publishable key is used for browser-side clients only.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side Supabase operations');
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — middleware handles session refresh.
          }
        },
      },
    },
  );
}

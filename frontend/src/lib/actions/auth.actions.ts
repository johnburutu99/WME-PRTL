'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// ─── Validation schemas ────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['BUYER', 'TALENT']).default('BUYER'),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ResetRequestSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordSchema = z.object({
  password: z.string().min(8),
});

export type AuthActionResult = { error: string } | { success: true };

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerAction(formData: {
  email: string;
  password: string;
  name: string;
  role: 'BUYER' | 'TALENT';
}): Promise<AuthActionResult> {
  const parsed = RegisterSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { email, password, name, role } = parsed.data;

  const supabase = await createClient();

  // 1. Create the Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, role },
      emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
        : undefined,
    },
  });

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Registration failed' };
  }

  // 2. Insert the corresponding app User row linked to the auth user
  const { error: insertError } = await supabase
    .from('User')
    .insert({
      id: crypto.randomUUID(),
      email,
      name,
      password: '', // Auth is handled by Supabase Auth — no bcrypt hash stored
      role,
      auth_user_id: authData.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

  if (insertError) {
    // Clean up the auth user if app row insertion failed
    await supabase.auth.admin?.deleteUser(authData.user.id);
    return { error: 'Failed to create user profile. Please try again.' };
  }

  return { success: true };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginAction(formData: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const parsed = LoginSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: 'Invalid email or password format' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: 'Invalid credentials' };
  }

  return { success: true };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// ─── Request password reset email ────────────────────────────────────────────

export async function requestPasswordResetAction(formData: {
  email: string;
}): Promise<AuthActionResult> {
  const parsed = ResetRequestSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: 'Please enter a valid email address.' };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  // Always return success to prevent email enumeration
  if (error) {
    console.error('[resetPassword] Error sending reset email:', error.message);
  }

  return { success: true };
}

// ─── Update password (called from /reset-password after magic link) ──────────

export async function updatePasswordAction(formData: {
  password: string;
}): Promise<AuthActionResult> {
  const parsed = ResetPasswordSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

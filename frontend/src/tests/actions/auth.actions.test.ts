import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSignUp, mockSignInWithPassword, mockResetPasswordForEmail,
  mockUpdateUser, mockFromInsert, mockAdminDeleteUser,
} = vi.hoisted(() => ({
  mockSignUp:                  vi.fn(),
  mockSignInWithPassword:      vi.fn(),
  mockResetPasswordForEmail:   vi.fn(),
  mockUpdateUser:              vi.fn(),
  mockFromInsert:              vi.fn(),
  mockAdminDeleteUser:         vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signUp:                mockSignUp,
      signInWithPassword:    mockSignInWithPassword,
      signOut:               vi.fn(),
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser:            mockUpdateUser,
      admin: { deleteUser:   mockAdminDeleteUser },
    },
    from: () => ({ insert: mockFromInsert }),
  }),
}));

import { registerAction, loginAction, requestPasswordResetAction, updatePasswordAction } from '@/lib/actions/auth.actions';

// ─── registerAction ───────────────────────────────────────────────────────────
describe('registerAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('errors on invalid email', async () => {
    const r = await registerAction({ email: 'bad', password: 'pass1234', name: 'Alice', role: 'BUYER' });
    expect('error' in r).toBe(true);
  });
  it('errors on password < 8 chars', async () => {
    const r = await registerAction({ email: 'a@b.com', password: 'short', name: 'Alice', role: 'BUYER' });
    expect('error' in r).toBe(true);
  });
  it('errors on empty name', async () => {
    const r = await registerAction({ email: 'a@b.com', password: 'pass1234', name: '', role: 'BUYER' });
    expect('error' in r).toBe(true);
  });
  it('propagates Supabase signUp error', async () => {
    mockSignUp.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Email already registered' } });
    const r = await registerAction({ email: 'x@y.com', password: 'pass1234', name: 'Bob', role: 'BUYER' });
    expect('error' in r && r.error).toBe('Email already registered');
  });
  it('cleans up auth user when User insert fails', async () => {
    mockSignUp.mockResolvedValueOnce({ data: { user: { id: 'auth-1' } }, error: null });
    mockFromInsert.mockResolvedValueOnce({ error: { message: 'Insert failed' } });
    const r = await registerAction({ email: 'x@y.com', password: 'pass1234', name: 'Bob', role: 'BUYER' });
    expect('error' in r).toBe(true);
    expect(mockAdminDeleteUser).toHaveBeenCalledWith('auth-1');
  });
  it('returns success on valid BUYER registration', async () => {
    mockSignUp.mockResolvedValueOnce({ data: { user: { id: 'auth-2' } }, error: null });
    mockFromInsert.mockResolvedValueOnce({ error: null });
    const r = await registerAction({ email: 'new@wme.com', password: 'secure123', name: 'Alice', role: 'BUYER' });
    expect('success' in r).toBe(true);
  });
  it('passes role to Supabase user metadata', async () => {
    mockSignUp.mockResolvedValueOnce({ data: { user: { id: 'auth-3' } }, error: null });
    mockFromInsert.mockResolvedValueOnce({ error: null });
    await registerAction({ email: 'dj@wme.com', password: 'djpass123', name: 'DJ Spark', role: 'TALENT' });
    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({
      options: { data: { name: 'DJ Spark', role: 'TALENT' } },
    }));
  });
});

// ─── loginAction ─────────────────────────────────────────────────────────────
describe('loginAction', () => {
  beforeEach(() => vi.clearAllMocks());
  it('errors on invalid email format', async () => {
    const r = await loginAction({ email: 'not-email', password: 'pass' });
    expect('error' in r && r.error).toBe('Invalid email or password format');
  });
  it('errors when Supabase returns auth error', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'Bad credentials' } });
    const r = await loginAction({ email: 'a@b.com', password: 'wrong' });
    expect('error' in r && r.error).toBe('Invalid credentials');
  });
  it('returns success on valid credentials', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    const r = await loginAction({ email: 'user@wme.com', password: 'correct' });
    expect('success' in r).toBe(true);
  });
  it('calls signInWithPassword with exact credentials', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    await loginAction({ email: 'agent@wme.com', password: 'agentpass' });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'agent@wme.com', password: 'agentpass' });
  });
});

// ─── requestPasswordResetAction ───────────────────────────────────────────────
describe('requestPasswordResetAction', () => {
  beforeEach(() => vi.clearAllMocks());
  it('errors on invalid email', async () => {
    const r = await requestPasswordResetAction({ email: 'bad-email' });
    expect('error' in r).toBe(true);
  });
  it('always returns success to prevent enumeration (even for unknown emails)', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'User not found' } });
    const r = await requestPasswordResetAction({ email: 'ghost@wme.com' });
    expect('success' in r).toBe(true);
  });
  it('returns success for real email', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const r = await requestPasswordResetAction({ email: 'real@wme.com' });
    expect('success' in r).toBe(true);
  });
  it('redirectTo contains /reset-password', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
    await requestPasswordResetAction({ email: 'u@wme.com' });
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('u@wme.com', expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') }));
  });
});

// ─── updatePasswordAction ─────────────────────────────────────────────────────
describe('updatePasswordAction', () => {
  beforeEach(() => vi.clearAllMocks());
  it('errors on password < 8 chars', async () => {
    const r = await updatePasswordAction({ password: '1234567' });
    expect('error' in r && r.error).toBe('Password must be at least 8 characters.');
  });
  it('propagates Supabase updateUser error', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: { message: 'Session expired' } });
    const r = await updatePasswordAction({ password: 'newpass123' });
    expect('error' in r && r.error).toBe('Session expired');
  });
  it('returns success on valid password', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: null });
    const r = await updatePasswordAction({ password: 'newsecure123' });
    expect('success' in r).toBe(true);
  });
});

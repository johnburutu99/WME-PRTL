import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mock updateSession ───────────────────────────────────────────────────────
const mockUpdateSession = vi.fn();

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: mockUpdateSession,
}));

// Import middleware AFTER mocking
const { middleware } = await import('@/middleware');

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

function supabaseResponse() {
  return NextResponse.next();
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('middleware — unauthenticated user', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects unauthenticated user from /buyer to /login', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: null });
    const res = await middleware(makeRequest('/buyer'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirects unauthenticated user from /talent to /login', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: null });
    const res = await middleware(makeRequest('/talent'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirects unauthenticated user from /agent to /login', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: null });
    const res = await middleware(makeRequest('/agent'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('allows unauthenticated access to /login', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: null });
    const res = await middleware(makeRequest('/login'));
    expect(res.status).not.toBe(307);
  });

  it('allows unauthenticated access to /register', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: null });
    const res = await middleware(makeRequest('/register'));
    expect(res.status).not.toBe(307);
  });

  it('allows unauthenticated access to /forgot-password', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: null });
    const res = await middleware(makeRequest('/forgot-password'));
    expect(res.status).not.toBe(307);
  });

  it('allows unauthenticated access to /reset-password', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: null });
    const res = await middleware(makeRequest('/reset-password'));
    expect(res.status).not.toBe(307);
  });
});

describe('middleware — authenticated BUYER', () => {
  const buyerUser = { user_metadata: { role: 'BUYER' } };
  beforeEach(() => vi.clearAllMocks());

  it('allows BUYER to access /buyer', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: buyerUser });
    const res = await middleware(makeRequest('/buyer'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects BUYER away from /login to /buyer', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: buyerUser });
    const res = await middleware(makeRequest('/login'));
    expect(res.headers.get('location')).toContain('/buyer');
  });

  it('redirects BUYER away from /register to /buyer', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: buyerUser });
    const res = await middleware(makeRequest('/register'));
    expect(res.headers.get('location')).toContain('/buyer');
  });

  it('blocks BUYER from /talent', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: buyerUser });
    const res = await middleware(makeRequest('/talent'));
    expect(res.headers.get('location')).toContain('/login');
  });

  it('blocks BUYER from /agent', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: buyerUser });
    const res = await middleware(makeRequest('/agent'));
    expect(res.headers.get('location')).toContain('/login');
  });
});

describe('middleware — authenticated TALENT', () => {
  const talentUser = { user_metadata: { role: 'TALENT' } };
  beforeEach(() => vi.clearAllMocks());

  it('allows TALENT to access /talent', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: talentUser });
    const res = await middleware(makeRequest('/talent'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects TALENT away from /login to /talent', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: talentUser });
    const res = await middleware(makeRequest('/login'));
    expect(res.headers.get('location')).toContain('/talent');
  });

  it('blocks TALENT from /buyer', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: talentUser });
    const res = await middleware(makeRequest('/buyer'));
    expect(res.headers.get('location')).toContain('/login');
  });

  it('blocks TALENT from /agent', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: talentUser });
    const res = await middleware(makeRequest('/agent'));
    expect(res.headers.get('location')).toContain('/login');
  });
});

describe('middleware — authenticated AGENT', () => {
  const agentUser = { user_metadata: { role: 'AGENT' } };
  beforeEach(() => vi.clearAllMocks());

  it('allows AGENT to access /agent', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: agentUser });
    const res = await middleware(makeRequest('/agent'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows AGENT to access /buyer', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: agentUser });
    const res = await middleware(makeRequest('/buyer'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows AGENT to access /talent', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: agentUser });
    const res = await middleware(makeRequest('/talent'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects AGENT away from /login to /agent', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: agentUser });
    const res = await middleware(makeRequest('/login'));
    expect(res.headers.get('location')).toContain('/agent');
  });
});

describe('middleware — authenticated ADMIN', () => {
  const adminUser = { user_metadata: { role: 'ADMIN' } };
  beforeEach(() => vi.clearAllMocks());

  it('allows ADMIN to access /agent', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: adminUser });
    const res = await middleware(makeRequest('/agent'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows ADMIN to access /buyer', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: adminUser });
    const res = await middleware(makeRequest('/buyer'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows ADMIN to access /talent', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: adminUser });
    const res = await middleware(makeRequest('/talent'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects ADMIN away from /login to /agent', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: supabaseResponse(), user: adminUser });
    const res = await middleware(makeRequest('/login'));
    expect(res.headers.get('location')).toContain('/agent');
  });
});

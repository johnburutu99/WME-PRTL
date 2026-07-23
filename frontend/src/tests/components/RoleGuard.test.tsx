import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoleGuard from '@/components/RoleGuard';

const mockPush    = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn() }),
  redirect: vi.fn(),
}));

// ─── AuthContext mock helpers ─────────────────────────────────────────────────
let mockUser: unknown = null;
let mockLoading = false;

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: mockLoading, logout: vi.fn() }),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('RoleGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockLoading = false;
  });

  it('shows loading spinner while auth is loading', () => {
    mockLoading = true;
    render(
      <RoleGuard allowedRoles={['BUYER']}>
        <div>Protected content</div>
      </RoleGuard>,
    );
    expect(screen.getByText(/verifying wme credentials/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirects to /login when user is not authenticated', () => {
    mockUser = null;
    render(
      <RoleGuard allowedRoles={['BUYER']}>
        <div>Protected content</div>
      </RoleGuard>,
    );
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('renders children when user has an allowed role', () => {
    mockUser = { id: '1', role: 'BUYER', email: 'b@test.com', name: 'Alice', authId: 'a1' };
    render(
      <RoleGuard allowedRoles={['BUYER']}>
        <div>Protected content</div>
      </RoleGuard>,
    );
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('renders children for AGENT when AGENT is in allowedRoles', () => {
    mockUser = { id: '2', role: 'AGENT', email: 'a@test.com', name: 'Agent', authId: 'a2' };
    render(
      <RoleGuard allowedRoles={['AGENT', 'ADMIN']}>
        <div>Agent content</div>
      </RoleGuard>,
    );
    expect(screen.getByText('Agent content')).toBeInTheDocument();
  });

  it('redirects TALENT to /talent when accessing BUYER-only route', () => {
    mockUser = { id: '3', role: 'TALENT', email: 't@test.com', name: 'Talent', authId: 'a3' };
    render(
      <RoleGuard allowedRoles={['BUYER']}>
        <div>Buyer content</div>
      </RoleGuard>,
    );
    expect(mockPush).toHaveBeenCalledWith('/talent');
    expect(screen.queryByText('Buyer content')).not.toBeInTheDocument();
  });

  it('redirects BUYER to /buyer when accessing TALENT-only route', () => {
    mockUser = { id: '4', role: 'BUYER', email: 'b2@test.com', name: 'Buyer', authId: 'a4' };
    render(
      <RoleGuard allowedRoles={['TALENT']}>
        <div>Talent content</div>
      </RoleGuard>,
    );
    expect(mockPush).toHaveBeenCalledWith('/buyer');
  });

  it('redirects AGENT without portal access to /login', () => {
    mockUser = { id: '5', role: 'AGENT', email: 'ag@test.com', name: 'Agent', authId: 'a5' };
    render(
      <RoleGuard allowedRoles={['BUYER']}>
        <div>Buyer only</div>
      </RoleGuard>,
    );
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('accepts multiple allowed roles', () => {
    mockUser = { id: '6', role: 'ADMIN', email: 'ad@test.com', name: 'Admin', authId: 'a6' };
    render(
      <RoleGuard allowedRoles={['BUYER', 'AGENT', 'ADMIN']}>
        <div>Admin content</div>
      </RoleGuard>,
    );
    expect(screen.getByText('Admin content')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

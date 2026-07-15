'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export type UserRole = 'BUYER' | 'TALENT' | 'AGENT' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Read a cookie value by name — used only to hydrate non-sensitive user profile */
function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Hydrate user state from the readable profile cookie (no token exposure)
    const savedUser = getCookieValue('wme_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // Corrupted cookie — will be cleared on next logout or login
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (token: string, userData: User) => {
    // Store the JWT in an httpOnly cookie via our Next.js API route
    const res = await fetch('/api/auth/set-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, user: userData }),
    });

    if (!res.ok) {
      throw new Error('Failed to establish secure session');
    }

    setUser(userData);

    if (userData.role === 'BUYER') {
      router.push('/buyer');
    } else if (userData.role === 'TALENT') {
      router.push('/talent');
    } else {
      // AGENT / ADMIN — redirect to login until their portal is built
      router.push('/login');
    }
  }, [router]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/set-token', { method: 'DELETE' });
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

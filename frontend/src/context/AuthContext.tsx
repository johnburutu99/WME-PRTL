'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type UserRole = 'BUYER' | 'TALENT' | 'AGENT' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check localStorage on mount
    const savedToken = localStorage.getItem('wme_token');
    const savedUser = localStorage.getItem('wme_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        // Corrupted session
        localStorage.removeItem('wme_token');
        localStorage.removeItem('wme_user');
      }
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('wme_token', newToken);
    localStorage.setItem('wme_user', JSON.stringify(userData));

    // Optimistic redirect based on user role
    if (userData.role === 'BUYER') {
      router.push('/buyer');
    } else if (userData.role === 'TALENT') {
      router.push('/talent');
    } else {
      router.push('/buyer'); // fallback
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('wme_token');
    localStorage.removeItem('wme_user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
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

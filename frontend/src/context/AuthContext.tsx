'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export type UserRole = 'BUYER' | 'TALENT' | 'AGENT' | 'ADMIN';

export interface AppUser {
  id: string;           // app User.id (our UUID, not the auth UUID)
  email: string;
  name: string;
  role: UserRole;
  authId: string;       // Supabase Auth user id
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadAppUser = async (authUser: SupabaseUser) => {
    // Fetch the app-level User row linked to this auth session
    const { data } = await supabase
      .from('User')
      .select('id, email, name, role')
      .eq('auth_user_id', authUser.id)
      .single();

    if (data) {
      setUser({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role as UserRole,
        authId: authUser.id,
      });
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    // Hydrate on mount
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        loadAppUser(authUser).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await loadAppUser(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

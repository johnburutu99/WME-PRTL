'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export const dynamic = 'force-dynamic';

export default function RootIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === 'BUYER') {
          router.push('/buyer');
        } else if (user.role === 'TALENT') {
          router.push('/talent');
        } else if (user.role === 'AGENT' || user.role === 'ADMIN') {
          router.push('/agent');
        } else {
          router.push('/login');
        }
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-slate-400 font-medium animate-pulse">Resolving secure session coordinates...</p>
    </div>
  );
}

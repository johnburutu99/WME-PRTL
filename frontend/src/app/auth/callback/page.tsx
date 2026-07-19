'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, Loader } from 'lucide-react';

export default function EmailConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient();

        // The email confirmation is automatic via Supabase
        // Check if user is now authenticated
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          setStatus('error');
          setMessage('Email verification failed. Please try again or contact support.');
          setTimeout(() => router.push('/login'), 3000);
          return;
        }

        // Check if email is verified
        if (!user.email_confirmed_at) {
          setStatus('error');
          setMessage('Email confirmation pending. Please check your inbox again.');
          setTimeout(() => router.push('/login'), 3000);
          return;
        }

        // Email confirmed successfully
        setStatus('success');
        setMessage('Email verified successfully!');

        // Get user role from metadata or database
        const role = user.user_metadata?.role ?? 'BUYER';

        // Mark user as newly verified so dashboard can show welcome popup
        localStorage.setItem('newlyVerified', 'true');

        // Redirect to appropriate dashboard
        setTimeout(() => {
          if (role === 'TALENT') {
            router.push('/talent');
          } else {
            router.push('/buyer');
          }
        }, 1500);
      } catch (error) {
        console.error('[v0] Email callback error:', error);
        setStatus('error');
        setMessage('An error occurred. Please try again.');
        setTimeout(() => router.push('/login'), 3000);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-2xl p-8 shadow-2xl z-10">
        <div className="flex flex-col items-center">
          {status === 'loading' && (
            <>
              <Loader className="w-12 h-12 text-amber-500 animate-spin mb-4" />
              <h1 className="text-2xl font-bold text-slate-100 mb-2 text-center">Verifying Email</h1>
              <p className="text-slate-400 text-center">Please wait while we confirm your email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
              <h1 className="text-2xl font-bold text-slate-100 mb-2 text-center">Email Confirmed!</h1>
              <p className="text-slate-400 text-center mb-4">{message}</p>
              <p className="text-slate-500 text-sm text-center">Taking you to your dashboard...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <span className="text-2xl text-red-500">✕</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-100 mb-2 text-center">Verification Failed</h1>
              <p className="text-slate-400 text-center mb-4">{message}</p>
              <p className="text-slate-500 text-sm text-center">Redirecting to login...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

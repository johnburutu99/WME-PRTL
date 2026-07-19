'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-2xl p-8 shadow-2xl z-10">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
            <Mail className="w-8 h-8 text-amber-500" />
          </div>

          <h1 className="text-3xl font-bold text-slate-100 mb-2">Check Your Email</h1>
          <p className="text-slate-400 mb-6">
            We&apos;ve sent a confirmation link to <span className="font-semibold text-amber-400">{email}</span>
          </p>

          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 mb-6 w-full text-left space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 font-bold">1.</span>
              <div>
                <p className="text-slate-200 font-medium text-sm">Open your email</p>
                <p className="text-slate-500 text-xs">Check your inbox or spam folder</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-500 font-bold">2.</span>
              <div>
                <p className="text-slate-200 font-medium text-sm">Click the confirmation link</p>
                <p className="text-slate-500 text-xs">Look for the &quot;CONFIRM EMAIL&quot; button</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-500 font-bold">3.</span>
              <div>
                <p className="text-slate-200 font-medium text-sm">Welcome to WME Portal!</p>
                <p className="text-slate-500 text-xs">You&apos;ll be taken to your dashboard</p>
              </div>
            </div>
          </div>

          <div className="w-full space-y-3">
            <p className="text-sm text-slate-400">
              Didn&apos;t receive an email? Check your spam folder or try registering again.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 font-semibold text-sm transition-colors"
            >
              Try Registering Again
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 w-full">
            <p className="text-slate-500 text-xs">
              Already verified?{' '}
              <Link href="/login" className="text-amber-400 hover:underline font-medium">
                Go to Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    }>
      <CheckEmailContent />
    </Suspense>
  );
}

'use client';

import React, { useState } from 'react';
import { useAuth, UserRole } from '@/context/AuthContext';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

interface RegisterResponse {
  accessToken: string;
  user: { id: string; email: string; name: string; role: UserRole };
}

// Only public-facing roles are exposed — AGENT/ADMIN are internal only
const PUBLIC_ROLES: { value: 'BUYER' | 'TALENT'; label: string }[] = [
  { value: 'BUYER', label: 'Buyer (B2B Venue / Promoter)' },
  { value: 'TALENT', label: 'Talent (Internal Artist / Musician)' },
];

export default function RegisterPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'BUYER' | 'TALENT'>('BUYER');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post<RegisterResponse>('/auth/register', { email, password, name, role });
      await login(data.accessToken, data.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to reach the server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-2xl p-8 shadow-2xl z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
            WME PORTAL
          </div>
          <p className="text-slate-400 text-sm mt-2 text-center">
            Create Your Portal Account
          </p>
        </div>

        {error && (
          <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all text-sm placeholder-slate-600"
              placeholder="Alice Cooper"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Corporate Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all text-sm placeholder-slate-600"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Portal Access Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'BUYER' | 'TALENT')}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all text-sm"
            >
              {PUBLIC_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all text-sm placeholder-slate-600"
              placeholder="Min 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-amber-500/10 disabled:opacity-50 text-sm mt-2"
          >
            {loading ? 'Creating Account...' : 'Create Portal Account'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-400">
          <Link href="/login" className="text-amber-400 hover:underline text-xs uppercase tracking-wider font-semibold">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

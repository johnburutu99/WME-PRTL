'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon, DollarSign, TrendingUp,
  CheckCircle, XCircle, ShieldCheck, Briefcase, Menu, X, RefreshCw,
} from 'lucide-react';
import { getBookings, getLedger, respondToOffer } from '@/lib/actions/bookings.actions';
import type { Booking, BookingStatus, LedgerEntry } from '@/types/portal';

function getStatusColor(status: BookingStatus) {
  switch (status) {
    case 'CONFIRMED':      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'OFFER_PENDING':  return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'NDA_PENDING':
    case 'CONTRACT_PENDING': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'OFFER_REJECTED': return 'bg-red-500/15 text-red-400 border-red-500/30';
    default:               return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

function sumLedger(ledgers: LedgerEntry[], field: keyof LedgerEntry) {
  return ledgers.reduce((acc, l) => acc + Number(l[field] ?? 0), 0);
}

export default function TalentPortal() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'calendar' | 'offer-desk' | 'ledger'>('calendar');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ledgers, setLedgers] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'TALENT')) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const fetchPortalData = useCallback(async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const [bookingResult, ledgerResult] = await Promise.all([
        getBookings(),
        getLedger(),
      ]);
      if (bookingResult.error) setFetchError(bookingResult.error);
      else if (bookingResult.data) setBookings(bookingResult.data);
      if (ledgerResult.error) setFetchError(ledgerResult.error);
      else if (ledgerResult.data) setLedgers(ledgerResult.data);
    } catch {
      setFetchError('Failed to load portal data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'TALENT') fetchPortalData();
  }, [user, fetchPortalData]);

  const handleOfferResponse = async (bookingId: string, action: 'CONFIRMED' | 'OFFER_REJECTED') => {
    setActionLoading(bookingId);
    const result = await respondToOffer(bookingId, action);
    if (result.error) setFetchError(result.error);
    else fetchPortalData();
    setActionLoading(null);
  };

  const pendingOffers = bookings.filter(b => b.status === 'OFFER_PENDING');
  const totalGross = sumLedger(ledgers, 'grossEarnings');
  const totalCommission = sumLedger(ledgers, 'agencyCommission');
  const totalNet = sumLedger(ledgers, 'netPayout');

  const navItems = [
    { id: 'calendar' as const,   label: 'Unified Itinerary Engine', icon: CalendarIcon },
    { id: 'offer-desk' as const, label: 'Agent Offer Desk',         icon: Briefcase, badge: pendingOffers.length },
    { id: 'ledger' as const,     label: 'Financial Ledger',         icon: DollarSign },
  ];

  if (authLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      <header className="md:hidden h-16 bg-slate-900 border-b border-slate-800 px-6 flex justify-between items-center z-40 shrink-0">
        <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">WME TALENT</span>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle navigation" className="p-2 text-slate-400 hover:text-slate-100">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden" aria-hidden="true" />}

      <aside className={`fixed md:relative inset-y-0 left-0 w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between shrink-0 z-50 md:z-auto transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div>
          <div className="mb-8">
            <span className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">WME TALENT</span>
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded mt-2 w-max">Artist Portal (Internal)</div>
          </div>
          <nav className="space-y-2" aria-label="Portal navigation">
            {navItems.map(({ id, label, icon: Icon, badge }) => (
              <button key={id} onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all relative ${activeTab === id ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                aria-current={activeTab === id ? 'page' : undefined}>
                <Icon size={18} aria-hidden="true" />{label}
                {badge != null && badge > 0 && (
                  <span className="absolute right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center font-bold text-amber-500">{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="font-semibold text-sm truncate max-w-[150px]">{user?.name}</div>
              <div className="text-xs text-slate-500 truncate max-w-[150px]">{user?.role} Profile</div>
            </div>
          </div>
          <button onClick={logout} className="w-full bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 font-semibold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition-all">Sign Out</button>
        </div>
      </aside>

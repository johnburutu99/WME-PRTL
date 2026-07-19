'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon, DollarSign, TrendingUp,
  CheckCircle, XCircle, ShieldCheck, Briefcase, Menu, X, RefreshCw,
} from 'lucide-react';
import { WelcomePopup } from '@/components/WelcomePopup';
import { getBookings, getLedger, respondToOffer } from '@/lib/actions/bookings.actions';
import type { Booking, BookingStatus, LedgerEntry } from '@/types/portal';

function getStatusColor(status: BookingStatus) {
  switch (status) {
    case 'CONFIRMED':        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'OFFER_PENDING':    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'NDA_PENDING':
    case 'CONTRACT_PENDING': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'OFFER_REJECTED':   return 'bg-red-500/15 text-red-400 border-red-500/30';
    default:                 return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

function sumLedger(ledgers: LedgerEntry[], field: keyof LedgerEntry) {
  return ledgers.reduce((acc, l) => acc + Number(l[field] ?? 0), 0);
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TalentPortal() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab]       = useState<'calendar' | 'offer-desk' | 'ledger'>('calendar');
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [ledgers, setLedgers]           = useState<LedgerEntry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'TALENT')) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const fetchPortalData = useCallback(async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const [bookingResult, ledgerResult] = await Promise.all([getBookings(), getLedger()]);
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
    else await fetchPortalData();
    setActionLoading(null);
  };

  const pendingOffers  = bookings.filter(b => b.status === 'OFFER_PENDING');
  const totalGross     = sumLedger(ledgers, 'grossEarnings');
  const totalCommission = sumLedger(ledgers, 'agencyCommission');
  const totalNet       = sumLedger(ledgers, 'netPayout');

  const navItems = [
    { id: 'calendar'   as const, label: 'Unified Itinerary Engine', icon: CalendarIcon },
    { id: 'offer-desk' as const, label: 'Agent Offer Desk',         icon: Briefcase,    badge: pendingOffers.length },
    { id: 'ledger'     as const, label: 'Financial Ledger',         icon: DollarSign },
  ];

  if (authLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      <WelcomePopup />

      {/* ── Mobile header ── */}
      <header className="md:hidden h-16 bg-slate-900 border-b border-slate-800 px-6 flex justify-between items-center z-40 shrink-0">
        <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">WME TALENT</span>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle navigation" className="p-2 text-slate-400 hover:text-slate-100">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden" aria-hidden="true" />
      )}

      {/* ── Sidebar ── */}
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
                <Icon size={18} aria-hidden="true" />
                {label}
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

      {/* ── Main content ── */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">

        {fetchError && (
          <div role="alert" className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center justify-between text-sm">
            <span>{fetchError}</span>
            <button onClick={fetchPortalData} className="flex items-center gap-1 text-xs underline"><RefreshCw size={12} /> Retry</button>
          </div>
        )}

        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>

            {/* ──────────────── CALENDAR ──────────────── */}
            {activeTab === 'calendar' && (
              <div className="max-w-5xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Unified Itinerary Engine</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">Your performance agenda. Status advances from Hold to Confirmed upon deposit clearance.</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    <h2 className="text-lg font-bold">Performance Agenda</h2>
                    <div className="flex gap-4 text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />Confirmed Gigs</span>
                      <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />Negotiation Holds</span>
                    </div>
                  </div>

                  {bookings.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
                      <p className="text-slate-500 text-xs">No bookings on your itinerary yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bookings.map(b => (
                        <div key={b.id} className={`border p-5 rounded-xl flex flex-col justify-between transition-all hover:-translate-y-0.5 ${b.status === 'CONFIRMED' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-950 border-slate-800'}`}>
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-xs text-slate-500 font-mono">{new Date(b.eventDate).toLocaleDateString()}</span>
                              <span className={`border font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${getStatusColor(b.status)}`}>{b.status}</span>
                            </div>
                            <h3 className="font-bold text-base text-slate-100">{b.eventTitle}</h3>
                            <p className="text-slate-400 text-xs mt-1">{b.venueName}</p>
                            <p className="text-slate-500 text-xs mt-1">Capacity: {Number(b.venueCapacity).toLocaleString()} attendees</p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                            <span className="text-slate-400">Guarantee:</span>
                            <span className="font-bold text-amber-400">${Number(b.guaranteedBudget).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ──────────────── OFFER DESK ──────────────── */}
            {activeTab === 'offer-desk' && (
              <div className="max-w-4xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Agent Offer Desk</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">Agent-vetted deal memos. Approve or decline incoming bookings below.</p>
                </div>

                {pendingOffers.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
                    <CheckCircle className="text-emerald-500 mx-auto" size={40} />
                    <h2 className="text-lg font-bold">No Pending Deals</h2>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">All vetted invitations have been cleared. Check your itinerary for confirmed gigs.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {pendingOffers.map(offer => (
                      <div key={offer.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between gap-6">
                        <div className="space-y-4 flex-1">
                          <div>
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Vetted Offer (Hold)</span>
                            <h2 className="text-xl font-bold mt-2">{offer.eventTitle}</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Proposed by <span className="text-slate-300 font-semibold">{offer.buyer?.name || 'External Promoter'}</span>
                            </p>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                            <div><div className="text-slate-500">Event Date</div><div className="font-semibold text-slate-200 mt-0.5">{new Date(offer.eventDate).toLocaleDateString()}</div></div>
                            <div><div className="text-slate-500">Capacity</div><div className="font-semibold text-slate-200 mt-0.5">{Number(offer.venueCapacity).toLocaleString()} seats</div></div>
                            <div><div className="text-slate-500">Budget</div><div className="font-semibold text-amber-400 mt-0.5">${Number(offer.guaranteedBudget).toLocaleString()}</div></div>
                            <div><div className="text-slate-500">Commission</div><div className="font-semibold text-slate-200 mt-0.5">15%</div></div>
                          </div>

                          <div className="text-xs text-slate-400">
                            <span className="font-bold text-slate-300">Usage Rights: </span>{offer.usageRights}
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col justify-end items-stretch gap-3 shrink-0">
                          <button onClick={() => handleOfferResponse(offer.id, 'CONFIRMED')} disabled={actionLoading === offer.id}
                            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                            <CheckCircle size={16} />
                            {actionLoading === offer.id ? 'Processing...' : 'Approve Memo'}
                          </button>
                          <button onClick={() => handleOfferResponse(offer.id, 'OFFER_REJECTED')} disabled={actionLoading === offer.id}
                            className="bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 border border-red-500/20 font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                            <XCircle size={16} />
                            Decline Offer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ──────────────── LEDGER ──────────────── */}
            {activeTab === 'ledger' && (
              <div className="max-w-5xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Financial Ledger</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">Agency commissions, tax withholding, and net payout distributions.</p>
                </div>

                {/* Live KPI cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Gross Booking Revenue</div>
                    <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">${fmt(totalGross)}</div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1"><TrendingUp size={12} />Agency Certified</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Agency Commission (15%)</div>
                    <div className="text-3xl font-extrabold text-slate-200">${fmt(totalCommission)}</div>
                    <div className="text-[10px] text-slate-500">WME Trust Commission</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Net Payout</div>
                    <div className="text-3xl font-extrabold text-emerald-400">${fmt(totalNet)}</div>
                    <div className="text-[10px] text-amber-500 flex items-center gap-1 font-semibold">
                      <ShieldCheck size={12} />{ledgers.length > 0 ? 'Awaiting Wire Settlement' : 'No cleared payouts yet'}
                    </div>
                  </div>
                </div>

                {/* Ledger table */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-6 border-b border-slate-800">
                    <h2 className="text-lg font-bold">Trust Account Clearance Log</h2>
                    <p className="text-xs text-slate-500 mt-1">Direct integration tracking for client payouts.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 text-xs font-semibold uppercase tracking-widest">
                          <th className="py-4 px-6">Event</th>
                          <th className="py-4 px-6">Gross</th>
                          <th className="py-4 px-6">Commission (15%)</th>
                          <th className="py-4 px-6">Withholding (20%)</th>
                          <th className="py-4 px-6">Net Payout</th>
                          <th className="py-4 px-6">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                        {ledgers.length === 0 ? (
                          <tr><td colSpan={6} className="py-8 px-6 text-center text-xs text-slate-500">No cleared payouts in this trust account yet.</td></tr>
                        ) : ledgers.map(l => (
                          <tr key={l.id} className="hover:bg-slate-800/30 transition-all">
                            <td className="py-4 px-6">
                              <div className="font-semibold text-slate-100">{l.booking?.eventTitle}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{l.booking?.eventDate ? new Date(l.booking.eventDate).toLocaleDateString() : '—'} &bull; {l.booking?.venueName}</div>
                            </td>
                            <td className="py-4 px-6 font-semibold text-slate-200">${Number(l.grossEarnings).toLocaleString()}</td>
                            <td className="py-4 px-6 text-red-400">-${Number(l.agencyCommission).toLocaleString()}</td>
                            <td className="py-4 px-6 text-slate-400">-${Number(l.taxWithholding).toLocaleString()}</td>
                            <td className="py-4 px-6 text-emerald-400 font-bold">${Number(l.netPayout).toLocaleString()}</td>
                            <td className="py-4 px-6">
                              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded">{l.payoutStatus}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </main>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Briefcase, FileText, DollarSign, CheckCircle, XCircle,
  ChevronRight, Menu, X, RefreshCw, AlertTriangle, Users,
} from 'lucide-react';
import { getAllBookings, advanceBookingStatus } from '@/lib/actions/agent.actions';
import type { Booking, BookingStatus } from '@/types/portal';

const STATUS_FLOW: Record<string, BookingStatus> = {
  PENDING_REVIEW:   'OFFER_PENDING',
  OFFER_PENDING:    'NEGOTIATING',
  NEGOTIATING:      'NDA_PENDING',
  NDA_SIGNED:       'CONTRACT_PENDING',
  CONTRACT_SIGNED:  'AWAITING_DEPOSIT',
  AWAITING_DEPOSIT: 'CONFIRMED',
  CONFIRMED:        'COMPLETED',
};

const STATUS_ACTION_LABEL: Record<string, string> = {
  PENDING_REVIEW:   'Send to Talent',
  OFFER_PENDING:    'Mark Negotiating',
  NEGOTIATING:      'Trigger NDA',
  NDA_SIGNED:       'Send Contract',
  CONTRACT_SIGNED:  'Request Deposit',
  AWAITING_DEPOSIT: 'Confirm',
  CONFIRMED:        'Mark Completed',
};

function statusColor(s: BookingStatus) {
  const map: Record<string, string> = {
    PENDING_REVIEW:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
    OFFER_PENDING:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
    NEGOTIATING:      'bg-blue-500/15 text-blue-400 border-blue-500/30',
    NDA_PENDING:      'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    NDA_SIGNED:       'bg-teal-500/15 text-teal-400 border-teal-500/30',
    CONTRACT_PENDING: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    CONTRACT_SIGNED:  'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    AWAITING_DEPOSIT: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    CONFIRMED:        'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    COMPLETED:        'bg-green-500/15 text-green-400 border-green-500/30',
    OFFER_REJECTED:   'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return map[s] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30';
}

type Tab = 'pipeline' | 'active' | 'roster';

export default function AgentPortal() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('pipeline');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'AGENT' && user.role !== 'ADMIN'))) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const result = await getAllBookings();
      if (result.error) setFetchError(result.error);
      else if (result.data) setBookings(result.data);
    } catch {
      setFetchError('Failed to load bookings. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'AGENT' || user?.role === 'ADMIN') fetchData();
  }, [user, fetchData]);

  const handleAdvance = async (bookingId: string, currentStatus: BookingStatus) => {
    const next = STATUS_FLOW[currentStatus] as BookingStatus | undefined;
    if (!next) return;
    setActionLoading(bookingId);
    const result = await advanceBookingStatus(bookingId, next);
    if (result.error) setFetchError(result.error);
    else await fetchData();
    setActionLoading(null);
  };

  const handleReject = async (bookingId: string) => {
    setActionLoading(bookingId + '-reject');
    const result = await advanceBookingStatus(bookingId, 'OFFER_REJECTED');
    if (result.error) setFetchError(result.error);
    else await fetchData();
    setActionLoading(null);
  };

  // Bucket bookings by stage
  const pipeline = bookings.filter(b =>
    ['PENDING_REVIEW', 'OFFER_PENDING', 'NEGOTIATING', 'NDA_PENDING',
     'NDA_SIGNED', 'CONTRACT_PENDING', 'CONTRACT_SIGNED', 'AWAITING_DEPOSIT'].includes(b.status)
  );
  const active = bookings.filter(b => b.status === 'CONFIRMED');
  const completed = bookings.filter(b => ['COMPLETED', 'OFFER_REJECTED'].includes(b.status));

  // Unique talent roster from all bookings
  const talentMap = new Map<string, { name: string; bookings: number; confirmed: number }>();
  bookings.forEach(b => {
    if (b.talent?.name) {
      const existing = talentMap.get(b.talent.name) ?? { name: b.talent.name, bookings: 0, confirmed: 0 };
      existing.bookings += 1;
      if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') existing.confirmed += 1;
      talentMap.set(b.talent.name, existing);
    }
  });
  const talentRoster = Array.from(talentMap.values());

  const navItems: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'pipeline', label: 'Deal Pipeline',       icon: Briefcase,  badge: pipeline.length },
    { id: 'active',   label: 'Active Confirmed',    icon: CheckCircle, badge: active.length },
    { id: 'roster',   label: 'Talent Roster',       icon: Users },
  ];

  if (authLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">

      {/* Mobile header */}
      <header className="md:hidden h-16 bg-slate-900 border-b border-slate-800 px-6 flex justify-between items-center z-40 shrink-0">
        <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">WME AGENT</span>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle navigation" className="p-2 text-slate-400 hover:text-slate-100">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden" aria-hidden="true" />}

      {/* Sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between shrink-0 z-50 md:z-auto transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div>
          <div className="mb-8">
            <span className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">WME AGENT</span>
            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded mt-2 w-max">
              {user?.role} Dashboard
            </div>
          </div>
          <nav className="space-y-2" aria-label="Agent navigation">
            {navItems.map(({ id, label, icon: Icon, badge }) => (
              <button key={id} onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all relative ${activeTab === id ? 'bg-blue-500 text-slate-950 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                aria-current={activeTab === id ? 'page' : undefined}>
                <Icon size={18} aria-hidden="true" />
                {label}
                {badge != null && badge > 0 && (
                  <span className={`absolute right-4 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${activeTab === id ? 'bg-slate-950/40' : 'bg-blue-500'}`}>{badge}</span>
                )}
              </button>
            ))}
          </nav>

          {/* Summary stats */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { label: 'In Pipeline', value: pipeline.length, color: 'text-amber-400' },
              { label: 'Confirmed', value: active.length, color: 'text-emerald-400' },
              { label: 'Completed', value: completed.filter(b => b.status === 'COMPLETED').length, color: 'text-blue-400' },
              { label: 'Rejected', value: completed.filter(b => b.status === 'OFFER_REJECTED').length, color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <div className={`text-2xl font-black ${color}`}>{value}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center font-bold text-blue-500">{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="font-semibold text-sm truncate max-w-[150px]">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.role}</div>
            </div>
          </div>
          <button onClick={logout} className="w-full bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 font-semibold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition-all">Sign Out</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">

        {fetchError && (
          <div role="alert" className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><AlertTriangle size={16} />{fetchError}</span>
            <button onClick={fetchData} className="flex items-center gap-1 text-xs underline"><RefreshCw size={12} /> Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── PIPELINE ── */}
            {activeTab === 'pipeline' && (
              <div className="max-w-5xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Deal Pipeline</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">Review and advance bookings through each stage of the lifecycle.</p>
                </div>

                {pipeline.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                    <CheckCircle className="text-emerald-500 mx-auto mb-3" size={40} />
                    <p className="text-slate-400 text-sm">No deals currently in the pipeline.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pipeline.map(b => (
                      <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className={`border font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider ${statusColor(b.status)}`}>{b.status.replace(/_/g, ' ')}</span>
                              {STATUS_FLOW[b.status] && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <ChevronRight size={12} />
                                  <span className="uppercase tracking-wider">{STATUS_FLOW[b.status]?.replace(/_/g, ' ')}</span>
                                </span>
                              )}
                            </div>
                            <div>
                              <h2 className="text-lg font-bold">{b.eventTitle}</h2>
                              <p className="text-xs text-slate-400 mt-0.5">{b.venueName} &bull; {new Date(b.eventDate).toLocaleDateString()}</p>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                              <div><div className="text-slate-500">Buyer</div><div className="font-semibold text-slate-200 mt-0.5">{b.buyer?.name ?? '—'}</div></div>
                              <div><div className="text-slate-500">Talent</div><div className="font-semibold text-slate-200 mt-0.5">{b.talent?.name ?? '—'}</div></div>
                              <div><div className="text-slate-500">Budget</div><div className="font-semibold text-amber-400 mt-0.5">${Number(b.guaranteedBudget).toLocaleString()}</div></div>
                              <div><div className="text-slate-500">Capacity</div><div className="font-semibold text-slate-200 mt-0.5">{Number(b.venueCapacity).toLocaleString()}</div></div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-row md:flex-col gap-2 shrink-0">
                            {STATUS_ACTION_LABEL[b.status] && (
                              <button
                                onClick={() => handleAdvance(b.id, b.status)}
                                disabled={actionLoading === b.id}
                                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wide px-5 py-2.5 rounded-xl transition-all flex items-center gap-2">
                                <ChevronRight size={14} />
                                {actionLoading === b.id ? 'Updating...' : STATUS_ACTION_LABEL[b.status]}
                              </button>
                            )}
                            {['PENDING_REVIEW', 'OFFER_PENDING', 'NEGOTIATING'].includes(b.status) && (
                              <button
                                onClick={() => handleReject(b.id)}
                                disabled={!!actionLoading}
                                className="bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 border border-red-500/20 font-bold text-xs uppercase tracking-wide px-5 py-2.5 rounded-xl transition-all flex items-center gap-2">
                                <XCircle size={14} />
                                Reject
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Contracts */}
                        {(b as any).contracts?.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Documents</div>
                            {(b as any).contracts.map((c: any) => (
                              <div key={c.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-4 py-2">
                                <div className="flex items-center gap-2 text-xs">
                                  <FileText size={14} className={c.isSigned ? 'text-emerald-400' : 'text-slate-500'} />
                                  <span className="font-medium">{c.contractType}</span>
                                  {c.isSigned
                                    ? <span className="text-emerald-400">Signed</span>
                                    : <span className="text-amber-400">Pending</span>}
                                </div>
                                {c.isSigned && (
                                  <a href={c.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline">View</a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── ACTIVE / CONFIRMED ── */}
            {activeTab === 'active' && (
              <div className="max-w-5xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Active Confirmed Bookings</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">All bookings cleared for performance. Mark as completed after the event.</p>
                </div>

                {active.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                    <DollarSign className="text-amber-500 mx-auto mb-3" size={40} />
                    <p className="text-slate-400 text-sm">No confirmed bookings yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {active.map(b => (
                      <div key={b.id} className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">CONFIRMED</span>
                            <h2 className="text-lg font-bold mt-2">{b.eventTitle}</h2>
                            <p className="text-xs text-slate-400 mt-0.5">{b.venueName} &bull; {new Date(b.eventDate).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">Guarantee</div>
                            <div className="font-black text-amber-400 text-lg">${Number(b.guaranteedBudget).toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 grid grid-cols-2 gap-2">
                          <div><span className="text-slate-500">Buyer: </span>{b.buyer?.name}</div>
                          <div><span className="text-slate-500">Talent: </span>{b.talent?.name}</div>
                        </div>
                        <button
                          onClick={() => handleAdvance(b.id, b.status)}
                          disabled={actionLoading === b.id}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-widest py-2.5 rounded-xl transition-all">
                          {actionLoading === b.id ? 'Updating...' : 'Mark Completed'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TALENT ROSTER ── */}
            {activeTab === 'roster' && (
              <div className="max-w-5xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Talent Roster</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">Overview of all artists on the booking roster.</p>
                </div>

                {talentRoster.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                    <Users className="text-slate-600 mx-auto mb-3" size={40} />
                    <p className="text-slate-400 text-sm">No talent in the system yet.</p>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-slate-800">
                      <h2 className="text-lg font-bold">{talentRoster.length} Artist{talentRoster.length !== 1 ? 's' : ''} on Roster</h2>
                    </div>
                    <div className="divide-y divide-slate-800">
                      {talentRoster.map(t => (
                        <div key={t.name} className="flex items-center justify-between p-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center font-bold text-blue-400 text-sm">
                              {t.name[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold">{t.name}</div>
                              <div className="text-xs text-slate-500">{t.bookings} booking{t.bookings !== 1 ? 's' : ''} total</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-emerald-400 font-bold text-sm">{t.confirmed} confirmed</div>
                            <div className="text-xs text-slate-500">{t.bookings - t.confirmed} in progress</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

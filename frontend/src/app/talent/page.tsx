'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Calendar as CalendarIcon, FileCheck, HelpCircle, DollarSign, ArrowUpRight, TrendingUp, CheckCircle, XCircle, ArrowRight, ShieldCheck, Briefcase, Menu, X, RefreshCw } from 'lucide-react';

export default function TalentPortal() {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'calendar' | 'offer-desk' | 'ledger'>('calendar');
  const [bookings, setBookings] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load bookings and ledger records
  const fetchPortalData = async () => {
    if (bookings.length === 0 || ledgers.length === 0) {
      setLoading(true);
    }
    try {
      const bookingsRes = await fetch('http://localhost:3001/bookings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const bookingsData = await bookingsRes.json();
      if (Array.isArray(bookingsData)) {
        setBookings(bookingsData);
      }

      const ledgerRes = await fetch('http://localhost:3001/bookings/ledger', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ledgerData = await ledgerRes.json();
      if (Array.isArray(ledgerData)) {
        setLedgers(ledgerData);
      }
    } catch (err) {
      console.error('Failed to load talent portal data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPortalData();
    }
  }, [token]);

  // Handle Offer Approval / Decline
  const handleOfferResponse = async (bookingId: string, action: 'CONFIRMED' | 'OFFER_REJECTED') => {
    try {
      const res = await fetch(`http://localhost:3001/bookings/${bookingId}/respond`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: action }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Action failed');
      }

      alert(`Offer response successfully cataloged! Background pipeline triggered.`);
      fetchPortalData();
    } catch (err: any) {
      alert(err.message || 'Error executing choice');
    }
  };

  // Get color coding based on status
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'OFFER_PENDING':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'PENDING_REVIEW':
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      case 'NDA_PENDING':
      case 'CONTRACT_PENDING':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'OFFER_REJECTED':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  // Filter bookings that are pending for the Offer Desk
  const pendingOffers = bookings.filter((b) => b.status === 'OFFER_PENDING');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Navbar */}
      <header className="md:hidden h-16 bg-slate-900 border-b border-slate-800 px-6 flex justify-between items-center z-40 shrink-0">
        <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
          WME TALENT
        </span>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-slate-400 hover:text-slate-100 transition-colors"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Sidebar navigation */}
      <aside className={`fixed md:relative inset-y-0 left-0 w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between shrink-0 z-50 md:z-auto transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div>
          <div className="mb-8">
            <span className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              WME TALENT
            </span>
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded mt-2 w-max">
              Artist Portal (Internal)
            </div>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => { setActiveTab('calendar'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'calendar'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <CalendarIcon size={18} />
              Unified Itinerary Engine
            </button>
            <button
              onClick={() => { setActiveTab('offer-desk'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all relative ${
                activeTab === 'offer-desk'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Briefcase size={18} />
              Agent Offer Desk
              {pendingOffers.length > 0 && (
                <span className="absolute right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {pendingOffers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('ledger'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'ledger'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <DollarSign size={18} />
              Financial Ledger
            </button>
          </nav>
        </div>

        <div className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-850 border border-slate-750 rounded-full flex items-center justify-center font-bold text-amber-500">
              {user?.name?.[0]}
            </div>
            <div>
              <div className="font-semibold text-sm truncate max-w-[150px]">{user?.name}</div>
              <div className="text-xs text-slate-500 truncate max-w-[150px]">{user?.role} Profile</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 font-semibold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
          >
            Log Out Portal
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {activeTab === 'calendar' && (
              <div className="max-w-5xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Unified Itinerary Engine</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">
                    Interactive performance agenda. Auto-transitions status from &quot;Hold&quot; to &quot;Confirmed&quot; immediately upon deposit clearance in trust.
                  </p>
                </div>

                {/* Calendar Layout */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold">Performance Agenda</h2>
                    <div className="flex gap-4 text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                        Cleared / Confirmed Gigs
                      </span>
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
                        Negotiation Holds
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bookings.map((b) => (
                      <div
                        key={b.id}
                        className={`border p-5 rounded-xl flex flex-col justify-between transition-all hover:translate-y-[-2px] ${
                          b.status === 'CONFIRMED'
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-slate-950 border-slate-850'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-xs text-slate-500 font-mono">
                              {new Date(b.eventDate).toLocaleDateString()}
                            </span>
                            <span
                              className={`border font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${getStatusBadgeColor(
                                b.status,
                              )}`}
                            >
                              {b.status}
                            </span>
                          </div>
                          <h3 className="font-bold text-base text-slate-100">{b.eventTitle}</h3>
                          <p className="text-slate-400 text-xs mt-1">{b.venueName}</p>
                          <p className="text-slate-500 text-xs mt-1">Capacity: {b.venueCapacity.toLocaleString()} attendees</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-850/60 flex justify-between items-center text-xs">
                          <span className="text-slate-400">Guarantee:</span>
                          <span className="font-bold text-amber-400">
                            ${Number(b.guaranteedBudget).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Standard Mock Travels Block inside Calendar */}
                    <div className="bg-slate-950 border border-slate-850 p-5 rounded-xl flex flex-col justify-between opacity-75">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs text-slate-500 font-mono">2026-10-06</span>
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Flight / Logistics
                          </span>
                        </div>
                        <h3 className="font-bold text-base text-slate-100">LHR to JFK (Delta DL002)</h3>
                        <p className="text-slate-400 text-xs mt-1">First Class Cabin • Confirmed</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-850/60 text-xs text-slate-500">
                        Agent Booking Team Managed
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'offer-desk' && (
              <div className="max-w-4xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Agent Offer Desk</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">
                    Agent-vetted performance deal memos. Swipe or toggle status below to instantly approve or decline incoming bookings.
                  </p>
                </div>

                {pendingOffers.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
                    <CheckCircle className="text-emerald-500 mx-auto" size={40} />
                    <h2 className="text-lg font-bold">No Pending Deals</h2>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      All vetted buyer invitations have been cleared by your agent team. Sit back or check active itineraries.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {pendingOffers.map((offer) => (
                      <div
                        key={offer.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between gap-6"
                      >
                        <div className="space-y-4 flex-1">
                          <div>
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Vetted Offer (Hold)
                            </span>
                            <h2 className="text-xl font-bold mt-2">{offer.eventTitle}</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Proposed by <span className="text-slate-300 font-semibold">{offer.buyer?.name || 'External Promoter'}</span>
                            </p>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs">
                            <div>
                              <div className="text-slate-500">Event Date</div>
                              <div className="font-semibold text-slate-200 mt-0.5">
                                {new Date(offer.eventDate).toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500">Venue Capacity</div>
                              <div className="font-semibold text-slate-200 mt-0.5">
                                {offer.venueCapacity.toLocaleString()} seats
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500">Guaranteed Budget</div>
                              <div className="font-semibold text-amber-400 mt-0.5">
                                ${Number(offer.guaranteedBudget).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500">Commission Rate</div>
                              <div className="font-semibold text-slate-200 mt-0.5">15%</div>
                            </div>
                          </div>

                          <div className="text-xs text-slate-400">
                            <span className="font-bold text-slate-300">Proposed Usage Rights:</span> {offer.usageRights}
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col justify-end items-stretch gap-3 shrink-0">
                          <button
                            onClick={() => handleOfferResponse(offer.id, 'CONFIRMED')}
                            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle size={16} />
                            Approve Memo
                          </button>
                          <button
                            onClick={() => handleOfferResponse(offer.id, 'OFFER_REJECTED')}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                          >
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

            {activeTab === 'ledger' && (
              <div className="max-w-5xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Financial Ledger</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">
                    Detailed revenue statement of agency-vetted commissions, taxes, and net clearance distributions.
                  </p>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Gross Booking Revenue</div>
                    <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
                      $250,000.00
                    </div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <TrendingUp size={12} />
                      100% Agency Certified
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Agency Commish (15%)</div>
                    <div className="text-3xl font-extrabold text-slate-200">
                      $37,500.00
                    </div>
                    <div className="text-[10px] text-slate-500">WME Trust Commission</div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Net Payout Timeline</div>
                    <div className="text-3xl font-extrabold text-emerald-400">
                      $162,500.00
                    </div>
                    <div className="text-[10px] text-amber-500 flex items-center gap-1 font-semibold">
                      <ShieldCheck size={12} />
                      Awaiting Wire Settlement
                    </div>
                  </div>
                </div>

                {/* Ledger Log Table */}
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
                          <th className="py-4 px-6">Gross Booking</th>
                          <th className="py-4 px-6">Commission (15%)</th>
                          <th className="py-4 px-6">Withholding (20%)</th>
                          <th className="py-4 px-6">Net Payout</th>
                          <th className="py-4 px-6">Clearance Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-sm text-slate-300">
                        {ledgers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 px-6 text-center text-xs text-slate-500">
                              No cleared payouts loaded in this trust account currently.
                            </td>
                          </tr>
                        ) : (
                          ledgers.map((l) => (
                            <tr key={l.id} className="hover:bg-slate-850/20 transition-all">
                              <td className="py-4 px-6">
                                <div className="font-semibold text-slate-100">{l.booking?.eventTitle}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {new Date(l.booking?.eventDate).toLocaleDateString()} • {l.booking?.venueName}
                                </div>
                              </td>
                              <td className="py-4 px-6 font-semibold text-slate-200">
                                ${Number(l.grossEarnings).toLocaleString()}
                              </td>
                              <td className="py-4 px-6 text-red-400">
                                -${Number(l.agencyCommission).toLocaleString()}
                              </td>
                              <td className="py-4 px-6 text-slate-400">
                                -${Number(l.taxWithholding).toLocaleString()}
                              </td>
                              <td className="py-4 px-6 text-emerald-400 font-bold">
                                ${Number(l.netPayout).toLocaleString()}
                              </td>
                              <td className="py-4 px-6">
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded">
                                  {l.payoutStatus}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
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

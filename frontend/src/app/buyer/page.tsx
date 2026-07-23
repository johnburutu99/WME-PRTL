'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  Calendar, FileText, Lock, DollarSign, Award,
  ShieldAlert, CheckCircle, Menu, X, RefreshCw,
} from 'lucide-react';
import {
  getBookings, getTalents, getBookingSchema, createBooking,
} from '@/lib/actions/bookings.actions';
import { signContract } from '@/lib/actions/agent.actions';
import { createDepositCheckout } from '@/lib/actions/stripe.actions';
import type { Booking, BookingFormSchema, JsonSchemaField, Talent } from '@/types/portal';

interface ContractRecord {
  id: string;
  contractType: string;
  documentUrl: string;
  isSigned: boolean;
  signedAt?: string;
}

interface IntakeFormValues {
  talentId: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  venueCapacity: number;
  guaranteedBudget: number;
  usageRights: string;
}

export default function BuyerPortal() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'intake' | 'contracts' | 'ledger'>('intake');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [schemaFields, setSchemaFields] = useState<BookingFormSchema | null>(null);
  const [talents, setTalents] = useState<Talent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingContract, setSigningContract] = useState<string | null>(null);
  const [depositLoading, setDepositLoading] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<IntakeFormValues>({
    defaultValues: {
      talentId: '', eventTitle: '', eventDate: '',
      venueName: '', venueCapacity: 100, guaranteedBudget: 5000,
      usageRights: 'Live promotion and digital branding only.',
    },
  });

  // Redirect if not authenticated or wrong role
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'BUYER')) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const loadAllData = useCallback(async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const [schema, bookingResult, talentResult] = await Promise.all([
        getBookingSchema(),
        getBookings(),
        getTalents(),
      ]);

      setSchemaFields(schema);

      if (bookingResult.error) { setFetchError(bookingResult.error); }
      else if (bookingResult.data) {
        setBookings(bookingResult.data);
        const allContracts: ContractRecord[] = [];
        (bookingResult.data as any[]).forEach((b) => {
          if (b.contracts?.length) allContracts.push(...b.contracts);
        });
        setContracts(allContracts);
      }

      if (talentResult.error) { setFetchError(talentResult.error); }
      else if (talentResult.data) setTalents(talentResult.data);

    } catch {
      setFetchError('Failed to load portal data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'BUYER') loadAllData();
  }, [user, loadAllData]);

  const onSubmitIntake = async (values: IntakeFormValues) => {
    setIsSubmitting(true);
    setFormSuccess(null);
    const result = await createBooking({
      ...values,
      venueCapacity: Number(values.venueCapacity),
      guaranteedBudget: Number(values.guaranteedBudget),
    });
    if (result.error) {
      setFetchError(result.error);
    } else {
      setFormSuccess('Booking submitted. Your agent will review it shortly.');
      reset();
      const updated = await getBookings();
      if (updated.data) setBookings(updated.data);
    }
    setIsSubmitting(false);
  };

  const handleSignContract = async (contractId: string) => {
    setSigningContract(contractId);
    setFetchError(null);
    const result = await signContract(contractId);
    if (result.error) {
      setFetchError(result.error);
    } else {
      await loadAllData();
    }
    setSigningContract(null);
  };

  const handleDepositCheckout = async (bookingId: string) => {
    setDepositLoading(bookingId);
    setFetchError(null);
    const result = await createDepositCheckout(bookingId);
    if (result.error) {
      setFetchError(result.error);
    } else if (result.data?.url) {
      window.location.href = result.data.url;
    }
    setDepositLoading(null);
  };

  const renderDynamicField = (key: string, prop: JsonSchemaField) => {
    if (!schemaFields) return null;
    const isRequired = schemaFields.required?.includes(key);

    if (key === 'talentId') return (
      <div key={key}>
        <label htmlFor={key} className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
          {prop.title || key} {isRequired && <span className="text-amber-500">*</span>}
        </label>
        <select id={key} {...register('talentId', { required: isRequired })}
          className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50">
          <option value="">— Choose Artist / DJ —</option>
          {talents.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {errors.talentId && <p className="text-red-400 text-xs mt-1">Artist selection is required</p>}
      </div>
    );

    if (key === 'usageRights') return (
      <div key={key} className="col-span-full">
        <label htmlFor={key} className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
          {prop.title || key} {isRequired && <span className="text-amber-500">*</span>}
        </label>
        <textarea id={key} {...register('usageRights', { required: isRequired })} rows={3}
          className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50"
          placeholder={prop.description || 'Specify filming, broadcast, or commercial branding requirements.'} />
        {errors.usageRights && <p className="text-red-400 text-xs mt-1">Usage rights are required</p>}
      </div>
    );

    let inputType = 'text';
    if (prop.type === 'integer' || prop.type === 'number') inputType = 'number';
    else if (prop.format === 'date-time') inputType = 'datetime-local';
    const fieldKey = key as keyof IntakeFormValues;

    return (
      <div key={key}>
        <label htmlFor={key} className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
          {prop.title || key} {isRequired && <span className="text-amber-500">*</span>}
        </label>
        <input id={key} type={inputType}
          {...register(fieldKey, { required: isRequired, min: prop.minimum, minLength: prop.minLength, maxLength: prop.maxLength })}
          className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50"
          placeholder={prop.title || key} />
        {errors[fieldKey] && <p className="text-red-400 text-xs mt-1">{prop.title || key} is invalid or required</p>}
      </div>
    );
  };

  const navItems = [
    { id: 'intake' as const, label: 'Booking Intake & Forms', icon: Calendar },
    { id: 'contracts' as const, label: 'Contract Vault & Riders', icon: FileText },
    { id: 'ledger' as const, label: 'Secure Trust Account', icon: Lock },
  ];

  if (authLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Navbar */}
      <header className="md:hidden h-16 bg-slate-900 border-b border-slate-800 px-6 flex justify-between items-center z-40 shrink-0">
        <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">WME CLIENT</span>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle navigation" className="p-2 text-slate-400 hover:text-slate-100">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden" aria-hidden="true" />}

      {/* Sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between shrink-0 z-50 md:z-auto transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div>
          <div className="mb-8">
            <span className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">WME CLIENT</span>
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded mt-2 w-max">Promoter Portal (B2B)</div>
          </div>
          <nav className="space-y-2" aria-label="Portal navigation">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeTab === id ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                aria-current={activeTab === id ? 'page' : undefined}>
                <Icon size={18} aria-hidden="true" />{label}
              </button>
            ))}
          </nav>
        </div>
        <div className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center font-bold text-amber-500">{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="font-semibold text-sm truncate max-w-[150px]">{user?.name}</div>
              <div className="text-xs text-slate-500 truncate max-w-[150px]">{user?.email}</div>
            </div>
          </div>
          <button onClick={logout} className="w-full bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 font-semibold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition-all">Sign Out</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {fetchError && (
          <div role="alert" className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center justify-between text-sm">
            <span>{fetchError}</span>
            <button onClick={loadAllData} className="flex items-center gap-1 text-xs underline"><RefreshCw size={12} /> Retry</button>
          </div>
        )}

        {loading ? (
          <div className="max-w-4xl space-y-8 animate-pulse">
            <div className="h-8 w-64 bg-slate-900 rounded-lg" /><div className="h-4 w-96 bg-slate-900 rounded-lg" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 h-[450px] bg-slate-900 border border-slate-800 rounded-2xl" />
              <div className="lg:col-span-5 h-[450px] bg-slate-900 border border-slate-800 rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            {/* ── BOOKING INTAKE ── */}
            {activeTab === 'intake' && (
              <div className="max-w-4xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Booking Intake &amp; Vetting</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">Submit event applications for agent review.</p>
                </div>
                {formSuccess && (
                  <div role="status" className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3">
                    <CheckCircle className="shrink-0 mt-0.5" size={18} /><p className="text-sm">{formSuccess}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
                    <div>
                      <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="text-amber-500" size={18} />Booking Intake Form</h2>
                      <p className="text-xs text-slate-500 mt-1">Schema-driven form from Supabase backend.</p>
                    </div>
                    <form onSubmit={handleSubmit(onSubmitIntake)} className="space-y-4" noValidate>
                      {schemaFields?.properties ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(schemaFields.properties).map(([k, p]) => renderDynamicField(k, p))}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-xs text-slate-500 mt-2">Loading form schema...</p>
                        </div>
                      )}
                      <button type="submit" disabled={isSubmitting}
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50 mt-4">
                        {isSubmitting ? 'Submitting...' : 'Submit Booking Request'}
                      </button>
                    </form>
                  </div>
                  <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
                    <div>
                      <h2 className="text-lg font-bold flex items-center gap-2"><Award className="text-amber-500" size={18} />Active Deal Tracker</h2>
                      <p className="text-xs text-slate-500 mt-1">Live status of your submitted bookings.</p>
                    </div>
                    <div className="space-y-3.5 max-h-[450px] overflow-y-auto">
                      {bookings.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
                          <p className="text-slate-500 text-xs">No bookings submitted yet.</p>
                        </div>
                      ) : bookings.map((b) => (
                        <div key={b.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold text-sm">{b.eventTitle}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{b.venueName} &bull; {new Date(b.eventDate).toLocaleDateString()}</div>
                            </div>
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">{b.status}</span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                            <span className="text-slate-500">Proposed Budget:</span>
                            <span className="font-semibold text-slate-200">${Number(b.guaranteedBudget).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── CONTRACTS ── */}
            {activeTab === 'contracts' && (
              <div className="max-w-4xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Legal Contract Vault</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">Access and execute NDAs and long-form contracts inside your authenticated session.</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl flex gap-3">
                    <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={20} />
                    <div>
                      <div className="text-sm font-semibold text-slate-200">Non-Transmittance Policy (NDA Guard)</div>
                      <div className="text-xs text-slate-400 mt-1">WME contracts are never distributed via email. All signatures must be completed inside this portal.</div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {contracts.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
                        <p className="text-slate-500 text-xs">No contracts on file yet. They appear here once your booking advances past the NDA stage.</p>
                      </div>
                    ) : contracts.map((c) => (
                      <div key={c.id} className="border border-slate-800 rounded-xl p-4 flex justify-between items-center bg-slate-950">
                        <div className="flex items-center gap-3">
                          <FileText className={c.isSigned ? 'text-emerald-500' : 'text-blue-500'} size={24} />
                          <div>
                            <div className="font-semibold text-sm">{c.contractType === 'NDA' ? 'Non-Disclosure Agreement' : 'Long Form Performance Contract'}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {c.isSigned
                                ? <span className="text-emerald-400 font-semibold">Signed {c.signedAt ? new Date(c.signedAt).toLocaleDateString() : ''}</span>
                                : <span className="text-amber-500 font-semibold">Pending Signature</span>}
                            </div>
                          </div>
                        </div>
                        {c.isSigned
                          ? <a href={c.documentUrl} target="_blank" rel="noopener noreferrer" className="border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs uppercase tracking-widest px-4 py-2 rounded-lg transition-all">View Document</a>
                          : <button
                              onClick={() => handleSignContract(c.id)}
                              disabled={signingContract === c.id}
                              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-lg transition-all">
                              {signingContract === c.id ? 'Signing...' : 'Sign Envelope'}
                            </button>
                        }
                      </div>
                    ))}
                  </div>
                  <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center space-y-3">
                    <Lock className="text-slate-500 mx-auto" size={32} />
                    <div className="text-sm font-semibold text-slate-300">48-Hour Lock-In Policy</div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">Upon receipt of a contract envelope, terms automatically lock and become binding if uncontested within 48 hours.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── FINANCIAL VAULT ── */}
            {activeTab === 'ledger' && (
              <div className="max-w-4xl space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">Secure Financial Vault</h1>
                  <p className="text-slate-400 mt-1.5 text-sm">WME Agency Escrow &amp; Trust Account. Always verify wire instructions here — never via email.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2"><DollarSign className="text-amber-500" size={20} />Verified Escrow Credentials</h2>
                    <p className="text-xs text-slate-400">Wire instructions are never sent via email. Verify all details here only.</p>
                    <div className="space-y-3 pt-3 text-sm">
                      {[['Receiver Bank', 'Chase Bank N.A. New York'], ['Account Type', 'WME Agency Escrow Trust'], ['Routing Number', '021000021']].map(([label, val]) => (
                        <div key={label} className="flex justify-between border-b border-slate-800 pb-2">
                          <span className="text-slate-500">{label}</span>
                          <span className={`font-medium ${label === 'Account Type' ? 'text-amber-400' : ''} ${label === 'Routing Number' ? 'font-mono bg-slate-950 px-2 py-0.5 rounded text-xs' : ''}`}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                      <h2 className="text-lg font-bold">Stripe Payment Clearance</h2>
                      <p className="text-xs text-slate-400 mt-1">Settle 50% non-refundable deposits via ACH or secure card processing.</p>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center mt-4">
                      <div className="text-xs text-slate-500 mb-2">
                        {bookings.filter(b => b.status === 'AWAITING_DEPOSIT').length > 0
                          ? `${bookings.filter(b => b.status === 'AWAITING_DEPOSIT').length} deposit(s) awaiting payment`
                          : 'No pending deposit invoices outstanding.'}
                      </div>
                      {bookings.filter(b => b.status === 'AWAITING_DEPOSIT').map(b => (
                        <button
                          key={b.id}
                          onClick={() => handleDepositCheckout(b.id)}
                          disabled={depositLoading === b.id}
                          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all mb-2">
                          {depositLoading === b.id ? 'Redirecting...' : `Pay 50% Deposit — ${b.eventTitle}`}
                        </button>
                      ))}
                      {bookings.filter(b => b.status === 'AWAITING_DEPOSIT').length === 0 && (
                        <button disabled className="w-full bg-slate-800 border border-slate-700 text-slate-400 font-semibold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider cursor-not-allowed">Stripe Secure Checkout</button>
                      )}
                    </div>
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

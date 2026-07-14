'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useForm } from 'react-hook-form';
import { Calendar, Building, DollarSign, Users, Award, ShieldAlert, CheckCircle, FileText, Lock, Menu, X, RefreshCw, Sparkles } from 'lucide-react';

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
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'intake' | 'contracts' | 'ledger'>('intake');
  const [bookings, setBookings] = useState<any[]>([]);
  const [schemaFields, setSchemaFields] = useState<any>(null);
  const [talents, setTalents] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [webhookBookingId, setWebhookBookingId] = useState('');
  const [webhookEvent, setWebhookEvent] = useState<'payment.deposit_cleared' | 'esign.nda_signed' | 'esign.longform_signed'>('payment.deposit_cleared');
  const [webhookReference, setWebhookReference] = useState('wire_chase_tr_9901A');
  const [webhookDocUrl, setWebhookDocUrl] = useState('https://wme-vault.s3.amazonaws.com/contracts/completed_nda.pdf');
  const [webhookSecret, setWebhookSecret] = useState('wme_hmac_webhook_secret_key');
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);

  const triggerWebhook = async () => {
    if (!webhookBookingId) {
      alert('Please select a booking target for the webhook simulation.');
      return;
    }
    setIsSendingWebhook(true);
    setWebhookStatus(null);

    try {
      const secret = webhookSecret || 'wme_hmac_webhook_secret_key';

      let payload: any = {
        event: webhookEvent,
        bookingId: webhookBookingId,
      };

      if (webhookEvent === 'payment.deposit_cleared') {
        payload.reference = webhookReference;
      } else {
        payload.documentUrl = webhookDocUrl;
      }

      const payloadStr = JSON.stringify(payload);

      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(payloadStr);

      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const signatureBuffer = await window.crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        messageData
      );

      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const res = await fetch('http://localhost:3001/webhooks/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wme-signature': signature,
        },
        body: payloadStr,
      });

      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.message || 'Webhook invocation failed');
      }

      setWebhookStatus(`SUCCESS: Status: ${res.status}. Response: ${JSON.stringify(responseData)}`);

      const bookingsRes = await fetch('http://localhost:3001/bookings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await bookingsRes.json();
      if (Array.isArray(data)) {
        setBookings(data);
      }
    } catch (err: any) {
      setWebhookStatus(`ERROR: ${err.message}`);
    } finally {
      setIsSendingWebhook(false);
    }
  };

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IntakeFormValues>({
    defaultValues: {
      talentId: '',
      eventTitle: '',
      eventDate: '',
      venueName: '',
      venueCapacity: 100,
      guaranteedBudget: 5000,
      usageRights: 'Live promotion and digital branding only.',
    },
  });

  const renderDynamicField = (key: string, prop: any) => {
    if (!schemaFields) return null;
    const isRequired = schemaFields.required?.includes(key);

    if (key === 'talentId') {
      return (
        <div key={key}>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
            {prop.title || key} {isRequired && <span className="text-amber-500">*</span>}
          </label>
          <select
            {...register(key as any, { required: isRequired })}
            className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="">-- Choose Artist / DJ --</option>
            {talents.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {prop.description && <p className="text-[11px] text-slate-500 mt-1">{prop.description}</p>}
          {errors[key as keyof IntakeFormValues] && <p className="text-red-400 text-xs mt-1">{prop.title || key} is required</p>}
        </div>
      );
    }

    if (key === 'usageRights') {
      return (
        <div key={key} className="col-span-full">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
            {prop.title || key} {isRequired && <span className="text-amber-500">*</span>}
          </label>
          <textarea
            {...register(key as any, { required: isRequired })}
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50"
            placeholder={prop.description || "Specify filming, broadcast, or commercial branding requirements."}
          ></textarea>
          {errors[key as keyof IntakeFormValues] && <p className="text-red-400 text-xs mt-1">{prop.title || key} is required</p>}
        </div>
      );
    }

    // Determine input type
    let inputType = 'text';
    if (prop.type === 'integer' || prop.type === 'number') {
      inputType = 'number';
    } else if (prop.format === 'date-time') {
      inputType = 'datetime-local';
    }

    return (
      <div key={key}>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
          {prop.title || key} {isRequired && <span className="text-amber-500">*</span>}
        </label>
        <input
          type={inputType}
          {...register(key as any, {
            required: isRequired,
            min: prop.minimum || undefined,
            minLength: prop.minLength || undefined,
            maxLength: prop.maxLength || undefined,
          })}
          className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50"
          placeholder={prop.title || key}
        />
        {errors[key as keyof IntakeFormValues] && (
          <p className="text-red-400 text-xs mt-1">
            {prop.title || key} is invalid or required
          </p>
        )}
      </div>
    );
  };

  // Load backend Schema and active bookings on mount
  useEffect(() => {
    const loadAllData = async () => {
      // Optimistic background refresh if we already have loaded once
      if (bookings.length === 0 || !schemaFields || talents.length === 0) {
        setLoading(true);
      }
      try {
        await Promise.all([
          fetch('http://localhost:3001/bookings/schema', {
            headers: { Authorization: `Bearer ${token}` },
          }).then(res => res.json()).then(schema => setSchemaFields(schema)).catch(err => console.error(err)),
          fetch('http://localhost:3001/bookings', {
            headers: { Authorization: `Bearer ${token}` },
          }).then(res => res.json()).then(data => {
            if (Array.isArray(data)) setBookings(data);
          }).catch(err => console.error(err)),
          fetch('http://localhost:3001/bookings/talents', {
            headers: { Authorization: `Bearer ${token}` },
          }).then(res => res.json()).then(data => {
            if (Array.isArray(data)) setTalents(data);
          }).catch(err => console.error(err))
        ]);
      } catch (err) {
        console.error('Failed to load portal configuration data', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadAllData();
    }
  }, [token]);

  // Submit dynamic form
  const onSubmitIntake = async (values: IntakeFormValues) => {
    setIsSubmitting(true);
    setFormSuccess(null);
    try {
      const submissionPayload = {
        ...values,
        venueCapacity: Number(values.venueCapacity),
        guaranteedBudget: Number(values.guaranteedBudget),
      };

      const res = await fetch('http://localhost:3001/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submissionPayload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Submission failed');
      }

      setFormSuccess('Booking intake form submitted successfully! A background worker has been scheduled to generate templates.');
      reset();

      // Refresh list
      const bookingsRes = await fetch('http://localhost:3001/bookings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await bookingsRes.json();
      if (Array.isArray(data)) {
        setBookings(data);
      }
    } catch (err: any) {
      alert(err.message || 'Intake submission error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Navbar */}
      <header className="md:hidden h-16 bg-slate-900 border-b border-slate-800 px-6 flex justify-between items-center z-40 shrink-0">
        <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
          WME CLIENT
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
              WME CLIENT
            </span>
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded mt-2 w-max">
              Promoter Portal (B2B)
            </div>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => { setActiveTab('intake'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'intake'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Calendar size={18} />
              Booking Intake & Forms
            </button>
            <button
              onClick={() => { setActiveTab('contracts'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'contracts'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <FileText size={18} />
              Contract Vault & Riders
            </button>
            <button
              onClick={() => { setActiveTab('ledger'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'ledger'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Lock size={18} />
              Secure Trust Account
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
              <div className="text-xs text-slate-500 truncate max-w-[150px]">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 font-semibold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
          >
            Terminate Session
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {loading ? (
          <div className="max-w-4xl space-y-8 animate-pulse">
            <div className="space-y-3">
              <div className="h-8 w-64 bg-slate-900 rounded-lg"></div>
              <div className="h-4 w-96 bg-slate-900 rounded-lg"></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 h-[450px] bg-slate-900 border border-slate-800 rounded-2xl"></div>
              <div className="lg:col-span-5 h-[450px] bg-slate-900 border border-slate-800 rounded-2xl"></div>
            </div>
          </div>
        ) : (
          <>
        {activeTab === 'intake' && (
          <div className="max-w-4xl space-y-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Booking Intake & Vetting</h1>
              <p className="text-slate-400 mt-1.5 text-sm">
                Submit validated event applications. All budgets and capacities are run through local and agent-driven vetting models.
              </p>
            </div>

            {formSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3">
                <CheckCircle className="shrink-0 mt-0.5" size={18} />
                <p className="text-sm">{formSuccess}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Submission Form */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <FileText className="text-amber-500" size={18} />
                    Dynamic Client Intake Gate
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Driven in real-time by JSON schemas received from backend APIs.
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmitIntake)} className="space-y-4">
                  {schemaFields && schemaFields.properties ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(schemaFields.properties).map(([key, prop]) =>
                        renderDynamicField(key, prop)
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-xs text-slate-500 mt-2">Compiling metadata-driven schema...</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50 mt-4"
                  >
                    {isSubmitting ? 'Transmitting To Agency Vetting...' : 'Transmit Booking Intake Form'}
                  </button>
                </form>
              </div>

              {/* Status List */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Award className="text-amber-500" size={18} />
                    Active Deal Tracker
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Real-time transaction status of your submissions.
                  </p>
                </div>

                <div className="space-y-3.5 max-h-[450px] overflow-y-auto">
                  {bookings.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
                      <p className="text-slate-500 text-xs">No active bookings submitted yet.</p>
                    </div>
                  ) : (
                    bookings.map((b) => (
                      <div
                        key={b.id}
                        className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-sm">{b.eventTitle}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {b.venueName} • {new Date(b.eventDate).toLocaleDateString()}
                            </div>
                          </div>
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">
                            {b.status}
                          </span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-850 flex justify-between items-center text-xs">
                          <span className="text-slate-500">Proposed Budget:</span>
                          <span className="font-semibold text-slate-200">
                            ${Number(b.guaranteedBudget).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contracts' && (
          <div className="max-w-4xl space-y-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Legal Contract Vault</h1>
              <p className="text-slate-400 mt-1.5 text-sm">
                Access and securely execute NDAs, riders, and long-form performance contracts inside authenticated portal sessions.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl flex gap-3">
                <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={20} />
                <div>
                  <div className="text-sm font-semibold text-slate-200">Strict Non-Transmittance Enforcement (NDA Guard)</div>
                  <div className="text-xs text-slate-400 mt-1">
                    To prevent phishing, WME contracts are never sent via email. To authorize signature, you must log in and sign within the portal iframe.
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border border-slate-850 rounded-xl p-4 flex justify-between items-center bg-slate-950">
                  <div className="flex items-center gap-3">
                    <FileText className="text-blue-500" size={24} />
                    <div>
                      <div className="font-semibold text-sm">Non-Disclosure Agreement (NDA) - Vegas Sparkle Lights</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Required for technical specifications release • <span className="text-amber-500 font-semibold">Pending Signature</span>
                      </div>
                    </div>
                  </div>
                  <button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-lg transition-all">
                    Sign Envelope
                  </button>
                </div>

                <div className="border border-slate-850 rounded-xl p-4 flex justify-between items-center bg-slate-950">
                  <div className="flex items-center gap-3">
                    <FileText className="text-slate-500" size={24} />
                    <div>
                      <div className="font-semibold text-sm">Hospitality & Production Rider - DJ Sparkle</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Locked (Version Control 1.4) • Verified from secure object storage
                      </div>
                    </div>
                  </div>
                  <button className="border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs uppercase tracking-widest px-4 py-2 rounded-lg transition-all">
                    View Fresh Copy
                  </button>
                </div>
              </div>

              <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center space-y-3">
                <Lock className="text-slate-500 mx-auto" size={32} />
                <div className="text-sm font-semibold text-slate-300">48-Hour Lock-In Policy</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Upon digital receipt of the contract envelope, terms automatically lock and become legally binding if uncontested within 48 hours.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="max-w-4xl space-y-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Secure Financial Vault</h1>
              <p className="text-slate-400 mt-1.5 text-sm">
                WME Agency Escrow & Trust Account banking credentials. Always verify security keys before wiring funds.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <DollarSign className="text-amber-500" size={20} />
                  Verified Escrow Credentials
                </h2>
                <p className="text-xs text-slate-400">
                  Phishing Protection: We never communicate wire adjustments or bank directions over email. Always verify details inside this portal session.
                </p>

                <div className="space-y-3 pt-3 text-sm">
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-500">Receiver Bank</span>
                    <span className="font-medium">Chase Bank N.A. New York</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-500">Account Type</span>
                    <span className="font-medium text-amber-400">WME Agency Escrow Trust</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-500">Routing Number</span>
                    <span className="font-mono bg-slate-950 px-2 py-0.5 rounded text-xs">021000021</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Escrow Key</span>
                    <span className="font-mono bg-slate-950 px-2 py-0.5 rounded text-xs">AES-256-TRUST-889A</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-bold">Stripe Payment Clearance</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Optionally settle 50% non-refundable deposits via direct ACH or secure credit card processing integrations.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 text-center mt-4">
                  <div className="text-xs text-slate-500 mb-2">No pending deposit invoices outstanding.</div>
                  <button className="w-full bg-slate-850 border border-slate-750 text-slate-400 hover:bg-slate-800 font-semibold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-not-allowed">
                    Stripe Secure Checkout
                  </button>
                </div>
              </div>
            </div>

            {/* Operational HMAC Webhook Simulator */}
            <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <ShieldAlert className="text-amber-500" size={20} />
                  Operational Webhook HMAC Simulator
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Trigger secure, cryptographically verified backend callbacks simulating bank settlements and contract signatures.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
                    Target Booking
                  </label>
                  <select
                    value={webhookBookingId}
                    onChange={(e) => setWebhookBookingId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="">-- Choose Target Booking --</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.eventTitle} (${Number(b.guaranteedBudget).toLocaleString()}) [{b.status}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
                    Event Type
                  </label>
                  <select
                    value={webhookEvent}
                    onChange={(e) => setWebhookEvent(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="payment.deposit_cleared">payment.deposit_cleared (Clear Deposit & Confirm)</option>
                    <option value="esign.nda_signed">esign.nda_signed (NDA Contract Signed)</option>
                    <option value="esign.longform_signed">esign.longform_signed (Long Form Contract Signed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
                    Webhook Signing Secret (HMAC)
                  </label>
                  <input
                    type="password"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50"
                    placeholder="Enter HMAC Secret key"
                  />
                </div>

                {webhookEvent === 'payment.deposit_cleared' ? (
                  <div className="col-span-full">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
                      Bank Transfer Reference Code
                    </label>
                    <input
                      type="text"
                      value={webhookReference}
                      onChange={(e) => setWebhookReference(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50"
                      placeholder="e.g. wire_chase_tr_9901A"
                    />
                  </div>
                ) : (
                  <div className="col-span-full">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1.5">
                      Completed Document Vault URL
                    </label>
                    <input
                      type="text"
                      value={webhookDocUrl}
                      onChange={(e) => setWebhookDocUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50"
                      placeholder="e.g. https://wme-vault.s3.amazonaws.com/contracts/nda.pdf"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={triggerWebhook}
                disabled={isSendingWebhook}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {isSendingWebhook ? 'Signing & Transmitting HMAC Envelope...' : 'Send Verified HMAC Webhook'}
              </button>

              {webhookStatus && (
                <div className={`p-4 rounded-xl border text-xs font-mono break-all ${
                  webhookStatus.startsWith('ERROR')
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                  {webhookStatus}
                </div>
              )}
            </div>
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}

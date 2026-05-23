'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getOrganizerEvents, purchaseTickets, getPlatformFeeRate, type EventData } from '@/lib/db';
import { db } from '@/lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function StripeForm({ onSuccess, onError }: { onSuccess: (piId: string) => void; onError: (msg: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  async function handlePay() {
    if (!stripe || !elements) return;
    setConfirming(true);
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { onError(error.message || 'Erè peman.'); setConfirming(false); return; }
    if (paymentIntent?.status === 'succeeded') onSuccess(paymentIntent.id);
    setConfirming(false);
  }
  return (
    <div>
      <PaymentElement />
      <button onClick={handlePay} disabled={confirming || !stripe}
        className={`w-full mt-4 py-3 rounded-xl font-bold text-sm transition-all ${confirming ? 'bg-white/[0.04] text-gray-muted cursor-not-allowed' : 'bg-orange text-white hover:bg-orange/80'}`}>
        {confirming ? '...' : 'Confirm Payment & Issue Tickets'}
      </button>
    </div>
  );
}

type Step = 'form' | 'pay' | 'done';

export default function IssueTicketsPage() {
  const { user } = useAuth();
  const { t } = useT();

  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [feeRate, setFeeRate] = useState(0.09);

  // Form state
  const [eventIdx, setEventIdx] = useState(0);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');

  // Payment state
  const [step, setStep] = useState<Step>('form');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState('');
  const [issuedCodes, setIssuedCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    Promise.all([
      getOrganizerEvents(user.uid),
      getPlatformFeeRate(),
    ]).then(([evs, rate]) => {
      setEvents(evs.filter(e => e.status === 'published' || e.status === 'live'));
      setFeeRate(rate);
      setLoading(false);
    });
  }, [user?.uid]);

  const selectedEvent = events[eventIdx];
  const selectedSection = selectedEvent?.sections?.[sectionIdx];
  const retailPrice = selectedSection?.price || 0;
  const anbyasFee = Math.round(retailPrice * qty * feeRate * 100) / 100;
  const seats = Array(qty).fill('GA');

  async function handleProceedToPay() {
    if (!buyerName.trim() || !buyerPhone.trim()) { setError('Mete non ak nimewo telefòn acheteur.'); return; }
    if (!selectedEvent?.id || !selectedSection) return;

    // Enforce comp limit for free tickets
    if (retailPrice === 0) {
      const limit = (selectedEvent as any).compLimit ?? 0;
      const issued = (selectedEvent as any).compIssued ?? 0;
      if (limit === 0) { setError('Free ticket issuance is not enabled for this event.'); return; }
      if (issued + qty > limit) { setError(`Comp limit reached. ${limit - issued} free ticket(s) remaining.`); return; }
    }
    setError(''); setPayLoading(true);
    try {
      const res = await fetch('/api/payment/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: anbyasFee,
          currency: 'usd',
          eventName: `Fee: ${selectedEvent.name} ×${qty}`,
          seats: qty,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setClientSecret(data.clientSecret);
      setStep('pay');
    } catch (e: any) {
      setError(e.message || 'Erè.');
    } finally { setPayLoading(false); }
  }

  async function handlePaymentSuccess(paymentIntentId: string) {
    if (!selectedEvent?.id || !selectedSection) return;
    setPayLoading(true); setError('');
    try {
      const tickets = await purchaseTickets(
        selectedEvent.id!, buyerName, buyerEmail, buyerPhone,
        selectedSection.name,
        selectedSection.color || '#fff',
        seats, retailPrice,
        undefined, paymentIntentId, 'stripe',
        { organizerId: user?.uid, sectionName: selectedSection.name, paymentStatus: 'paid' }
      );
      const codes = tickets.map((tk: any) => tk.ticketCode).filter(Boolean);
      setIssuedCodes(codes);

      // Track comp usage
      if (retailPrice === 0 && selectedEvent.id) {
        await updateDoc(doc(db, 'events', selectedEvent.id), { compIssued: increment(qty) });
      }

      // Send via WhatsApp
      const ticketUrl = `${window.location.origin}/ticket/${codes[0]}`;
      const msg = [
        '🎫 *ANBYANS - TIKÈ OU PARE!*', '',
        `🎭 ${selectedEvent.name}`,
        `🎟️ Seksyon: ${selectedSection.name} · ${qty} tikè`,
        '',
        codes.map((c, i) => `🔑 Tikè ${i + 1}: ${c}`).join('\n'),
        '',
        `📱 Wè tikè ou: ${ticketUrl}`,
      ].join('\n');
      const phone = buyerPhone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');

      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Erè pandan emisyon tikè.');
    } finally { setPayLoading(false); }
  }

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (events.length === 0) return (
    <div className="max-w-lg mx-auto px-5 py-12 text-center">
      <p className="text-4xl mb-3">📭</p>
      <p className="text-gray-muted text-sm">No active events. Publish an event first.</p>
    </div>
  );

  if (step === 'done') return (
    <div className="max-w-lg mx-auto px-5 py-12 text-center">
      <p className="text-5xl mb-4">✅</p>
      <h2 className="font-heading text-2xl text-white mb-2">Tickets Issued</h2>
      <p className="text-gray-muted text-sm mb-6">{issuedCodes.length} ticket{issuedCodes.length > 1 ? 's' : ''} sent to {buyerPhone} via WhatsApp</p>
      <div className="bg-dark-card border border-border rounded-xl p-4 mb-6 text-left space-y-2">
        {issuedCodes.map((c, i) => (
          <p key={c} className="font-mono text-xs text-green">🔑 Ticket {i + 1}: {c}</p>
        ))}
      </div>
      <button onClick={() => { setStep('form'); setBuyerName(''); setBuyerPhone(''); setBuyerEmail(''); setQty(1); setIssuedCodes([]); setClientSecret(null); }}
        className="px-8 py-3 rounded-xl bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">
        Issue More Tickets
      </button>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-5 py-8">
      <h1 className="font-heading text-2xl text-white mb-1">Issue Tickets</h1>
      <p className="text-xs text-gray-muted mb-6">Organizer collected payment — pay Anbyans fee to issue tickets</p>

      {step === 'form' && (
        <div className="space-y-4">
          {/* Event */}
          <div className="bg-dark-card border border-border rounded-xl p-4">
            <label className="text-[11px] font-bold text-gray-light uppercase tracking-wide block mb-2">Event</label>
            <div className="flex flex-col gap-2">
              {events.map((ev, i) => (
                <button key={ev.id} onClick={() => { setEventIdx(i); setSectionIdx(0); }}
                  className={`text-left px-3 py-2.5 rounded-lg border text-sm font-semibold transition-all ${eventIdx === i ? 'border-orange/50 bg-orange/10 text-white' : 'border-border bg-white/[0.02] text-gray-light hover:border-white/20'}`}>
                  {ev.name}
                  <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${ev.status === 'live' ? 'bg-green/20 text-green' : 'bg-orange/20 text-orange'}`}>{ev.status}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section */}
          {selectedEvent?.sections?.length > 0 && (
            <div className="bg-dark-card border border-border rounded-xl p-4">
              <label className="text-[11px] font-bold text-gray-light uppercase tracking-wide block mb-2">Section</label>
              <div className="flex flex-wrap gap-2">
                {selectedEvent.sections.map((s, i) => (
                  <button key={i} onClick={() => setSectionIdx(i)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${sectionIdx === i ? 'text-white' : 'border-border text-gray-muted hover:border-white/20'}`}
                    style={{ borderColor: sectionIdx === i ? s.color : undefined, background: sectionIdx === i ? `${s.color}22` : undefined, color: sectionIdx === i ? s.color : undefined }}>
                    {s.name} — ${s.price}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Qty */}
          <div className="bg-dark-card border border-border rounded-xl p-4">
            <label className="text-[11px] font-bold text-gray-light uppercase tracking-wide block mb-3">Quantity</label>
            <div className="flex items-center gap-4">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg border border-border bg-white/[0.04] text-white font-bold text-lg hover:border-white/30 transition-all">−</button>
              <span className="text-3xl font-heading text-white min-w-[2rem] text-center">{qty}</span>
              <button onClick={() => setQty(q => q + 1)} className="w-9 h-9 rounded-lg border border-border bg-white/[0.04] text-white font-bold text-lg hover:border-white/30 transition-all">+</button>
            </div>
          </div>

          {/* Buyer info */}
          <div className="bg-dark-card border border-border rounded-xl p-4 space-y-3">
            <label className="text-[11px] font-bold text-gray-light uppercase tracking-wide block">Buyer Info</label>
            <input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Full name *"
              className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted" />
            <input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} placeholder="WhatsApp / Phone *" type="tel"
              className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted" />
            <input value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} placeholder="Email (optional)"
              className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted" />
          </div>

          {/* Fee summary */}
          <div className="bg-orange/10 border border-orange/30 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-orange font-bold">Anbyans Fee</p>
              <p className="text-[11px] text-gray-muted">{qty} × ${retailPrice} × {Math.round(feeRate * 100)}%</p>
            </div>
            <p className="text-2xl font-heading text-orange">${anbyasFee.toFixed(2)}</p>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button onClick={handleProceedToPay} disabled={payLoading || !buyerName || !buyerPhone}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${(!buyerName || !buyerPhone || payLoading) ? 'bg-white/[0.04] text-gray-muted cursor-not-allowed' : 'bg-orange text-white hover:bg-orange/80'}`}>
            {payLoading ? '...' : `Pay $${anbyasFee.toFixed(2)} & Issue ${qty} Ticket${qty > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {step === 'pay' && clientSecret && (
        <div className="bg-dark-card border border-border rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs font-bold text-gray-light uppercase tracking-wide">Pay Anbyans Fee</p>
            <p className="font-heading text-xl text-orange">${anbyasFee.toFixed(2)}</p>
          </div>
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
            <StripeForm
              onSuccess={handlePaymentSuccess}
              onError={msg => setError(msg)}
            />
          </Elements>
          <button onClick={() => { setStep('form'); setClientSecret(null); setError(''); }}
            className="w-full mt-3 text-xs text-gray-muted hover:text-white transition-colors bg-transparent border-none cursor-pointer py-2">
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}

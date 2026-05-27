'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getEventByPrivateToken, purchaseTickets, getPlatformFeeRate, getBarItems, getBarStations } from '../../lib/db';
import { useT } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  name: string;
  price: number;
  capacity: number;
  sold: number;
  color: string;
  type: 'ga' | 'reserved';
}

interface Seat { row: string; num: number; id: string; taken: boolean; }

interface EventData {
  id: string;
  slug: string;
  title: string;
  date: any;
  venue: string;
  city: string;
  description?: string;
  coverImage?: string;
  sections: Section[];
  organizerId: string;
  organizerName?: string;
  paymentMethods: Record<string, { active: boolean; values?: string[] }>;
  exchangeRate: number;
  status: 'live' | 'upcoming' | 'ended';
  isPrivate?: boolean;
}

type Step = 'detail' | 'seats' | 'info' | 'payment' | 'done';
type PayMethod = 'stripe' | 'moncash' | 'natcash' | 'cash';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateStr(ts: any, locale = 'fr-HT') {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(ts); }
}

function timeStr(ts: any) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

// ─── Seat Map ─────────────────────────────────────────────────────────────────

function SeatMap({ section, takenIds, selected, onToggle }: {
  section: Section;
  takenIds: string[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useT();
  const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, 10);
  const cols = 10;
  return (
    <div className="overflow-auto">
      {/* Stage */}
      <div className="w-full bg-white/[0.06] rounded-lg text-center text-[10px] font-bold text-gray-400 py-2 mb-6 tracking-widest">{t('buy_seat_stage')}</div>
      <div className="flex flex-col gap-1.5 items-center">
        {rows.map(row => (
          <div key={row} className="flex gap-1.5 items-center">
            <span className="text-[9px] text-gray-500 w-4 text-right">{row}</span>
            {Array.from({ length: cols }, (_, i) => {
              const id = `${row}${i + 1}`;
              const taken    = takenIds.includes(id);
              const isSel    = selected.includes(id);
              return (
                <button key={id} disabled={taken} onClick={() => onToggle(id)}
                  className={`w-7 h-7 rounded-md text-[9px] font-bold transition-all ${
                    taken  ? 'bg-white/[0.04] text-gray-700 cursor-not-allowed' :
                    isSel  ? 'bg-orange text-white scale-110 shadow-lg shadow-orange/30' :
                             'bg-white/[0.08] text-gray-300 hover:bg-orange/30'
                  }`}>
                  {i + 1}
                </button>
              );
            })}
            <span className="text-[9px] text-gray-500 w-4">{row}</span>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex gap-4 mt-5 justify-center">
        {[
          { color: 'bg-white/[0.08]',  label: t('buy_seat_available') },
          { color: 'bg-orange',        label: t('buy_seat_selected') },
          { color: 'bg-white/[0.04]',  label: t('buy_seat_taken') },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3.5 h-3.5 rounded ${l.color}`} />
            <span className="text-[9px] text-gray-400">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stripe inner form (must be inside <Elements>) ───────────────────────────

function StripePaymentForm({ total, onSuccess, onError }: {
  total: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const { t } = useT();
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setConfirming(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    setConfirming(false);
    if (error) { onError(error.message || 'Peman echwe'); return; }
    if (paymentIntent?.status === 'succeeded') onSuccess();
  };

  return (
    <div>
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        onClick={handlePay}
        disabled={!stripe || !elements || confirming}
        className="w-full mt-4 py-3.5 rounded-xl font-heading text-base bg-orange text-white disabled:opacity-30 hover:bg-orange/90 transition-all flex items-center justify-center gap-2">
        {confirming
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('buy_processing_btn')}</>
          : `${t('buy_confirm_payment')} · $${total.toFixed(2)}`}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function BuyPageInner() {
  const { t } = useT();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  // event ID comes from ?event=xxx; also support legacy ?slug= and ?token=
  const eventKey = searchParams.get('event') || searchParams.get('slug') || searchParams.get('token') || '';

  const [event, setEvent]       = useState<EventData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [step, setStep]         = useState<Step>('detail');

  // Selection
  const [selSection, setSelSection] = useState<Section | null>(null);
  const [qty, setQty]               = useState(1);
  const [selSeats, setSelSeats]     = useState<string[]>([]);
  const [takenSeats, setTakenSeats] = useState<string[]>([]);

  // Buyer info
  const [name,  setName]   = useState('');
  const [phone, setPhone]  = useState('');
  const [email, setEmail]  = useState('');

  // Payment
  const [payMethod, setPayMethod]   = useState<PayMethod | null>(null);
  const [txnId, setTxnId]           = useState('');
  const [processing, setProcessing] = useState(false);
  const [ticketCodes, setTicketCodes] = useState<string[]>([]);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState('');
  const [purchaseError, setPurchaseError] = useState('');
  const [organizerStripeAccountId, setOrganizerStripeAccountId] = useState<string | null>(null);
  const [feeRate, setFeeRate] = useState(0.09);

  // Bar tab pre-order
  const [barTabAmount, setBarTabAmount] = useState(0);
  const [customTab, setCustomTab]       = useState('');
  const [showBarTab, setShowBarTab]     = useState(false);
  const [barMenuItems, setBarMenuItems] = useState<{name: string; price: number; station: string; stationId: string; stationSections: string[]; sections: string[]}[]>([]);
  const [barCart, setBarCart]           = useState<Record<string, number>>({});

  // ── Restore cart from localStorage after event loads ─────────
  useEffect(() => {
    if (!event || !eventKey) return;
    try {
      const raw = localStorage.getItem(`anbyans-cart-${eventKey}`);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.selSectionId) {
        const sec = event.sections.find(s => s.id === saved.selSectionId);
        if (sec) setSelSection(sec);
      }
      if (saved.qty) setQty(Math.max(1, Math.min(10, Number(saved.qty) || 1)));
      if (saved.name)  setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
      if (saved.email) setEmail(saved.email);
    } catch {}
  }, [event]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save cart to localStorage ───────────────────────────
  useEffect(() => {
    if (!eventKey || step === 'done') return;
    try {
      localStorage.setItem(`anbyans-cart-${eventKey}`, JSON.stringify({
        selSectionId: selSection?.id ?? null,
        qty,
        name,
        phone,
        email,
      }));
    } catch {}
  }, [selSection, qty, name, phone, email, eventKey, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load event ────────────────────────────────────────────────
  useEffect(() => {
    if (!eventKey) return;
    getPlatformFeeRate().then(setFeeRate);
    (async () => {
      try {
        // Try document ID first (most common path from /events/[id])
        let eventId = '';
        let data: any = null;
        const docSnap = await getDoc(doc(db, 'events', eventKey));
        if (docSnap.exists()) {
          eventId = docSnap.id;
          data = docSnap.data();
        }
        // Fallback: try as slug
        if (!data) {
          const snap = await getDocs(query(collection(db, 'events'), where('slug', '==', eventKey)));
          if (!snap.empty) {
            eventId = snap.docs[0].id;
            data = snap.docs[0].data();
          }
        }
        // Fallback: try as private token
        if (!data) {
          const privateEv = await getEventByPrivateToken(eventKey);
          if (privateEv?.id) {
            eventId = privateEv.id;
            data = privateEv;
          }
        }

        if (data) {
          // Fetch organizer's Stripe Connect account for fee splitting
          if (data.organizerId) {
            getDoc(doc(db, 'organizers', data.organizerId))
              .then(snap => {
                if (snap.exists()) setOrganizerStripeAccountId(snap.data().stripeAccountId || null);
              })
              .catch(() => {});
          }
          const rawV = data.venue;
          const venueStr = rawV && typeof rawV === 'object' ? (rawV.name || '') : (rawV || '');
          const cityStr  = rawV && typeof rawV === 'object' ? (rawV.city || '') : (data.city || '');
          setEvent({
            id: eventId,
            slug: data.slug || eventId,
            title: data.title || data.name,
            date: data.startDate || (data.date?.toDate ? data.date.toDate().toISOString() : data.date) || null,
            venue: venueStr,
            city: cityStr,
            description: data.description,
            coverImage: data.coverImage || data.imageUrl,
            sections: (data.sections || []).map((s: any) => ({ ...s, type: s.type || 'ga', sold: s.sold || 0 })),
            organizerId: data.organizerId,
            organizerName: data.organizerName,
            paymentMethods: data.paymentMethods || { cash: { active: true, values: [] } },
            exchangeRate: data.exchangeRate || 130,
            status: data.status === 'published' ? 'upcoming' : (data.status || 'upcoming'),
            isPrivate: data.isPrivate || false,
          } as EventData);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [eventKey]);

  // ── Fetch Stripe PaymentIntent when Stripe selected ──────────
  useEffect(() => {
    const ticketAmount = selSection ? selSection.price * qty : 0;
    const chargeAmount = ticketAmount + barTabAmount;
    if (payMethod !== 'stripe' || !event || !chargeAmount) return;
    setStripeClientSecret(null);
    setStripeError('');
    fetch('/api/payment/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: chargeAmount,
        applicationFeeAmount: ticketAmount * feeRate,
        barTabAmount: barTabAmount || undefined,
        currency: 'usd',
        eventName: event.title,
        seats: qty,
        connectedAccountId: organizerStripeAccountId,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setStripeError(data.error);
        else setStripeClientSecret(data.clientSecret);
      })
      .catch(e => setStripeError(e.message));
  }, [payMethod, selSection, qty, barTabAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load taken seats when section selected ────────────────────
  useEffect(() => {
    if (!selSection || selSection.type !== 'reserved' || !event) return;
    (async () => {
      const q = query(
        collection(db, 'tickets'),
        where('eventId', '==', event.id),
        where('section', '==', selSection.id),
        where('status', '!=', 'cancelled')
      );
      const snap = await getDocs(q);
      setTakenSeats(snap.docs.map(d => d.data().seat).filter(Boolean));
    })();
  }, [selSection, event]);

  const htg = (usd: number) => Math.round(usd * (event?.exchangeRate || 130));
  const fmtPrice = (usd: number) => `$${usd.toFixed(2)} · ${htg(usd).toLocaleString('fr-HT')} HTG`;
  const total       = selSection ? selSection.price * qty : 0;
  const chargeTotal = total + barTabAmount;

  // ── Seat toggle ───────────────────────────────────────────────
  const toggleSeat = (id: string) => {
    setSelSeats(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) :
      prev.length < qty ? [...prev, id] : prev
    );
  };

  // ── Pre-fill from logged-in profile ──────────────────────────
  useEffect(() => {
    if (!user) return;
    const u = user as any;
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
    if (fullName)   setName(prev  => prev  || fullName);
    if (u.phone)    setPhone(prev => prev  || u.phone);
    if (user.email) setEmail(prev => prev  || user.email);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Skip info step for logged-in fans with complete profile ───
  const goToInfo = () => {
    const u = user as any;
    const fullName = [u?.firstName, u?.lastName].filter(Boolean).join(' ');
    if (fullName && u?.phone) {
      setName(fullName);
      setPhone(u.phone);
      if (user?.email) setEmail(user.email);
      setShowBarTab(true);
      if (event?.id) Promise.all([getBarItems(event.id), getBarStations(event.id)]).then(([items, stations]) => {
        setBarMenuItems(items.map(x => {
          const st = stations.find(s => s.id === x.stationId);
          return { name: x.name, price: x.price, station: x.stationName, stationId: x.stationId, stationSections: st?.sections ?? [], sections: x.sections ?? [] };
        }));
      }).catch(() => {});
    } else {
      setStep('info');
    }
  };

  // ── Validate buyer info ───────────────────────────────────────
  const validateInfo = () => {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name  = t('buy_name_required');
    if (!phone.trim()) e.phone = t('buy_phone_required');
    if (email && !/\S+@\S+\.\S+/.test(email)) e.email = t('buy_email_invalid');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Stripe success callback ───────────────────────────────────
  const completeStripePayment = async () => {
    if (!event || !selSection) return;
    setProcessing(true);
    try {
      const seats = selSection.type === 'reserved'
        ? selSeats
        : Array.from({ length: qty }, (_, i) => `GA-${i + 1}`);
      const tkts = await purchaseTickets(
        event.id, name.trim(), email.trim(), phone.trim(),
        selSection.name, selSection.color, seats, selSection.price,
        undefined, undefined, 'stripe',
        { organizerId: event.organizerId, sectionName: selSection.name, priceHTG: htg(selSection.price) },
      );
      setTicketCodes(tkts.map(tk => tk.ticketCode));
      if (barTabAmount > 0 && tkts[0]?.id) {
        const barPreorder = Object.entries(barCart).map(([name, qty]) => ({ name, qty, price: barMenuItems.find(i => i.name === name)?.price ?? 0 })).filter(x => x.qty > 0);
        try { await updateDoc(doc(db, 'tickets', tkts[0].id), { barTabBalance: barTabAmount, barTabSpent: 0, ...(barPreorder.length > 0 ? { barPreorder } : {}) }); } catch {}
      }
      try { localStorage.removeItem(`anbyans-cart-${eventKey}`); } catch {}
      setStep('done');
    } catch (e) { console.error(e); setStripeError('Erè apre peman. Kontakte sipò.'); }
    finally { setProcessing(false); }
  };

  // ── Complete purchase ─────────────────────────────────────────
  const completePurchase = async () => {
    if (!event || !selSection || !payMethod) return;
    if (payMethod === 'stripe') return;
    setProcessing(true);
    try {
      const seats = selSection.type === 'reserved'
        ? selSeats
        : Array.from({ length: qty }, (_, i) => `GA-${i + 1}`);

      const tkts = await purchaseTickets(
        event.id,
        name.trim(),
        email.trim(),
        phone.trim(),
        selSection.name,
        selSection.color,
        seats,
        selSection.price,
        undefined,
        txnId.trim() || undefined,
        payMethod,
        {
          organizerId: event.organizerId,
          sectionName: selSection.name,
          priceHTG:    htg(selSection.price),
          ...(txnId.trim() ? { txnId: txnId.trim() } : {}),
        },
      );

      setTicketCodes(tkts.map(tk => tk.ticketCode));
      if (barTabAmount > 0 && tkts[0]?.id) {
        const barPreorder = Object.entries(barCart).map(([name, qty]) => ({ name, qty, price: barMenuItems.find(i => i.name === name)?.price ?? 0 })).filter(x => x.qty > 0);
        try { await updateDoc(doc(db, 'tickets', tkts[0].id), { barTabBalance: barTabAmount, barTabSpent: 0, ...(barPreorder.length > 0 ? { barPreorder } : {}) }); } catch {}
      }
      try { localStorage.removeItem(`anbyans-cart-${eventKey}`); } catch {}
      setStep('done');
    } catch (e) {
      console.error(e);
      setPurchaseError(t('buy_error_retry'));
    } finally {
      setProcessing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!event) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
      <p className="text-5xl">🎭</p>
      <p className="text-gray-400">{t('buy_event_not_found')}</p>
      <Link href="/events" className="text-orange text-sm">← {t('back')}</Link>
    </div>
  );

  const availMethods = Object.entries(event.paymentMethods || {})
    .filter(([, v]) => v.active)
    .map(([k]) => k as PayMethod);

  const PAY_LABELS: Record<string, string> = {
    moncash: '📱 MonCash',
    natcash: '📱 Natcash',
    stripe:  '💳 Kart / Card',
    cash:    '💵 Cash · Zelle · CashApp',
  };

  // ── Step: Detail ──────────────────────────────────────────────
  if (step === 'detail') return (
    <div className="min-h-screen bg-black text-white">
      {/* Cover */}
      <div className="relative h-56 md:h-72 bg-gradient-to-br from-orange/20 to-purple-900/40">
        {event.coverImage && <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <Link href="/events" className="absolute top-4 left-4 text-white/70 hover:text-white text-sm">← {t('back')}</Link>
        {event.status === 'live' && (
          <span className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse">● LIVE</span>
        )}
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="font-heading text-2xl md:text-3xl text-white leading-tight">{event.title}</h1>
          <p className="text-gray-300 text-sm mt-1">📅 {dateStr(event.date)} · {timeStr(event.date)}</p>
          <p className="text-gray-300 text-sm">📍 {event.venue}{event.city ? `, ${event.city}` : ''}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {event.description && (
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">{event.description}</p>
        )}

        {/* Sections */}
        <h2 className="font-heading text-lg mb-3">{t('buy_choose_ticket')}</h2>
        <div className="space-y-3 mb-6">
          {event.sections.map(sec => {
            const avail  = sec.capacity - (sec.sold || 0);
            const isSel  = selSection?.id === sec.id;
            const soldOut = avail <= 0;
            return (
              <button key={sec.id} disabled={soldOut}
                onClick={() => { setSelSection(sec); setSelSeats([]); }}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                  isSel    ? 'border-orange bg-orange/10' :
                  soldOut  ? 'border-white/[0.04] opacity-40 cursor-not-allowed' :
                             'border-white/[0.08] hover:border-orange/40 bg-white/[0.03]'
                }`}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: sec.color || '#f97316' }} />
                <div className="flex-1">
                  <p className="font-bold text-sm">{sec.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {soldOut
                      ? t('buy_sold_out')
                      : `${avail} ${t('buy_places')} · ${sec.type === 'reserved' ? t('buy_reserved') : 'GA'}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-base text-green">${sec.price}</p>
                  <p className="text-[10px] text-red-400">{htg(sec.price).toLocaleString('fr-HT')} HTG</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Qty + CTA */}
        {selSection && (
          <div className="bg-white/[0.04] rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold">{t('buy_quantity')}</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-full bg-white/[0.08] text-white font-bold hover:bg-orange/30 transition-colors">−</button>
                <span className="text-lg font-heading w-6 text-center">{qty}</span>
                <button onClick={() => setQty(q => Math.min(10, q + 1))}
                  className="w-8 h-8 rounded-full bg-white/[0.08] text-white font-bold hover:bg-orange/30 transition-colors">+</button>
              </div>
            </div>
            <div className="flex justify-between text-sm border-t border-white/[0.06] pt-3">
              <span className="text-gray-400">{t('total')}</span>
              <div className="text-right">
                <p className="font-bold text-green">${total.toFixed(2)}</p>
                <p className="text-[11px] text-red-400">{htg(total).toLocaleString('fr-HT')} HTG</p>
              </div>
            </div>
          </div>
        )}

        <button disabled={!selSection}
          onClick={() => selSection?.type === 'reserved' ? setStep('seats') : goToInfo()}
          className="w-full py-3.5 rounded-xl font-heading text-base bg-orange text-white disabled:opacity-30 hover:bg-orange/90 transition-all">
          {t('buy_continue')}
        </button>
      </div>
    </div>
  );

  // ── Step: Seats ───────────────────────────────────────────────
  if (step === 'seats') return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => setStep('detail')} className="text-gray-400 hover:text-white text-sm mb-4">← {t('back')}</button>
        <h2 className="font-heading text-xl mb-1">{t('buy_choose_seats')}</h2>
        <p className="text-gray-400 text-xs mb-6">
          {selSeats.length}/{qty} {t('buy_seats_selected')} · {selSection?.name}
        </p>
        <SeatMap
          section={selSection!}
          takenIds={takenSeats}
          selected={selSeats}
          onToggle={toggleSeat}
        />
        <button disabled={selSeats.length !== qty}
          onClick={() => goToInfo()}
          className="w-full mt-8 py-3.5 rounded-xl font-heading text-base bg-orange text-white disabled:opacity-30 hover:bg-orange/90 transition-all">
          {t('buy_continue')}
        </button>
      </div>
    </div>
  );

  // ── Step: Info ────────────────────────────────────────────────
  if (step === 'info') return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => setStep(selSection?.type === 'reserved' ? 'seats' : 'detail')}
          className="text-gray-400 hover:text-white text-sm mb-4">← {t('back')}</button>
        <h2 className="font-heading text-xl mb-4">{t('buy_your_info_h')}</h2>

        {user && (
          <div className="flex items-center gap-2 mb-4 bg-green/10 border border-green/20 rounded-xl px-4 py-2.5 text-xs text-green font-bold">
            ✓ Enfòmasyon ou ranpli otomatikman
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('buy_full_name_req')}</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Jean Paul"
              className={`w-full px-4 py-3 rounded-xl bg-white/[0.06] border text-white text-sm outline-none focus:border-orange ${errors.name ? 'border-red-500' : 'border-white/[0.1]'}`} />
            {errors.name && <p className="text-red-400 text-[10px] mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('buy_phone_req')}</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+509 xxxx-xxxx"
              type="tel"
              className={`w-full px-4 py-3 rounded-xl bg-white/[0.06] border text-white text-sm outline-none focus:border-orange ${errors.phone ? 'border-red-500' : 'border-white/[0.1]'}`} />
            {errors.phone && <p className="text-red-400 text-[10px] mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('buy_email_optional')}</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com"
              type="email"
              className={`w-full px-4 py-3 rounded-xl bg-white/[0.06] border text-white text-sm outline-none focus:border-orange ${errors.email ? 'border-red-500' : 'border-white/[0.1]'}`} />
            {errors.email && <p className="text-red-400 text-[10px] mt-1">{errors.email}</p>}
          </div>
        </div>

        {/* Order summary */}
        <div className="mt-6 bg-white/[0.04] rounded-xl p-4 text-sm">
          <p className="font-bold mb-2">{t('buy_summary')}</p>
          <div className="flex justify-between text-gray-400 text-xs mb-1">
            <span>{selSection?.name} × {qty}</span>
            <span className="text-green">${total.toFixed(2)} <span className="text-red-400">· {htg(total).toLocaleString('fr-HT')} HTG</span></span>
          </div>
          {barTabAmount > 0 && (
            <div className="flex justify-between text-gray-400 text-xs mb-1">
              <span>🍺 Bar Tab</span>
              <span className="text-orange">+${barTabAmount.toFixed(2)}</span>
            </div>
          )}
          {selSeats.length > 0 && (
            <p className="text-[10px] text-gray-500">Plas: {selSeats.join(', ')}</p>
          )}
        </div>

        <button onClick={() => {
          if (!validateInfo()) return;
          setShowBarTab(true);
          if (event?.id) Promise.all([getBarItems(event.id), getBarStations(event.id)]).then(([items, stations]) => {
        setBarMenuItems(items.map(x => {
          const st = stations.find(s => s.id === x.stationId);
          return { name: x.name, price: x.price, station: x.stationName, stationId: x.stationId, stationSections: st?.sections ?? [], sections: x.sections ?? [] };
        }));
      }).catch(() => {});
        }}
          className="w-full mt-4 py-3.5 rounded-xl font-heading text-base bg-orange text-white hover:bg-orange/90 transition-all">
          {t('buy_continue')}
        </button>

        {/* ── Bar tab modal ───────────────────────────────────── */}
        {showBarTab && (() => {
          const cartTotal = Object.entries(barCart).reduce((sum, [name, qty]) => {
            const item = barMenuItems.find(i => i.name === name);
            return sum + (item ? item.price * qty : 0);
          }, 0);
          const fanSection = selSection?.name ?? '';
          const eventSectionNames = event?.sections?.map(s => s.name) ?? [];
          const inferStationSections = (stationName: string): string[] => {
            const tokens = stationName.toUpperCase().split(/\s+/);
            return eventSectionNames.filter(sec =>
              tokens.some(tok => tok === sec.toUpperCase() || sec.toUpperCase().includes(tok))
            );
          };
          const visibleItems = barMenuItems.filter(i => {
            const effectiveSections = i.stationSections.length > 0 ? i.stationSections : inferStationSections(i.station);
            if (effectiveSections.length > 0 && !effectiveSections.includes(fanSection)) return false;
            if (i.sections.length > 0 && !i.sections.includes(fanSection)) return false;
            return true;
          });
          const hasMenu = visibleItems.length > 0;
          const stations = hasMenu ? Array.from(new Set(visibleItems.map(i => i.station))) : [];
          const confirm = () => {
            if (hasMenu) setBarTabAmount(cartTotal);
            setShowBarTab(false);
            setStep('payment');
          };
          const skip = () => { setBarTabAmount(0); setCustomTab(''); setBarCart({}); setShowBarTab(false); setStep('payment'); };
          return (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
              onClick={skip}>
              <div className="bg-[#12121a] border border-white/[0.1] rounded-t-2xl sm:rounded-2xl w-full max-w-md flex flex-col max-h-[85vh]"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="text-center px-6 pt-6 pb-4 flex-shrink-0">
                  <p className="text-3xl mb-2">🍺</p>
                  <h3 className="font-heading text-xl text-white">Pre-order from the Bar</h3>
                  <p className="text-gray-400 text-sm mt-1">Pay now, pick up at the event</p>
                </div>

                {hasMenu ? (
                  <>
                    {/* Scrollable item list grouped by station */}
                    <div className="flex-1 overflow-y-auto px-6 pb-2">
                      {stations.map(station => (
                        <div key={station}>
                          {stations.length > 1 && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-4 mb-2">{station}</p>
                          )}
                          {visibleItems.filter(i => i.station === station).map((item) => {
                            const qty = barCart[item.name] ?? 0;
                            return (
                              <div key={item.name} className="flex items-center justify-between py-2.5 border-b border-white/[0.06] last:border-0">
                                <div>
                                  <p className="text-sm font-semibold text-white">{item.name}</p>
                                  <p className="text-orange text-xs font-bold">${item.price.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {qty > 0 && (
                                    <button onClick={() => setBarCart(prev => {
                                      const next = { ...prev };
                                      if (next[item.name] <= 1) delete next[item.name]; else next[item.name]--;
                                      return next;
                                    })} className="w-8 h-8 rounded-full border border-white/20 text-white flex items-center justify-center text-lg leading-none hover:border-orange transition-colors">−</button>
                                  )}
                                  {qty > 0 && <span className="text-white font-bold text-sm w-4 text-center">{qty}</span>}
                                  <button onClick={() => setBarCart(prev => ({ ...prev, [item.name]: (prev[item.name] ?? 0) + 1 }))}
                                    className="w-8 h-8 rounded-full border border-white/20 text-white flex items-center justify-center text-lg leading-none hover:border-orange transition-colors">+</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="px-6 pb-6 pt-3 flex-shrink-0 border-t border-white/[0.07]">
                      {cartTotal > 0 && (
                        <div className="flex justify-between text-sm font-bold mb-3">
                          <span className="text-gray-400">Total pre-order</span>
                          <span className="text-orange text-lg">${cartTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button onClick={skip} className="flex-1 py-3 rounded-xl border border-white/[0.1] text-gray-400 font-bold text-sm hover:border-white/30 transition-all">Skip</button>
                        <button onClick={confirm} className="flex-1 py-3 rounded-xl bg-orange text-white font-bold text-sm hover:bg-orange/90 transition-all">
                          {cartTotal > 0 ? `Add $${cartTotal.toFixed(2)} →` : 'Continue →'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* No menu — fallback to amount picker */
                  <div className="px-6 pb-6">
                    <div className="flex gap-2 mb-4">
                      {[20, 50, 100].map(amt => (
                        <button key={amt} onClick={() => { setBarTabAmount(amt); setCustomTab(''); }}
                          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${barTabAmount === amt ? 'bg-orange/20 border-orange text-orange' : 'border-white/[0.1] text-gray-300 hover:border-orange/40'}`}>
                          +${amt}
                        </button>
                      ))}
                    </div>
                    <div className="relative mb-5">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" min={1} placeholder="Custom amount"
                        value={customTab}
                        onChange={e => { setCustomTab(e.target.value); setBarTabAmount(Math.max(0, parseInt(e.target.value) || 0)); }}
                        className="w-full pl-8 pr-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm outline-none focus:border-orange" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={skip} className="flex-1 py-3 rounded-xl border border-white/[0.1] text-gray-400 font-bold text-sm hover:border-white/30 transition-all">Skip</button>
                      <button onClick={() => { setShowBarTab(false); setStep('payment'); }}
                        className="flex-1 py-3 rounded-xl bg-orange text-white font-bold text-sm hover:bg-orange/90 transition-all">
                        {barTabAmount > 0 ? `Add $${barTabAmount} →` : 'Continue →'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );

  // ── Step: Payment ─────────────────────────────────────────────
  if (step === 'payment') return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => setStep('info')} className="text-gray-400 hover:text-white text-sm mb-4">← {t('back')}</button>
        <h2 className="font-heading text-xl mb-6">{t('buy_payment_h')}</h2>

        {/* Method selector */}
        <div className="space-y-3 mb-6">
          {availMethods.map(m => (
            <button key={m} onClick={() => setPayMethod(m)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                payMethod === m ? 'border-orange bg-orange/10' : 'border-white/[0.08] hover:border-orange/30'
              }`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${payMethod === m ? 'border-orange' : 'border-gray-500'}`}>
                {payMethod === m && <div className="w-2 h-2 rounded-full bg-orange" />}
              </div>
              <span className="font-bold text-sm">{PAY_LABELS[m] || m}</span>
            </button>
          ))}
        </div>

        {/* MonCash / Natcash instructions */}
        {(payMethod === 'moncash' || payMethod === 'natcash') && (
          <div className="bg-white/[0.04] rounded-xl p-4 mb-4 text-sm">
            <p className="font-bold mb-2">📱 {payMethod === 'moncash' ? 'MonCash' : 'Natcash'}</p>
            <p className="text-gray-400 text-xs mb-3">
              {t('buy_send_prefix')} {fmtPrice(total)} {t('buy_send_suffix')}
            </p>
            <div className="bg-black/40 rounded-lg p-3 text-center mb-3">
              <p className="text-[10px] text-gray-500 mb-0.5">{payMethod === 'moncash' ? 'MonCash' : 'Natcash'} #</p>
              <p className="font-heading text-xl text-orange">
                {event.paymentMethods?.[payMethod]?.values?.[0] || '—'}
              </p>
            </div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">
              {t('buy_txn_id')}
            </label>
            <input value={txnId} onChange={e => setTxnId(e.target.value)}
              placeholder="ex: TXN123456"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm outline-none focus:border-orange" />
          </div>
        )}

        {/* Cash / Zelle / CashApp */}
        {payMethod === 'cash' && (
          <div className="bg-white/[0.04] rounded-xl p-4 mb-4 text-sm">
            <p className="font-bold mb-2">💵 Cash · Zelle · CashApp</p>
            <p className="text-gray-400 text-xs">
              {t('buy_cash_pending')}
            </p>
            {(event.paymentMethods?.cash?.values?.length ?? 0) > 0 && (
              <div className="mt-3 bg-black/40 rounded-lg p-3">
                {(event.paymentMethods?.cash?.values ?? []).map((v, i) => (
                  <p key={i} className="text-xs text-orange font-bold">{v}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stripe Elements */}
        {payMethod === 'stripe' && (
          <div className="bg-white/[0.04] rounded-xl p-4 mb-4 text-sm">
            <p className="font-bold mb-3">💳 {t('vend_dash_credit_card')} / Debi</p>
            {stripeError && (
              <p className="text-red-400 text-xs mb-3">{stripeError}</p>
            )}
            {!stripeClientSecret && !stripeError && (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {stripeClientSecret && (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret: stripeClientSecret, appearance: { theme: 'night' } }}>
                <StripePaymentForm
                  total={chargeTotal}
                  onSuccess={completeStripePayment}
                  onError={msg => setStripeError(msg)}
                />
              </Elements>
            )}
          </div>
        )}

        {/* Order total */}
        <div className="bg-white/[0.04] rounded-xl p-4 mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">{selSection?.name} × {qty}</span>
            <span className="font-bold text-green">${total.toFixed(2)}</span>
          </div>
          {barTabAmount > 0 && (
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">🍺 Bar Tab</span>
              <span className="font-bold text-orange">+${barTabAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t border-white/[0.06] pt-2 mt-1">
            <span className="text-gray-400">{t('total')}</span>
            <div className="text-right">
              <p className="font-bold text-green">${chargeTotal.toFixed(2)}</p>
              <p className="text-[11px] text-red-400">{htg(chargeTotal).toLocaleString('fr-HT')} HTG</p>
            </div>
          </div>
        </div>

        {purchaseError && <p className="text-red-400 text-xs mb-3 text-center">{purchaseError}</p>}
        {payMethod !== 'stripe' && (
          <button
            disabled={!payMethod || processing || ((payMethod === 'moncash' || payMethod === 'natcash') && !txnId.trim())}
            onClick={completePurchase}
            className="w-full py-3.5 rounded-xl font-heading text-base bg-orange text-white disabled:opacity-30 hover:bg-orange/90 transition-all flex items-center justify-center gap-2">
            {processing
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('buy_processing_btn')}</>
              : t('buy_confirm_payment')}
          </button>
        )}
      </div>
    </div>
  );

  // ── Step: Done ────────────────────────────────────────────────
  if (step === 'done') return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="font-heading text-2xl mb-2">
          {payMethod === 'cash' || payMethod === 'moncash' || payMethod === 'natcash'
            ? t('buy_pending_ticket')
            : t('buy_confirmed_ticket')}
        </h2>
        <p className="text-gray-400 text-sm mb-8">
          {payMethod === 'cash'
            ? t('buy_cash_confirm_msg')
            : payMethod === 'moncash' || payMethod === 'natcash'
            ? t('buy_moncash_pending_msg')
            : t('buy_stripe_ready_msg')}
        </p>

        <div className="space-y-3 mb-8">
          {ticketCodes.map((code, i) => (
            <div key={code} className="bg-white/[0.06] rounded-xl p-4">
              <p className="text-[10px] text-gray-500 mb-1">
                {t('tickets')} {ticketCodes.length > 1 ? `#${i + 1}` : ''} · {selSection?.name}
                {selSeats[i] ? ` · Plas ${selSeats[i]}` : ''}
              </p>
              <p className="font-heading text-2xl tracking-widest text-orange">{code}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Link href={`/ticket/${ticketCodes[0]}`}
            className="flex-1 py-3 rounded-xl bg-orange text-white font-bold text-sm hover:bg-orange/90 transition-all">
            {t('buy_view_ticket_btn')}
          </Link>
          <Link href="/events"
            className="flex-1 py-3 rounded-xl bg-white/[0.08] text-white font-bold text-sm hover:bg-white/[0.12] transition-all">
            {t('back')}
          </Link>
        </div>
      </div>
    </div>
  );

  return null;
}

export default function BuyPage() {
  return <Suspense><BuyPageInner /></Suspense>;
}

'use client';

import { useEffect, useState, Suspense } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getEventByPrivateToken, getPlatformFeeRate, getBarItems } from '@/lib/db';
import { useT } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import FloorPlanViewer from '@/components/FloorPlanViewer';

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

interface CartItem {
  section: Section;
  qty: number;
  seats: string[];
}

interface EventData {
  id: string;
  slug: string;
  title: string;
  date: any;
  venue: string;
  city: string;
  venuePlaceId?: string;
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

function genCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function dateStr(ts: any) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('fr-HT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(ts); }
}

// ─── Seat Map ─────────────────────────────────────────────────────────────────

function SeatMap({ section, takenIds, selected, onToggle }: {
  section: Section;
  takenIds: string[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useT();
  const rows = 'ABCDEFGHIJ'.split('');
  const cols = 10;
  return (
    <div className="overflow-auto">
      <div className="w-full bg-white/[0.06] rounded-lg text-center text-[10px] font-bold text-gray-400 py-2 mb-6 tracking-widest">{t('buy_seat_stage')}</div>
      <div className="flex flex-col gap-1.5 items-center">
        {rows.map(row => (
          <div key={row} className="flex gap-1.5 items-center">
            <span className="text-[9px] text-gray-500 w-4 text-right">{row}</span>
            {Array.from({ length: cols }, (_, i) => {
              const id = `${row}${i + 1}`;
              const taken = takenIds.includes(id);
              const isSel = selected.includes(id);
              return (
                <button key={id} disabled={taken} onClick={() => onToggle(id)}
                  className={`w-7 h-7 rounded-md text-[9px] font-bold transition-all ${
                    taken  ? 'bg-white/[0.04] text-gray-700 cursor-not-allowed' :
                    isSel  ? 'bg-orange text-white scale-110 shadow-lg shadow-orange/30' :
                             'bg-white/[0.08] text-gray-300 hover:bg-orange/30'
                  }`}>{i + 1}</button>
              );
            })}
            <span className="text-[9px] text-gray-500 w-4">{row}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-5 justify-center">
        {[
          { color: 'bg-white/[0.08]', label: t('buy_seat_available') },
          { color: 'bg-orange',       label: t('buy_seat_selected') },
          { color: 'bg-white/[0.04]', label: t('buy_seat_taken') },
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


// ─── Stripe Form ─────────────────────────────────────────────────────────────

function StripeForm({ onSuccess, processing, setProcessing }: {
  onSuccess: (paymentIntentId: string) => void;
  processing: boolean;
  setProcessing: (v: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');
    const { error: submitError } = await elements.submit();
    if (submitError) { setError(submitError.message || 'Error'); setProcessing(false); return; }
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    if (confirmError) {
      setError(confirmError.message || 'Payment failed');
      setProcessing(false);
    } else if (paymentIntent) {
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <div className="bg-white/[0.04] rounded-xl p-4 mb-4 text-sm">
      <p className="font-bold mb-3">💳 Kart Kredi / Debi</p>
      <div className="bg-white rounded-xl p-3 mb-3">
        <PaymentElement />
      </div>
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <button onClick={handleSubmit} disabled={processing || !stripe}
        className="w-full py-3 rounded-xl font-heading text-base bg-orange text-white disabled:opacity-30 hover:bg-orange/90 transition-all flex items-center justify-center gap-2">
        {processing
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Tann...</>
          : 'Peye ak Kart →'}
      </button>
    </div>
  );
}
// ─── Main component ───────────────────────────────────────────────────────────

function BuyPageInner() {
  const { t } = useT();
  const { user } = useAuth();
  const params = useParams();
  const slug   = params?.slug as string;

  const [event, setEvent]     = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep]       = useState<Step>('detail');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Seat picking
  const [seatSection, setSeatSection]   = useState<Section | null>(null);
  const [takenSeats, setTakenSeats]     = useState<string[]>([]);
  const [pendingSeats, setPendingSeats] = useState<string[]>([]);

  // Buyer info
  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Payment
  const [payMethod, setPayMethod]     = useState<PayMethod | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [txnId, setTxnId]             = useState('');
  const [processing, setProcessing]   = useState(false);
  const [ticketCodes, setTicketCodes] = useState<string[]>([]);
  const [expandedSection, setExpandedSection] = useState('');
  const [organizerStripeId, setOrganizerStripeId] = useState<string | null>(null);
  const [feeRate, setFeeRate] = useState(0.09);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [purchaseError, setPurchaseError] = useState('');

  // Bar tab
  const [showBarTab, setShowBarTab]     = useState(false);
  const [barTabAmount, setBarTabAmount] = useState(0);
  const [customTab, setCustomTab]       = useState('');
  const [barMenuItems, setBarMenuItems] = useState<{name: string; price: number; station: string; sections: string[]}[]>([]);
  const [barCart, setBarCart]           = useState<Record<string, number>>({});

  // ── Pre-fill buyer info from logged-in profile ───────────────
  useEffect(() => {
    if (!user) return;
    const u = user as any;
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
    if (fullName)   setName(prev  => prev  || fullName);
    if (u.phone)    setPhone(prev => prev  || u.phone);
    if (user.email) setEmail(prev => prev  || user.email);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load event ────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    getPlatformFeeRate().then(setFeeRate);
    (async () => {
      try {
        let eventId = '';
        let data: any = null;
        const snap = await getDocs(query(collection(db, 'events'), where('slug', '==', slug)));
        if (!snap.empty) {
          eventId = snap.docs[0].id;
          data = snap.docs[0].data();
        } else {
          const docSnap = await getDoc(doc(db, 'events', slug));
          if (docSnap.exists()) { eventId = docSnap.id; data = docSnap.data(); }
        }
        if (!data) {
          const privateEv = await getEventByPrivateToken(slug);
          if (privateEv) { eventId = privateEv.id ?? slug; data = privateEv; }
        }
        if (data) {
          const rawV = data.venue;
          const venueStr = rawV && typeof rawV === 'object' ? (rawV.name || '') : (String(rawV || ''));
          const cityStr  = rawV && typeof rawV === 'object' ? (rawV.city  || '') : (String(data.city || ''));

          // Fall back to organizer settings for payment methods + exchange rate
          let paymentMethods = data.paymentMethods;
          let exchangeRate   = Number(data.exchangeRate) || 0;
          if (!paymentMethods && data.organizerId) {
            const orgSnap = await getDoc(doc(db, 'organizers', data.organizerId));
            if (orgSnap.exists()) {
              const org = orgSnap.data();
              paymentMethods = org.paymentMethods;
              if (!exchangeRate) exchangeRate = Number(org.exchangeRate) || 130;
            }
          }
          if (!exchangeRate) exchangeRate = 130;

          // Load organizer's Stripe Connect account ID
          let organizerStripeAccountId: string | null = null;
          if (data.organizerId) {
            try {
              const orgDoc = await getDoc(doc(db, 'organizers', data.organizerId));
              if (orgDoc.exists()) organizerStripeAccountId = orgDoc.data().stripeAccountId || null;
            } catch { /* ignore */ }
          }

          if (organizerStripeAccountId) setOrganizerStripeId(organizerStripeAccountId);
          setEvent({
            id: eventId,
            slug: data.slug || eventId,
            title: String(data.title || data.name || ''),
            date: data.startDate || (data.date?.toDate ? data.date.toDate().toISOString() : data.date) || null,
            venue: venueStr,
            city: cityStr,
            venuePlaceId: data.venuePlaceId || null,
            description: data.description ? String(data.description) : undefined,
            coverImage: data.coverImage || data.imageUrl,
            sections: (data.sections || []).map((s: any, i: number) => ({
              ...s,
              id: String(s.id ?? i),
              type: s.type || 'ga',
              sold: s.sold || 0,
              name: String(s.name || ''),
            })),
            organizerId: data.organizerId,
            organizerName: data.organizerName,
            paymentMethods: paymentMethods || { cash: { active: true, values: [] } },
            exchangeRate,
            status: data.status === 'published' ? 'upcoming' : (data.status || 'upcoming'),
            isPrivate: data.isPrivate || false,
          } as EventData);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [slug]);

  // ── Load taken seats ──────────────────────────────────────────
  useEffect(() => {
    if (!seatSection || !event) return;
    (async () => {
      const q = query(
        collection(db, 'tickets'),
        where('eventId', '==', event.id),
        where('section', '==', seatSection.id),
        where('status', '!=', 'cancelled')
      );
      const snap = await getDocs(q);
      setTakenSeats(snap.docs.map(d => d.data().seat).filter(Boolean));
    })();
  }, [seatSection, event]);

  // ── Cart helpers ──────────────────────────────────────────────
  const htg = (usd: number) => Math.round(usd * (event?.exchangeRate || 130));
  const cartTotal   = cart.reduce((sum, item) => sum + item.section.price * item.qty, 0);
  const serviceFee  = Math.round(cartTotal * feeRate * 100) / 100;
  const chargeTotal = cartTotal + serviceFee + barTabAmount; // what fan actually pays
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartItem  = (secId: string) => cart.find(c => c.section.id === secId);

  const adjustQty = (sec: Section, delta: number) => {
    if (sec.type === 'reserved') {
      const existing = cartItem(sec.id);
      if (delta < 0 && (!existing || existing.qty === 0)) return;
      if (delta < 0) {
        setCart(prev => prev.map(c => c.section.id === sec.id
          ? { ...c, qty: c.qty - 1, seats: c.seats.slice(0, c.qty - 1) }
          : c
        ).filter(c => c.qty > 0));
        return;
      }
      // Open seat picker
      setSeatSection(sec);
      setPendingSeats(existing?.seats || []);
      setStep('seats');
      return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.section.id === sec.id);
      const avail = sec.capacity - (sec.sold || 0);
      if (!existing) {
        return delta > 0 ? [...prev, { section: sec, qty: 1, seats: [] }] : prev;
      }
      const newQty = existing.qty + delta;
      if (newQty <= 0) return prev.filter(c => c.section.id !== sec.id);
      if (newQty > Math.min(10, avail)) return prev;
      return prev.map(c => c.section.id === sec.id ? { ...c, qty: newQty } : c);
    });
  };

  const confirmSeats = () => {
    if (!seatSection || pendingSeats.length === 0) return;
    setCart(prev => {
      const existing = prev.find(c => c.section.id === seatSection.id);
      if (existing) {
        return prev.map(c => c.section.id === seatSection.id
          ? { ...c, qty: pendingSeats.length, seats: pendingSeats } : c);
      }
      return [...prev, { section: seatSection, qty: pendingSeats.length, seats: pendingSeats }];
    });
    setSeatSection(null);
    setPendingSeats([]);
    setStep('detail');
  };

  const togglePendingSeat = (id: string) => {
    setPendingSeats(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) :
      prev.length < 10  ? [...prev, id] : prev
    );
  };

  // ── Validate ──────────────────────────────────────────────────
  const validateInfo = () => {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name  = t('buy_name_required');
    if (!phone.trim()) e.phone = t('buy_phone_required');
    if (email && !/\S+@\S+\.\S+/.test(email)) e.email = t('buy_email_invalid');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Complete purchase ─────────────────────────────────────────
  const completePurchase = async () => {
    if (!event || !payMethod || cart.length === 0) return;
    setProcessing(true);
    try {
      const codes: string[] = [];
      const paymentStatus =
        payMethod === 'stripe'  ? 'paid' :
        payMethod === 'moncash' || payMethod === 'natcash' ? 'pending_verification' :
        'pending_cash';

      let firstTicket = true;
      for (const item of cart) {
        const seats = item.section.type === 'reserved' ? item.seats : Array(item.qty).fill(null);
        for (let i = 0; i < item.qty; i++) {
          const code = genCode();
          await addDoc(collection(db, 'tickets'), {
            ticketCode: code, qrData: code,
            eventId: event.id, organizerId: event.organizerId,
            buyerName: name.trim(), buyerPhone: phone.trim(), buyerEmail: email.trim() || null,
            section: item.section.id, sectionName: item.section.name, sectionColor: item.section.color,
            seat: seats[i] || null,
            price: item.section.price, priceHTG: htg(item.section.price),
            serviceFee: Math.round(item.section.price * feeRate * 100) / 100,
            chargeTotal: Math.round(item.section.price * (1 + feeRate) * 100) / 100,
            paymentMethod: payMethod, paymentStatus,
            txnId: txnId.trim() || null,
            status: paymentStatus === 'paid' ? 'valid' : 'pending',
            purchasedAt: serverTimestamp(),
            ...(firstTicket && barTabAmount > 0 ? { barTabBalance: barTabAmount, barTabSpent: 0, ...(Object.keys(barCart).length > 0 ? { barPreorder: Object.entries(barCart).map(([name, qty]) => ({ name, qty, price: barMenuItems.find(i => i.name === name)?.price ?? 0 })).filter(x => x.qty > 0) } : {}) } : {}),
          });
          codes.push(code);
          firstTicket = false;
        }
      }
      setTicketCodes(codes);
      setStep('done');
    } catch (e) {
      console.error(e);
      setPurchaseError(t('buy_error_retry'));
    } finally { setProcessing(false); }
  };

  // ── Loading / not found ───────────────────────────────────────
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
    .filter(([, v]) => v.active).map(([k]) => k as PayMethod);

  const PAY_LABELS: Record<string, string> = {
    moncash: '📱 MonCash',
    natcash: '📱 Natcash',
    stripe:  '💳 Kart / Card',
    cash:    '💵 Cash',
    zelle:   '💵 Zelle',
    cashapp: '💵 CashApp',
    paypal:  '💙 PayPal',
  };

  // Methods that need a phone/account number shown
  const MOBILE_METHODS = ['moncash', 'natcash'];
  const ACCOUNT_METHODS = ['zelle', 'cashapp', 'paypal'];

  // ── Step: Detail ──────────────────────────────────────────────
  if (step === 'detail') return (
    <div className="min-h-screen bg-black text-white pb-32">
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
          <p className="text-gray-300 text-sm mt-1">📅 {dateStr(event.date)}</p>
          <p className="text-gray-300 text-sm">📍 {event.venue}{event.city ? `, ${event.city}` : ''}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {event.description && <p className="text-gray-400 text-sm mb-6 leading-relaxed">{event.description}</p>}

        {/* ── Google Map ── */}
        {(event.venue || event.venuePlaceId) && (
          <div className="mb-5 rounded-xl overflow-hidden border border-white/[0.08]">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/[0.06]">
              <span className="text-sm">📍</span>
              <span className="text-sm font-bold">{event.venue}{event.city ? `, ${event.city}` : ''}</span>
              <a
                href={event.venuePlaceId
                  ? `https://www.google.com/maps/place/?q=place_id:${event.venuePlaceId}`
                  : `https://www.google.com/maps/search/${encodeURIComponent((event.venue || '') + ' ' + (event.city || ''))}`}
                target="_blank" rel="noopener noreferrer"
                onClick={ev => ev.stopPropagation()}
                className="ml-auto text-[10px] text-orange font-bold hover:underline">
                {t('slug_open_maps')} ↗
              </a>
            </div>
            <iframe
              title="venue-map" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              src={event.venuePlaceId
                ? `https://www.google.com/maps/embed/v1/place?key=AIzaSyDvBaqAd8MswI7D8kvA_SCdUpYTEtQz-cs&q=place_id:${event.venuePlaceId}&zoom=15`
                : `https://www.google.com/maps/embed/v1/search?key=AIzaSyDvBaqAd8MswI7D8kvA_SCdUpYTEtQz-cs&q=${encodeURIComponent((event.venue || '') + ' ' + (event.city || ''))}&zoom=15`}
              style={{ width: '100%', height: 180, border: 'none', display: 'block' }}
            />
          </div>
        )}

        {/* ── Floor plan (if organizer set zones) ── */}
        {event.id && (
          <div style={{ marginBottom: 20 }}>
            <FloorPlanViewer
              eventId={event.id}
              sections={event.sections}
              highlightSectionId={expandedSection || (cart.length > 0 ? cart[0].section.id : undefined)}
              onSectionClick={secId => {
                const sec = event.sections.find(s => s.id === secId);
                if (!sec || (sec.capacity - (sec.sold || 0)) <= 0) return;
                setExpandedSection(secId);
                setTimeout(() => {
                  document.getElementById(`sec-${secId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);
              }}
            />
          </div>
        )}

        <h2 className="font-heading text-lg mb-3">{t('slug_choose_tickets')}</h2>

        <div className="space-y-3">
          {event.sections.map(sec => {
            const avail   = sec.capacity - (sec.sold || 0);
            const soldOut = avail <= 0;
            const item    = cartItem(sec.id);
            const qty     = item?.qty || 0;
            const isOpen  = expandedSection === sec.id;

            return (
              <div key={sec.id}
                id={`sec-${sec.id}`}
                onClick={() => !soldOut && setExpandedSection(isOpen ? '' : sec.id)}
                className={`rounded-xl border transition-all ${
                  soldOut    ? 'border-white/[0.04] opacity-40 cursor-not-allowed' :
                  qty > 0    ? 'border-orange bg-orange/10 cursor-pointer' :
                  isOpen     ? 'border-white/20 bg-white/[0.05] cursor-pointer' :
                               'border-white/[0.08] bg-white/[0.03] cursor-pointer hover:border-white/20'
                }`}>

                {/* ── Collapsed row ── */}
                <div className="flex items-center gap-3 p-4">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: sec.color || '#f97316' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{sec.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {soldOut ? t('slug_sold_out')
                        : `${avail} ${t('slug_places')} · ${sec.type === 'reserved' ? t('slug_reserved') : 'GA'}`}
                    </p>
                    {qty > 0 && (
                      <p className="text-[11px] text-orange font-bold mt-0.5">
                        {qty} {t('slug_in_cart')}
                        {item && item.seats.length > 0 && ` · ${item.seats.join(', ')}`}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-heading text-sm text-green">${sec.price}</p>
                    <p className="text-[10px] text-red-400">{htg(sec.price).toLocaleString('fr-HT')} HTG</p>
                    {!soldOut && <p className="text-[10px] text-gray-500 mt-0.5">{isOpen ? '▲' : '▼'}</p>}
                  </div>
                </div>

                {/* ── Expanded content ── */}
                {isOpen && !soldOut && (
                  <div className="px-4 pb-4 pt-0" onClick={ev => ev.stopPropagation()}>
                    <div className="border-t border-white/[0.06] pt-3 flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjustQty(sec, -1)} disabled={qty === 0}
                          className="w-9 h-9 rounded-full bg-white/[0.08] text-white font-bold hover:bg-orange/30 transition-colors disabled:opacity-30 text-xl leading-none">−</button>
                        <span className="text-lg font-heading w-8 text-center">{qty}</span>
                        <button onClick={() => adjustQty(sec, 1)} disabled={qty >= Math.min(10, avail)}
                          className="w-9 h-9 rounded-full bg-white/[0.08] text-white font-bold hover:bg-orange/30 transition-colors disabled:opacity-30 text-xl leading-none">+</button>
                      </div>
                      {qty === 0 ? (
                        <button
                          onClick={() => adjustQty(sec, 1)}
                          className="flex-1 py-2.5 rounded-xl bg-orange text-white font-heading text-sm hover:bg-orange/90 transition-all">
                          {t('slug_add_to_cart')}
                        </button>
                      ) : (
                        <button
                          onClick={() => { setCart(prev => prev.filter(c => c.section.id !== sec.id)); setExpandedSection(''); }}
                          className="flex-1 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-gray-400 font-heading text-sm hover:border-red-500/50 hover:text-red-400 transition-all">
                          {t('slug_remove')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur border-t border-white/[0.08] px-4 py-4 z-50">
          <div className="max-w-2xl mx-auto flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-400">{cartCount} {t('slug_tickets_label')} · <span className="text-gray-500">+${serviceFee.toFixed(2)} frè</span></p>
              <div className="flex items-center gap-2">
                <p className="font-heading text-lg text-green">${chargeTotal.toFixed(2)}</p>
                <p className="text-xs text-red-400">{htg(chargeTotal).toLocaleString('fr-HT')} HTG</p>
              </div>
            </div>
            <button onClick={() => setStep('info')}
              className="px-8 py-3 rounded-xl font-heading text-base bg-orange text-white hover:bg-orange/90 transition-all">
              {t('buy_continue')}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Step: Seats ───────────────────────────────────────────────
  if (step === 'seats' && seatSection) return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => { setSeatSection(null); setPendingSeats([]); setStep('detail'); }}
          className="text-gray-400 hover:text-white text-sm mb-4">← {t('back')}</button>
        <h2 className="font-heading text-xl mb-1">{t('slug_confirm_seats')}</h2>
        <p className="text-gray-400 text-xs mb-6">
          {pendingSeats.length} {t('slug_seats_selected')} · {seatSection.name}
        </p>
        <SeatMap section={seatSection} takenIds={takenSeats} selected={pendingSeats} onToggle={togglePendingSeat} />
        <button disabled={pendingSeats.length === 0} onClick={confirmSeats}
          className="w-full mt-8 py-3.5 rounded-xl font-heading text-base bg-orange text-white disabled:opacity-30 hover:bg-orange/90 transition-all">
          {t('slug_confirm_seats')} ({pendingSeats.length}) →
        </button>
      </div>
    </div>
  );

  // ── Step: Info ────────────────────────────────────────────────
  if (step === 'info') return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => setStep('detail')} className="text-gray-400 hover:text-white text-sm mb-4">← {t('back')}</button>
        <h2 className="font-heading text-xl mb-4">{t('buy_your_info_h')}</h2>
        {user && (
          <div className="flex items-center gap-2 mb-4 bg-green/10 border border-green/20 rounded-xl px-4 py-2.5 text-xs text-green font-bold">
            ✓ Enfòmasyon ou ranpli otomatikman
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('buy_full_name_req')}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Jean Paul"
              className={`w-full px-4 py-3 rounded-xl bg-white/[0.06] border text-white text-sm outline-none focus:border-orange ${errors.name ? 'border-red-500' : 'border-white/[0.1]'}`} />
            {errors.name && <p className="text-red-400 text-[10px] mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('buy_phone_req')}</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+509 xxxx-xxxx" type="tel"
              className={`w-full px-4 py-3 rounded-xl bg-white/[0.06] border text-white text-sm outline-none focus:border-orange ${errors.phone ? 'border-red-500' : 'border-white/[0.1]'}`} />
            {errors.phone && <p className="text-red-400 text-[10px] mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1.5">{t('buy_email_optional')}</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" type="email"
              className={`w-full px-4 py-3 rounded-xl bg-white/[0.06] border text-white text-sm outline-none focus:border-orange ${errors.email ? 'border-red-500' : 'border-white/[0.1]'}`} />
            {errors.email && <p className="text-red-400 text-[10px] mt-1">{errors.email}</p>}
          </div>
        </div>

        {/* Cart summary */}
        <div className="mt-6 bg-white/[0.04] rounded-xl p-4 text-sm">
          <p className="font-bold mb-3">{t('buy_summary')}</p>
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.section.id} className="flex justify-between text-xs">
                <span className="text-gray-300">
                  {item.section.name} × {item.qty}
                  {item.seats.length > 0 && <span className="text-gray-500 ml-1">({item.seats.join(', ')})</span>}
                </span>
                <span>
                  <span className="text-green">${(item.section.price * item.qty).toFixed(2)}</span>
                  <span className="text-red-400 ml-1">{htg(item.section.price * item.qty).toLocaleString('fr-HT')} HTG</span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs border-t border-white/[0.06] pt-2 mt-2 text-gray-400">
            <span>{t('slug_service_fee')}</span>
            <span className="text-gray-400">${serviceFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold pt-1.5">
            <span>{t('total')}</span>
            <span>
              <span className="text-green">${chargeTotal.toFixed(2)}</span>
              <span className="text-red-400 ml-1 text-xs">{htg(chargeTotal).toLocaleString('fr-HT')} HTG</span>
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">{t('slug_fee_nonrefund')}</p>
        </div>
        <button onClick={() => {
          if (!validateInfo()) return;
          setShowBarTab(true);
          if (event?.id) getBarItems(event.id).then(items => setBarMenuItems(items.map(x => ({ name: x.name, price: x.price, station: x.stationName, sections: x.sections ?? [] })))).catch(() => {});
        }}
          className="w-full mt-4 py-3.5 rounded-xl font-heading text-base bg-orange text-white hover:bg-orange/90 transition-all">
          {t('buy_continue')}
        </button>

        {/* Bar tab modal */}
        {showBarTab && (() => {
          const cartTotal = Object.entries(barCart).reduce((sum, [name, qty]) => {
            const item = barMenuItems.find(i => i.name === name);
            return sum + (item ? item.price * qty : 0);
          }, 0);
          const cartSectionNames = cart.map(c => c.section.name);
          const visibleItems = barMenuItems.filter(i => i.sections.length === 0 || i.sections.some(s => cartSectionNames.includes(s)));
          const hasMenu = visibleItems.length > 0;
          const stations = hasMenu ? Array.from(new Set(visibleItems.map(i => i.station))) : [];
          const confirm = () => { if (hasMenu) setBarTabAmount(cartTotal); setShowBarTab(false); setStep('payment'); };
          const skip = () => { setBarTabAmount(0); setCustomTab(''); setBarCart({}); setShowBarTab(false); setStep('payment'); };
          return (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" onClick={skip}>
              <div className="bg-[#12121a] border border-white/[0.1] rounded-t-2xl sm:rounded-2xl w-full max-w-md flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="text-center px-6 pt-6 pb-4 flex-shrink-0">
                  <p className="text-3xl mb-2">🍺</p>
                  <h3 className="font-heading text-xl text-white">Pre-order from the Bar</h3>
                  <p className="text-gray-400 text-sm mt-1">Pay now, pick up at the event</p>
                </div>

                {hasMenu ? (
                  <>
                    <div className="flex-1 overflow-y-auto px-6 pb-2">
                      {stations.map(station => (
                        <div key={station}>
                          {stations.length > 1 && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-4 mb-2">{station}</p>
                          )}
                          {visibleItems.filter(i => i.station === station).map(item => {
                            const qty = barCart[item.name] ?? 0;
                            return (
                              <div key={item.name} className="flex items-center justify-between py-2.5 border-b border-white/[0.06] last:border-0">
                                <div>
                                  <p className="text-sm font-semibold text-white">{item.name}</p>
                                  <p className="text-orange text-xs font-bold">${item.price.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {qty > 0 && (
                                    <button onClick={() => setBarCart(prev => { const next = { ...prev }; if (next[item.name] <= 1) delete next[item.name]; else next[item.name]--; return next; })}
                                      className="w-8 h-8 rounded-full border border-white/20 text-white flex items-center justify-center text-lg leading-none hover:border-orange transition-colors">−</button>
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
                      <input type="number" min={1} placeholder="Custom amount" value={customTab}
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

        <div className="space-y-3 mb-6">
          {availMethods.map(m => (
            <button key={m} onClick={async () => {
              setPayMethod(m);
              if (m === 'stripe' && !clientSecret) {
                try {
                  const res = await fetch('/api/payment/stripe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      amount: chargeTotal,
                      applicationFeeAmount: serviceFee,
                      eventName: event?.title,
                      seats: cartCount,
                      connectedAccountId: organizerStripeId,
                    }),
                  });
                  const data = await res.json();
                  if (data.clientSecret) setClientSecret(data.clientSecret);
                } catch (e) { console.error(e); }
              }
            }}
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

        {(payMethod && MOBILE_METHODS.includes(payMethod)) && (
          <div className="bg-white/[0.04] rounded-xl p-4 mb-4 text-sm">
            <p className="font-bold mb-2">📱 {payMethod === 'moncash' ? 'MonCash' : 'Natcash'}</p>
            <p className="text-gray-400 text-xs mb-3">
              {t('buy_send_prefix')} ${chargeTotal.toFixed(2)} {t('buy_send_suffix')}
            </p>
            <div className="bg-black/40 rounded-lg p-3 text-center mb-3">
              <p className="text-[10px] text-gray-500 mb-0.5">{payMethod === 'moncash' ? 'MonCash' : 'Natcash'} #</p>
              <p className="font-heading text-xl text-orange">{event.paymentMethods?.[payMethod]?.values?.[0] || '—'}</p>
            </div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">{t('buy_txn_id')}</label>
            <input value={txnId} onChange={e => setTxnId(e.target.value)} placeholder="ex: TXN123456"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm outline-none focus:border-orange" />
          </div>
        )}

        {payMethod === 'cash' && (
          <div className="bg-white/[0.04] rounded-xl p-4 mb-4 text-sm">
            <p className="font-bold mb-2">💵 Cash · Zelle · CashApp</p>
            <p className="text-gray-400 text-xs">
              {t('buy_cash_pending')}
            </p>
            {(event.paymentMethods?.cash?.values?.length ?? 0) > 0 && (
              <div className="mt-3 bg-black/40 rounded-lg p-3">
                {event.paymentMethods.cash.values!.map((v, i) => <p key={i} className="text-xs text-orange font-bold">{v}</p>)}
              </div>
            )}
          </div>
        )}

        {payMethod === 'stripe' && clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
            <StripeForm
              processing={processing}
              setProcessing={setProcessing}
              onSuccess={async (paymentIntentId) => {
                // Write tickets as paid
                if (!event || cart.length === 0) return;
                try {
                  const codes: string[] = [];
                  let firstTicket = true;
                  for (const item of cart) {
                    const seats = item.section.type === 'reserved' ? item.seats : Array(item.qty).fill(null);
                    for (let i = 0; i < item.qty; i++) {
                      const code = genCode();
                      await addDoc(collection(db, 'tickets'), {
                        ticketCode: code, qrData: code,
                        eventId: event.id, organizerId: event.organizerId,
                        buyerName: name.trim(), buyerPhone: phone.trim(), buyerEmail: email.trim() || null,
                        section: item.section.id, sectionName: item.section.name, sectionColor: item.section.color,
                        seat: seats[i] || null,
                        price: item.section.price, priceHTG: htg(item.section.price),
                        paymentMethod: 'stripe', paymentStatus: 'paid',
                        txnId: paymentIntentId,
                        status: 'valid',
                        purchasedAt: serverTimestamp(),
                        ...(firstTicket && barTabAmount > 0 ? { barTabBalance: barTabAmount, barTabSpent: 0, ...(Object.keys(barCart).length > 0 ? { barPreorder: Object.entries(barCart).map(([name, qty]) => ({ name, qty, price: barMenuItems.find(i => i.name === name)?.price ?? 0 })).filter(x => x.qty > 0) } : {}) } : {}),
                      });
                      codes.push(code);
                      firstTicket = false;
                    }
                  }
                  setTicketCodes(codes);
                  setStep('done');
                } catch (e) { console.error(e); }
              }}
            />
          </Elements>
        )}
        {payMethod === 'stripe' && !clientSecret && (
          <div className="bg-white/[0.04] rounded-xl p-4 mb-4 text-sm text-center text-gray-400">
            <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            {t('loading')}
          </div>
        )}

        <div className="bg-white/[0.04] rounded-xl p-4 mb-4 text-sm">
          <p className="font-bold mb-2">{t('buy_summary')}</p>
          {cart.map(item => (
            <div key={item.section.id} className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{item.section.name} × {item.qty}</span>
              <span className="text-green">${(item.section.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between text-xs text-gray-500 border-t border-white/[0.06] pt-2 mt-1">
            <span>{t('slug_fee_short')}</span>
            <span>${serviceFee.toFixed(2)}</span>
          </div>
          {barTabAmount > 0 && (
            <div className="flex justify-between text-xs text-gray-400 pt-1">
              <span>🍺 Bar Tab</span>
              <span className="text-orange">+${barTabAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-1.5">
            <span>{t('total')}</span>
            <div className="text-right">
              <p className="text-green">${chargeTotal.toFixed(2)}</p>
              <p className="text-[11px] text-red-400">{htg(chargeTotal).toLocaleString('fr-HT')} HTG</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">{t('slug_fee_nonrefund')}</p>
        </div>

        {purchaseError && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{purchaseError}</p>}
        {payMethod !== 'stripe' && <button
          disabled={!payMethod || processing || (payMethod && MOBILE_METHODS.includes(payMethod) && !txnId.trim())}
          onClick={completePurchase}
          className="w-full py-3.5 rounded-xl font-heading text-base bg-orange text-white disabled:opacity-30 hover:bg-orange/90 transition-all flex items-center justify-center gap-2">
          {processing
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('buy_processing_btn')}</>
            : t('buy_confirm_payment')}
        </button>}
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
              <p className="text-[10px] text-gray-500 mb-1">{t('tickets')} #{i + 1}</p>
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

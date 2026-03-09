'use client';
import QRCode from '@/components/QRCode';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useT } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import LangSwitcher from '@/components/LangSwitcher';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  getPublishedEvents,
  purchaseTickets,
  type EventData,
  type EventSection,
  type TicketData,
} from '@/lib/db';

// ─── Helpers ─────────────────────────────────────────────────────

const FEE = 0.085;
const MAX_SEATS = 10;
const ROWS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function seatGrid(capacity: number): { rows: number; cols: number } {
  const cols = capacity <= 20 ? capacity : capacity <= 50 ? 10 : capacity <= 200 ? 14 : capacity <= 500 ? 18 : 20;
  const rows = Math.ceil(capacity / cols);
  return { rows, cols };
}

// ─── Component ───────────────────────────────────────────────────

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);

function BuyTicketInner() {
  const { t, locale } = useT();
  const { user } = useAuth();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale as 'ht' | 'en' | 'fr']);
  const searchParams = useSearchParams();

  const STEP_LABELS = [
    L('Chwazi Evènman', 'Choose Event', 'Choisir un événement'),
    L('Chwazi Seksyon', 'Choose Section', 'Choisir une section'),
    L('Chwazi Plas', 'Choose Seats', 'Choisir des places'),
    L('Revize', 'Review', 'Réviser'),
    L('Peye', 'Pay', 'Payer'),
  ];

  // Data
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  // Flow
  const [step, setStep] = useState(1);
  const [ev, setEv] = useState<EventData | null>(null);
  const [sec, setSec] = useState<EventSection | null>(null);
  const [seats, setSeats] = useState<string[]>([]);
  const [pay, setPay] = useState('');
  const [promo, setPromo] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const stripeHook = useStripe();
  const elements = useElements();
  const [purchasedTickets, setPurchasedTickets] = useState<TicketData[]>([]);
  const [holdTime, setHoldTime] = useState(600);
  const [qrKey, setQrKey] = useState(0);
  const [qrCountdown, setQrCountdown] = useState(15);

  // Buyer info
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');

  // Load events from Firestore
  useEffect(() => {
    (async () => {
      try {
        const data = await getPublishedEvents();
        setEvents(data);
      } catch (err) {
        console.error('Failed to load events:', err);
      }
      setLoading(false);
    })();
  }, []);

  // Auto-select event from URL ?event=ID
  useEffect(() => {
    const eventId = searchParams.get('event');
    if (eventId && events.length > 0 && step === 1) {
      const found = events.find(e => e.id === eventId);
      if (found) {
        setEv(found);
        setSec(null);
        setSeats([]);
        setStep(2);
      }
    }
  }, [events, searchParams]);

  // Pre-fill buyer info from auth
  useEffect(() => {
    if (user) {
      setBuyerEmail(user.email || '');
      setBuyerName((user as any)?.firstName || user.email?.split('@')[0] || '');
    }
  }, [user]);

  // Hold timer
  useEffect(() => {
    if (step < 3 || confirmed) return;
    const ti = setInterval(() => setHoldTime(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(ti);
  }, [step, confirmed]);

  // QR rotation
  useEffect(() => {
    if (!confirmed) return;
    const ti = setInterval(() => {
      setQrCountdown(p => { if (p <= 1) { setQrKey(k => k + 1); return 15; } return p - 1; });
    }, 1000);
    return () => clearInterval(ti);
  }, [confirmed]);

  // Calculations
  const calcTotal = useCallback(() => {
    if (!sec || seats.length === 0) return { sub: 0, fee: 0, disc: 0, total: 0 };
    const sub = seats.length * sec.price;
    const fee = Math.round(sub * FEE * 100) / 100;
    const disc = promo > 0 ? Math.round(sub * promo * 100) / 100 : 0;
    return { sub, fee, disc, total: sub + fee - disc };
  }, [sec, seats, promo]);

  const { sub, fee, disc, total } = calcTotal();
  const holdMin = Math.floor(holdTime / 60);
  const holdSec2 = holdTime % 60;

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    // Check event promos
    const eventPromo = ev?.promos?.find(p => p.code === code);
    if (eventPromo) {
      const discount = eventPromo.type === 'percent' ? eventPromo.discount / 100 : 0;
      setPromo(discount);
      setPromoMsg(`✅ ${code} — ${Math.round(discount * 100)}% ${L('rabè', 'off', 'remise')}!`);
    } else {
      setPromoMsg(`✕ ${L('Kòd pa valid.', 'Invalid code.', 'Code invalide.')}`);
    }
  };

  const toggleSeat = (id: string) => {
    if (seats.includes(id)) setSeats(seats.filter(s => s !== id));
    else if (seats.length < MAX_SEATS) setSeats([...seats, id]);
  };

  const doPayment = async () => {
    if (!ev?.id || !sec) return;
    // Non-card: save pending order directly
    if (pay !== 'card') {
      setProcessing(true);
      try {
        await purchaseTickets(ev.id, buyerName, buyerEmail, buyerPhone, sec.name, sec.color ?? '#fff', seats.length, sec.price * seats.length);
        setStep(6);
      } catch (e: any) {
        alert(L('Erè. Eseye anko.', 'Error. Try again.', 'Erreur.'));
      }
      setProcessing(false);
      return;
    }
    if (!stripeHook || !elements) {
      alert(L('Stripe pa chaje. Eseye anko.', 'Stripe not loaded. Try again.', 'Stripe non charge.'));
      return;
    }
    const card = elements.getElement(CardElement);
    if (!card) return;
    setProcessing(true);
    try {
      // 1. Create PaymentIntent
      const totalAmount = sec.price * seats.length;
      const res = await fetch('/api/payment/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalAmount, eventName: ev.name, seats: seats.length }),
      });
      const { clientSecret, error: apiError } = await res.json();
      if (apiError) throw new Error(apiError);

      // 2. Confirm card payment
      const { error: stripeError, paymentIntent } = await stripeHook.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });
      if (stripeError) throw new Error(stripeError.message);
      if (paymentIntent?.status !== 'succeeded') throw new Error('Payment not confirmed');

      // 3. Create tickets in Firestore
      const tickets = await purchaseTickets(
        ev.id,
        buyerName || 'Guest',
        buyerEmail,
        buyerPhone,
        sec.name,
        sec.color,
        seats,
        sec.price,
      );
      setPurchasedTickets(tickets);
      setConfirmed(true);
    } catch (err) {
      console.error('Purchase failed:', err);
      alert(err instanceof Error ? err.message : L('Ere. Eseye ankò.', 'Error. Try again.', 'Erreur.'));
    }
    setProcessing(false);
  };

  const goNext = () => {
    if (step === 5) { doPayment(); return; }
    setStep(step + 1);
  };

  const goBack = () => {
    if (step === 3) setSeats([]);
    if (step > 1) setStep(step - 1);
  };

  const canNext = step === 1 ? !!ev : step === 2 ? !!sec : step === 3 ? seats.length > 0 : step === 4 ? !!buyerPhone.trim() : !!pay;

  const perSeat = L('pa plas', 'per seat', 'par place');
  const availOf = L('disponib sou', 'available of', 'disponible sur');
  const stageLabel = L('SÈNN', 'STAGE', 'SCÈNE');
  const chooseLabel = L('Chwazi', 'Selected', 'Sélectionné');
  const takenLabel = L('Pran', 'Taken', 'Pris');
  const availLabel = L('Disponib', 'Available', 'Disponible');

  // ═══════════════════════════════════════════════════════════════
  // CONFIRMED
  // ═══════════════════════════════════════════════════════════════

  if (confirmed && purchasedTickets.length > 0) {
    const ticket = purchasedTickets[0];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px] text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="font-heading text-3xl tracking-wide mb-1">{L('TIKÈ OU PARE!', 'YOUR TICKET IS READY!', 'VOTRE BILLET EST PRÊT !')}</h2>
          <p className="text-xs text-gray-light mb-6">{L('Prezante QR kòd sa a nan antre a.', 'Show this QR code at the entrance.', 'Présentez ce QR code à l\'entrée.')}</p>
          <div className="bg-dark-card border border-border rounded-2xl p-6 relative">
            <div className="absolute top-1/2 -left-2.5 w-5 h-5 rounded-full bg-dark" />
            <div className="absolute top-1/2 -right-2.5 w-5 h-5 rounded-full bg-dark" />
            <p className="font-bold text-lg">{ev?.name}</p>
            <p className="text-xs text-gray-light mt-1">📍 {ev?.venue?.name} · 📅 {ev?.startDate} · 🕐 {ev?.startTime}</p>
            <div className="mt-3 mb-3">
              <span className="px-3 py-1 rounded-md text-[10px] font-bold border" style={{ color: sec?.color, borderColor: sec?.color, background: sec?.color + '15' }}>
                {sec?.name}
              </span>
            </div>
            <p className="text-xs text-gray-light">{L('Plas', 'Seats', 'Places')}: {seats.join(', ')} ({purchasedTickets.length} {purchasedTickets.length === 1 ? L('tikè', 'ticket', 'billet') : L('tikè', 'tickets', 'billets')})</p>
            <div className="mt-4 mb-2 flex justify-center">
              <QRCode key={qrKey} data={`${ticket.qrData}:${qrKey}`} size={156} />
            </div>
            <p className="text-[10px] text-gray-muted">{L('QR kòd ap chanje chak', 'QR code changes every', 'Le QR code change toutes les')} {qrCountdown}s</p>
            <p className="text-xs font-bold mt-3">Ref: {ticket.ticketCode}</p>
            <p className="text-[9px] text-gray-muted mt-1 font-mono break-all">{ticket.qrData}</p>
          </div>
          <p className="text-sm text-cyan font-bold text-center mt-6 mb-2">👇 {L('Klike pou resevwa tikè ou sou WhatsApp', 'Click to receive your ticket on WhatsApp', 'Cliquez pour recevoir votre billet sur WhatsApp')}</p>
          <div className="flex gap-2.5 justify-center">
<Link href="/events" className="px-5 py-3 rounded-lg bg-cyan text-dark font-bold text-sm hover:bg-white transition-all">🎫 {L('Wè Plis Evènman', 'See More Events', 'Voir plus d\'événements')}</Link>
<button onClick={() => {
  const phone = buyerPhone.replace(/[^0-9]/g, '');
  const ticketUrl = `${window.location.origin}/ticket/${purchasedTickets[0]?.ticketCode}`;
  const pin = purchasedTickets[0]?.buyerPin || '';
  const msg = `🎫 *ANBYANS - TIKÈ OU PARE!*\n\n🎭 ${ev?.name}\n📍 ${ev?.venue?.name}\n📅 ${ev?.startDate} · 🕐 ${ev?.startTime}\n\n🎟️ Seksyon: ${sec?.name}\n💺 Plas: ${seats.join(', ')}\n🔑 Kòd: ${purchasedTickets[0]?.ticketCode}\n🔐 PIN: ${pin}\n\n📱 Wè tikè ou: ${ticketUrl}\n\n⚠️ Kenbe PIN ou an sekirite. Ou bezwen li pou wè tikè ou sou aplikasyon an\n\n🛡️ Pwoteje pa Anbyans`;
  if (phone) {
    window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  } else {
    window.location.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }
}} className="px-5 py-3 rounded-lg border border-green text-green font-bold text-sm hover:bg-green hover:text-dark transition-all">📲 WhatsApp</button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PROCESSING
  // ═══════════════════════════════════════════════════════════════

  if (processing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cyan border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-light">{L('Ap trete peman an...', 'Processing payment...', 'Traitement du paiement...')}</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN FLOW
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen flex flex-col pb-20">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-dark border-b border-border px-5">
        <div className="max-w-[1100px] mx-auto flex items-center h-[52px] gap-3.5">
          <Link href="/"><span className="font-heading text-sm tracking-widest">ANBYANS</span></Link>
          <span className="font-heading text-base tracking-wide flex-1">{L('ACHTE TIKÈ', 'BUY TICKETS', 'ACHETER DES BILLETS')}</span>
          {step >= 3 && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-orange">
              <div className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
              <span className={holdTime <= 60 ? 'text-red' : ''}>{holdMin}:{holdSec2 < 10 ? '0' : ''}{holdSec2}</span>
            </div>
          )}
          <LangSwitcher />
          <Link href="/events" className="px-3 py-1.5 rounded-lg border border-border text-gray-light text-[11px] hover:border-cyan hover:text-cyan transition-all">← {L('Retounen', 'Back', 'Retour')}</Link>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto w-full px-5 pt-5 flex-1">
        {/* Steps */}
        <div className="flex items-center gap-0 mb-5 overflow-x-auto">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <div key={n} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${done ? 'bg-green text-white' : active ? 'bg-cyan text-dark' : 'bg-white/[0.04] border border-border text-gray-muted'}`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`text-[10px] whitespace-nowrap ${done ? 'text-green' : active ? 'text-white font-semibold' : 'text-gray-muted'}`}>{label}</span>
                </div>
                {n < 5 && <div className="w-[30px] h-px bg-border mx-1.5 flex-shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* ════════════ STEP 1: Choose Event ════════════ */}
        {step === 1 && (
          <div>
            <h3 className="font-heading text-xl tracking-wide mb-3.5">{L('CHWAZI EVÈNMAN', 'CHOOSE EVENT', 'CHOISIR UN ÉVÉNEMENT')}</h3>
            {loading ? (
              <div className="text-center py-10">
                <div className="w-8 h-8 border-4 border-cyan border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-light mt-3">{L('Ap chaje...', 'Loading...', 'Chargement...')}</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-3">🎭</div>
                <p className="text-gray-light">{L('Pa gen evènman disponib kounye a.', 'No events available right now.', 'Aucun événement disponible pour le moment.')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {events.map(e => {
                  const minP = e.sections?.length > 0 ? Math.min(...e.sections.map(s => s.price)) : 0;
                  const selected = ev?.id === e.id;
                  const emoji = e.category === 'Mizik' ? '🎶' : e.category === 'Fèt' ? '🎧' : e.category === 'Festival' ? '🥁' : '🎭';
                  return (
                    <div key={e.id} onClick={() => { setEv(e); setSec(null); setSeats([]); setPromo(0); setTimeout(goNext, 200); }}
                      className={`flex gap-3.5 bg-dark-card border rounded-card p-3.5 cursor-pointer transition-all hover:-translate-y-0.5 ${selected ? 'border-cyan bg-cyan-dim' : 'border-border hover:border-white/[0.12]'}`}>
                      <div className="w-20 h-20 rounded-[10px] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-4xl flex-shrink-0">{emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] uppercase tracking-widest text-cyan font-bold">{e.category}</div>
                        <div className="text-base font-bold mt-0.5">{e.name}</div>
                        <div className="flex flex-wrap gap-2.5 text-[11px] text-gray-light mt-1">
                          <span>📍 {e.venue?.name}</span>
                          <span>📅 {e.startDate}</span>
                          <span>🕐 {e.startTime}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-heading text-xl">${minP}</div>
                        <div className="text-[9px] text-gray-muted">{L('depi', 'from', 'à partir de')}</div>
                        {e.status === 'live' && <div className="mt-1 text-[9px] font-bold text-red animate-pulse">● {L('AN DIRÈK', 'LIVE', 'EN DIRECT')}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════ STEP 2: Choose Section ════════════ */}
        {step === 2 && ev && (
          <div>
            <h3 className="font-heading text-xl tracking-wide mb-3.5">{ev.name} — {L('Chwazi Seksyon', 'Choose Section', 'Choisir une section')}</h3>
            <div className="bg-dark-card border border-border rounded-card p-4 mb-4 text-center">
              <span className="text-2xl">🎤</span>
              <p className="text-xs text-gray-muted font-bold mt-1">{stageLabel}</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {(ev.sections || []).map((s, idx) => {
                const avail = s.capacity - (s.sold || 0);
                const pct = s.capacity > 0 ? Math.round((s.sold || 0) / s.capacity * 100) : 0;
                const selected = sec?.name === s.name;
                return (
                  <div key={idx} onClick={() => { setSec(s); setSeats([]); setTimeout(goNext, 200); }}
                    className={`flex items-center gap-3.5 bg-dark-card border rounded-card p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${selected ? 'border-cyan bg-cyan-dim' : 'border-border hover:border-white/[0.12]'}`}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold">{s.name}</div>
                      <div className={`text-[11px] mt-1 ${pct > 75 ? 'text-red' : 'text-green'}`}>{pct > 75 ? '⚡ ' : ''}{avail} {availOf} {s.capacity}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-heading text-2xl" style={{ color: s.color }}>${s.price}</div>
                      <div className="text-[9px] text-gray-muted">{perSeat}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════ STEP 3: Choose Seats ════════════ */}
        {step === 3 && sec && (
          <div>
            <h3 className="font-heading text-xl tracking-wide mb-3.5">{sec.name} — {L('Chwazi Plas', 'Choose Seats', 'Choisir des places')}</h3>
            <div className="bg-dark-card border border-border rounded-card p-4 mb-4 text-center">
              <span className="text-xl">🎤</span>
              <p className="text-[10px] text-gray-muted font-bold mt-0.5">{stageLabel}</p>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: sec.color }} />
              <span className="text-xs font-bold">{sec.name}</span>
              <span className="text-xs text-gray-muted">— ${sec.price} {perSeat}</span>
            </div>
            {(() => {
              const { rows, cols } = seatGrid(sec.capacity);
              const soldCount = sec.sold || 0;
              // Generate "taken" seats deterministically from sold count
              const takenSet = new Set<number>();
              let seed = sec.name.length * 7 + sec.capacity;
              for (let i = 0; i < soldCount && i < sec.capacity; i++) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                let idx = seed % (rows * cols);
                while (takenSet.has(idx)) idx = (idx + 1) % (rows * cols);
                takenSet.add(idx);
              }
              return (
                <>
                  <div className="overflow-x-auto pb-4">
                    <div className="flex flex-col gap-1 min-w-fit">
                      {Array.from({ length: rows }).map((_, r) => (
                        <div key={r} className="flex items-center gap-0.5">
                          <span className="w-5 text-[9px] text-gray-muted text-center font-bold">{ROWS[r] || r}</span>
                          {Array.from({ length: cols }).map((_, c) => {
                            const idx = r * cols + c;
                            if (idx >= sec.capacity) return <div key={c} className="w-7 h-7" />;
                            const seatId = (ROWS[r] || r) + '' + (c + 1);
                            const taken = takenSet.has(idx);
                            const selected = seats.includes(seatId);
                            const isGap = cols > 12 && (c === 2 || c === cols - 3);
                            return (
                              <div key={c} className="flex items-center">
                                {isGap && <div className="w-3" />}
                                <button onClick={() => !taken && toggleSeat(seatId)} disabled={taken}
                                  className={`w-7 h-7 rounded text-[8px] font-bold transition-all ${taken ? 'bg-white/[0.03] text-gray-muted/30 cursor-not-allowed opacity-20' : selected ? 'text-dark scale-110 shadow-lg' : 'bg-white/[0.06] text-gray-light hover:bg-white/[0.12] cursor-pointer'}`}
                                  style={selected ? { background: sec.color } : undefined}>
                                  {c + 1}
                                </button>
                              </div>
                            );
                          })}
                          <span className="w-5 text-[9px] text-gray-muted text-center font-bold">{ROWS[r] || r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2 mb-4">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-muted"><div className="w-4 h-4 rounded bg-white/[0.06]" /> {availLabel}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-muted"><div className="w-4 h-4 rounded" style={{ background: sec.color }} /> {chooseLabel}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-muted"><div className="w-4 h-4 rounded bg-white/[0.03] opacity-20" /> {takenLabel}</div>
                  </div>
                </>
              );
            })()}
            {seats.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {seats.map(s => (
                  <span key={s} className="px-2 py-0.5 rounded text-[10px] font-bold border" style={{ color: sec.color, borderColor: sec.color, background: sec.color + '15' }}>{s}</span>
                ))}
                <span className="ml-auto font-heading text-xl" style={{ color: sec.color }}>${seats.length * sec.price}</span>
              </div>
            )}
          </div>
        )}

        {/* ════════════ STEP 4: Review ════════════ */}
        {step === 4 && ev && sec && (
          <div>
            <h3 className="font-heading text-xl tracking-wide mb-3.5">{L('REVIZE KÒMAND', 'REVIEW ORDER', 'RÉVISER LA COMMANDE')}</h3>
            <div className="bg-dark-card border border-border rounded-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-[10px] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-3xl flex-shrink-0">🎭</div>
                <div>
                  <p className="font-bold">{ev.name}</p>
                  <p className="text-xs text-gray-light">📍 {ev.venue?.name} · 📅 {ev.startDate} · 🕐 {ev.startTime}</p>
                </div>
              </div>

              {/* Buyer info */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-light">{L('Enfòmasyon Ou', 'Your Info', 'Vos informations')}</h4>
                <input value={buyerName} onChange={e => setBuyerName(e.target.value)}
                  placeholder={L('Non konplè', 'Full name', 'Nom complet')!}
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" />
              <input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)}
                  placeholder={L('WhatsApp / Telefòn (obligatwa)', 'WhatsApp / Phone (required)', 'WhatsApp / Téléphone (obligatoire)')!} type="tel"
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" />
                <input value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)}
                  placeholder={L('Imèl (opsyonèl)', 'Email (optional)', 'E-mail (optionnel)')!} type="email"
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" />
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-light mb-2">{L('Seksyon & Plas', 'Section & Seats', 'Section & Places')}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {seats.map(s => (
                    <span key={s} className="px-2.5 py-1 rounded text-[10px] font-bold border" style={{ color: sec.color, borderColor: sec.color, background: sec.color + '15' }}>{sec.name} {s}</span>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-light">{sec.name} × {seats.length}</span><span>${sub.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-light">{L('Frè', 'Fees', 'Frais')} (8.5%)</span><span>${fee.toFixed(2)}</span></div>
                {disc > 0 && <div className="flex justify-between text-sm"><span className="text-green">{L('Rabè', 'Discount', 'Remise')} ({Math.round(promo * 100)}%)</span><span className="text-green">-${disc.toFixed(2)}</span></div>}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="font-bold">{L('TOTAL', 'TOTAL', 'TOTAL')}</span>
                  <span className="font-heading text-3xl text-cyan">${total.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-muted text-center">{L('Frè enkli. Pa gen sipriz.', 'Fees included. No surprises.', 'Frais inclus. Pas de surprise.')}</p>

              {/* Promo code */}
              <div className="flex gap-2">
                <input value={promoCode} onChange={e => setPromoCode(e.target.value)}
                  placeholder={L('Kòd pwomo (opsyonèl)', 'Promo code (optional)', 'Code promo (optionnel)')!}
                  className="flex-1 px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" />
                <button onClick={applyPromo} className="px-4 py-2.5 rounded-[10px] bg-cyan-dim text-cyan text-xs font-bold border border-cyan-border hover:bg-cyan hover:text-dark transition-all">{L('Aplike', 'Apply', 'Appliquer')}</button>
              </div>
              {promoMsg && <p className={`text-[11px] ${promoMsg.startsWith('✅') ? 'text-green' : 'text-red'}`}>{promoMsg}</p>}
            </div>
          </div>
        )}

        {/* ════════════ STEP 5: Pay ════════════ */}
        {step === 5 && (
          <div>
            <h3 className="font-heading text-xl tracking-wide mb-3.5">{L('PEYE', 'PAY', 'PAYER')}</h3>
            <div className="flex flex-col gap-2.5">
              {[
                { id: 'moncash', icon: '📱', name: 'MonCash', desc: L('Peye ak MonCash', 'Pay with MonCash', 'Payer avec MonCash') },
                { id: 'natcash', icon: '💚', name: 'Natcash', desc: L('Peye ak Natcash', 'Pay with Natcash', 'Payer avec Natcash') },
                { id: 'card', icon: '💳', name: L('Kat Kredi', 'Credit Card', 'Carte de crédit'), desc: L('Visa, Mastercard', 'Visa, Mastercard', 'Visa, Mastercard') },
                { id: 'zelle', icon: '⚡', name: 'Zelle', desc: L('Peye ak Zelle', 'Pay with Zelle', 'Payer avec Zelle') },
                { id: 'paypal', icon: '🅿️', name: 'PayPal', desc: L('Peye ak PayPal', 'Pay with PayPal', 'Payer avec PayPal') },
                { id: 'cashapp', icon: '💲', name: 'Cash App', desc: L('Peye ak Cash App', 'Pay with Cash App', 'Payer avec Cash App') },
                { id: 'cash', icon: '💵', name: L('Kach', 'Cash', 'Espèces'), desc: L('Peye nan pot la', 'Pay at the door', 'Payer à l\'entrée') },
              ].map(m => (
                <div key={m.id} onClick={() => setPay(m.id)}
                  className={`flex items-center gap-3.5 bg-dark-card border rounded-card p-4 cursor-pointer transition-all ${pay === m.id ? 'border-cyan bg-cyan-dim' : 'border-border hover:border-white/[0.12]'}`}>
                  <span className="text-2xl">{m.icon}</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm">{m.name}</p>
                    <p className="text-[11px] text-gray-light">{m.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pay === m.id ? 'border-cyan' : 'border-border'}`}>
                    {pay === m.id && <div className="w-2.5 h-2.5 rounded-full bg-cyan" />}
                  </div>
                </div>
              ))}
            </div>
            {pay === 'card' && (
              <div className="mt-4 p-4 bg-dark-card border border-cyan rounded-card">
                <p className="text-xs text-gray-light mb-3">💳 {L('Antre enfòmasyon kat ou a', 'Enter your card details', 'Entrez les details de votre carte')}</p>
                <CardElement options={{ style: { base: { fontSize: '16px', color: '#ffffff', '::placeholder': { color: '#666' } } } }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════ Bottom Bar ════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-dark border-t border-border px-5 py-3">
        <div className="max-w-[1100px] mx-auto flex items-center gap-3">
          <div className="flex-1 text-xs text-gray-light">
            {step === 1 && (ev ? <><strong>{ev.name}</strong></> : L('Chwazi yon evènman.', 'Choose an event.', 'Choisissez un événement.'))}
            {step === 2 && (sec ? <><strong>{sec.name}</strong> — ${sec.price} {perSeat}</> : L('Chwazi yon seksyon.', 'Choose a section.', 'Choisissez une section.'))}
            {step === 3 && (seats.length > 0 ? <><strong>{seats.length} {L('plas', 'seats', 'places')}</strong> · ${total.toFixed(2)}</> : L('Chwazi omwen 1 plas.', 'Select at least 1 seat.', 'Sélectionnez au moins 1 place.'))}
            {step === 4 && <>{L('Total', 'Total', 'Total')}: <strong>${total.toFixed(2)}</strong></>}
            {step === 5 && <>{L('Total', 'Total', 'Total')}: <strong>${total.toFixed(2)}</strong></>}
          </div>
          {step > 1 && (
            <button onClick={goBack} className="px-4 py-2.5 rounded-[10px] border border-border text-gray-light text-xs font-bold hover:border-cyan hover:text-cyan transition-all">{L('Retounen', 'Back', 'Retour')}</button>
          )}
          <button onClick={goNext} disabled={!canNext}
            className={`px-6 py-2.5 rounded-[10px] font-bold text-sm transition-all ${step === 5 ? (canNext ? 'bg-green text-white hover:bg-green/80' : 'bg-white/[0.04] text-gray-muted cursor-not-allowed') : (canNext ? 'bg-cyan text-dark hover:bg-white' : 'bg-white/[0.04] text-gray-muted cursor-not-allowed')}`}>
            {step === 5 ? `🔒 ${L('Peye', 'Pay', 'Payer')} $${total.toFixed(2)}` : step === 3 ? L('Revize →', 'Review →', 'Réviser →') : L('Kontinye →', 'Continue →', 'Continuer →')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BuyTicketPage() {
  return (
    <Elements stripe={stripePromise}>
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-cyan border-t-transparent rounded-full animate-spin" /></div>}>
      <BuyTicketInner />
    </Suspense>
    </Elements>
  );
}

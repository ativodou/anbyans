'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useT } from '@/hooks/useT';
import Link from 'next/link';

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

function genCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function dateStr(ts: any, locale = 'fr-HT') {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function timeStr(ts: any) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' });
}

// ─── Seat Map ─────────────────────────────────────────────────────────────────

function SeatMap({ section, takenIds, selected, onToggle }: {
  section: Section;
  takenIds: string[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, 10);
  const cols = 10;
  return (
    <div className="overflow-auto">
      {/* Stage */}
      <div className="w-full bg-white/[0.06] rounded-lg text-center text-[10px] font-bold text-gray-400 py-2 mb-6 tracking-widest">ESTAJ / SCENE</div>
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
          { color: 'bg-white/[0.08]',  label: 'Disponib / Available' },
          { color: 'bg-orange',        label: 'Seleksyone / Selected' },
          { color: 'bg-white/[0.04]',  label: 'Pran / Taken' },
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

// ─── Main component ───────────────────────────────────────────────────────────

function BuyPageInner() {
  const { L } = useT();
  const params  = useParams();
  const router  = useRouter();
  const slug    = params?.slug as string;

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

  // ── Load event ────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const q = query(collection(db, 'events'), where('slug', '==', slug));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          setEvent({ id: d.id, ...d.data() } as EventData);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [slug]);

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
  const total = selSection ? selSection.price * qty : 0;

  // ── Seat toggle ───────────────────────────────────────────────
  const toggleSeat = (id: string) => {
    setSelSeats(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) :
      prev.length < qty ? [...prev, id] : prev
    );
  };

  // ── Validate buyer info ───────────────────────────────────────
  const validateInfo = () => {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name  = L('Non obligatwa', 'Name required', 'Nom requis');
    if (!phone.trim()) e.phone = L('Telefòn obligatwa', 'Phone required', 'Téléphone requis');
    if (email && !/\S+@\S+\.\S+/.test(email)) e.email = L('Email pa valab', 'Invalid email', 'Email invalide');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Complete purchase ─────────────────────────────────────────
  const completePurchase = async () => {
    if (!event || !selSection || !payMethod) return;
    setProcessing(true);
    try {
      const codes: string[] = [];
      const seats = selSection.type === 'reserved' ? selSeats : Array(qty).fill(null);

      for (let i = 0; i < qty; i++) {
        const code = genCode();
        const paymentStatus =
          payMethod === 'stripe'              ? 'paid' :
          payMethod === 'moncash' || payMethod === 'natcash' ? 'pending_verification' :
          'pending_cash';

        await addDoc(collection(db, 'tickets'), {
          ticketCode:    code,
          qrData:        code,
          eventId:       event.id,
          organizerId:   event.organizerId,
          buyerName:     name.trim(),
          buyerPhone:    phone.trim(),
          buyerEmail:    email.trim() || null,
          section:       selSection.id,
          sectionName:   selSection.name,
          sectionColor:  selSection.color,
          seat:          seats[i] || null,
          price:         selSection.price,
          priceHTG:      htg(selSection.price),
          paymentMethod: payMethod,
          paymentStatus,
          txnId:         txnId.trim() || null,
          status:        paymentStatus === 'paid' ? 'valid' : 'pending',
          purchasedAt:   serverTimestamp(),
        });
        codes.push(code);
      }
      setTicketCodes(codes);
      setStep('done');
    } catch (e) {
      console.error(e);
      alert(L('Erè. Eseye ankò.', 'Error. Please try again.', 'Erreur. Veuillez réessayer.'));
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
      <p className="text-gray-400">{L('Evènman pa jwenn.', 'Event not found.', 'Événement introuvable.')}</p>
      <Link href="/events" className="text-orange text-sm">← {L('Tounen', 'Back', 'Retour')}</Link>
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
        <Link href="/events" className="absolute top-4 left-4 text-white/70 hover:text-white text-sm">← {L('Tounen', 'Back', 'Retour')}</Link>
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
        <h2 className="font-heading text-lg mb-3">{L('Chwazi Tikè', 'Choose Ticket', 'Choisir Billet')}</h2>
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
                      ? L('Fin · Sold out', 'Sold out', 'Épuisé')
                      : `${avail} ${L('plas', 'available', 'places')} · ${sec.type === 'reserved' ? L('Plas Rezève', 'Reserved', 'Réservé') : 'GA'}`}
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
              <span className="text-sm font-bold">{L('Kantite', 'Quantity', 'Quantité')}</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-full bg-white/[0.08] text-white font-bold hover:bg-orange/30 transition-colors">−</button>
                <span className="text-lg font-heading w-6 text-center">{qty}</span>
                <button onClick={() => setQty(q => Math.min(10, q + 1))}
                  className="w-8 h-8 rounded-full bg-white/[0.08] text-white font-bold hover:bg-orange/30 transition-colors">+</button>
              </div>
            </div>
            <div className="flex justify-between text-sm border-t border-white/[0.06] pt-3">
              <span className="text-gray-400">{L('Total', 'Total', 'Total')}</span>
              <div className="text-right">
                <p className="font-bold text-green">${total.toFixed(2)}</p>
                <p className="text-[11px] text-red-400">{htg(total).toLocaleString('fr-HT')} HTG</p>
              </div>
            </div>
          </div>
        )}

        <button disabled={!selSection}
          onClick={() => setStep(selSection?.type === 'reserved' ? 'seats' : 'info')}
          className="w-full py-3.5 rounded-xl font-heading text-base bg-orange text-white disabled:opacity-30 hover:bg-orange/90 transition-all">
          {L('Kontinye', 'Continue', 'Continuer')} →
        </button>
      </div>
    </div>
  );

  // ── Step: Seats ───────────────────────────────────────────────
  if (step === 'seats') return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => setStep('detail')} className="text-gray-400 hover:text-white text-sm mb-4">← {L('Tounen', 'Back', 'Retour')}</button>
        <h2 className="font-heading text-xl mb-1">{L('Chwazi Plas', 'Choose Seats', 'Choisir Places')}</h2>
        <p className="text-gray-400 text-xs mb-6">
          {selSeats.length}/{qty} {L('plas seleksyone', 'seats selected', 'places sélectionnées')} · {selSection?.name}
        </p>
        <SeatMap
          section={selSection!}
          takenIds={takenSeats}
          selected={selSeats}
          onToggle={toggleSeat}
        />
        <button disabled={selSeats.length !== qty}
          onClick={() => setStep('info')}
          className="w-full mt-8 py-3.5 rounded-xl font-heading text-base bg-orange text-white disabled:opacity-30 hover:bg-orange/90 transition-all">
          {L('Kontinye', 'Continue', 'Continuer')} →
        </button>
      </div>
    </div>
  );

  // ── Step: Info ────────────────────────────────────────────────
  if (step === 'info') return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => setStep(selSection?.type === 'reserved' ? 'seats' : 'detail')}
          className="text-gray-400 hover:text-white text-sm mb-4">← {L('Tounen', 'Back', 'Retour')}</button>
        <h2 className="font-heading text-xl mb-6">{L('Enfòmasyon Ou', 'Your Info', 'Vos Informations')}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1.5">{L('Non Konplè *', 'Full Name *', 'Nom Complet *')}</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Jean Paul"
              className={`w-full px-4 py-3 rounded-xl bg-white/[0.06] border text-white text-sm outline-none focus:border-orange ${errors.name ? 'border-red-500' : 'border-white/[0.1]'}`} />
            {errors.name && <p className="text-red-400 text-[10px] mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1.5">{L('Nimewo Telefòn *', 'Phone Number *', 'Numéro de Téléphone *')}</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+509 xxxx-xxxx"
              type="tel"
              className={`w-full px-4 py-3 rounded-xl bg-white/[0.06] border text-white text-sm outline-none focus:border-orange ${errors.phone ? 'border-red-500' : 'border-white/[0.1]'}`} />
            {errors.phone && <p className="text-red-400 text-[10px] mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1.5">{L('Email (opsyonèl)', 'Email (optional)', 'Email (facultatif)')}</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com"
              type="email"
              className={`w-full px-4 py-3 rounded-xl bg-white/[0.06] border text-white text-sm outline-none focus:border-orange ${errors.email ? 'border-red-500' : 'border-white/[0.1]'}`} />
            {errors.email && <p className="text-red-400 text-[10px] mt-1">{errors.email}</p>}
          </div>
        </div>

        {/* Order summary */}
        <div className="mt-6 bg-white/[0.04] rounded-xl p-4 text-sm">
          <p className="font-bold mb-2">{L('Rezime', 'Summary', 'Résumé')}</p>
          <div className="flex justify-between text-gray-400 text-xs mb-1">
            <span>{selSection?.name} × {qty}</span>
            <span className="text-green">${total.toFixed(2)} <span className="text-red-400">· {htg(total).toLocaleString('fr-HT')} HTG</span></span>
          </div>
          {selSeats.length > 0 && (
            <p className="text-[10px] text-gray-500">Plas: {selSeats.join(', ')}</p>
          )}
        </div>

        <button onClick={() => { if (validateInfo()) setStep('payment'); }}
          className="w-full mt-4 py-3.5 rounded-xl font-heading text-base bg-orange text-white hover:bg-orange/90 transition-all">
          {L('Kontinye', 'Continue', 'Continuer')} →
        </button>
      </div>
    </div>
  );

  // ── Step: Payment ─────────────────────────────────────────────
  if (step === 'payment') return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => setStep('info')} className="text-gray-400 hover:text-white text-sm mb-4">← {L('Tounen', 'Back', 'Retour')}</button>
        <h2 className="font-heading text-xl mb-6">{L('Peman', 'Payment', 'Paiement')}</h2>

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
              {L(
                `Voye ${fmtPrice(total)} bay nimewo sa a, answit antre ID tranzaksyon ou a anba.`,
                `Send ${fmtPrice(total)} to the number below, then enter your transaction ID.`,
                `Envoyez ${fmtPrice(total)} au numéro ci-dessous, puis entrez votre ID de transaction.`
              )}
            </p>
            <div className="bg-black/40 rounded-lg p-3 text-center mb-3">
              <p className="text-[10px] text-gray-500 mb-0.5">{payMethod === 'moncash' ? 'MonCash' : 'Natcash'} #</p>
              <p className="font-heading text-xl text-orange">
                {event.paymentMethods?.[payMethod]?.values?.[0] || '—'}
              </p>
            </div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5">
              {L('ID Tranzaksyon', 'Transaction ID', 'ID de Transaction')}
            </label>
            <input value={txnId} onChange={e => setTxnId(e.target.value)}
              placeholder="ex: TXN123456"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm outline-none focus:border-orange" />
          </div>
        )}

        {/* Cash / Zelle / CashApp */}
        {payMethod === 'cash' && (
          <div className="bg-white/[0.04] rounded-xl p-4 mb-4 text-sm">
            <p className="font-bold mb-2">💵 {L('Cash · Zelle · CashApp', 'Cash · Zelle · CashApp', 'Cash · Zelle · CashApp')}</p>
            <p className="text-gray-400 text-xs">
              {L(
                'Tikè ou a pral gen estati "ann atant". Ou ka peye nan pòt oswa bay òganizatè a.',
                'Your ticket will be marked "pending". Pay at the door or contact the organizer.',
                'Votre billet sera marqué "en attente". Payez à l\'entrée ou contactez l\'organisateur.'
              )}
            </p>
            {event.paymentMethods?.cash?.values?.length > 0 && (
              <div className="mt-3 bg-black/40 rounded-lg p-3">
                {event.paymentMethods.cash.values.map((v, i) => (
                  <p key={i} className="text-xs text-orange font-bold">{v}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stripe placeholder */}
        {payMethod === 'stripe' && (
          <div className="bg-white/[0.04] rounded-xl p-4 mb-4 text-sm">
            <p className="font-bold mb-2">💳 {L('Kart Kredi / Debi', 'Credit / Debit Card', 'Carte Crédit / Débit')}</p>
            <p className="text-gray-400 text-xs">
              {L('Stripe ap chaje kart ou lè ou klike Konfime.', 'Stripe will charge your card when you confirm.', 'Stripe débitera votre carte à la confirmation.')}
            </p>
            {/* TODO: mount Stripe Elements here */}
            <div className="mt-3 bg-black/40 rounded-lg p-3 border border-dashed border-white/10 text-center text-gray-600 text-xs">
              Stripe Elements — {L('pwochen vèsyon', 'coming next release', 'prochaine version')}
            </div>
          </div>
        )}

        {/* Order total */}
        <div className="bg-white/[0.04] rounded-xl p-4 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{L('Total', 'Total', 'Total')}</span>
            <div className="text-right">
              <p className="font-bold text-green">${total.toFixed(2)}</p>
              <p className="text-[11px] text-red-400">{htg(total).toLocaleString('fr-HT')} HTG</p>
            </div>
          </div>
        </div>

        <button
          disabled={!payMethod || processing || ((payMethod === 'moncash' || payMethod === 'natcash') && !txnId.trim())}
          onClick={completePurchase}
          className="w-full py-3.5 rounded-xl font-heading text-base bg-orange text-white disabled:opacity-30 hover:bg-orange/90 transition-all flex items-center justify-center gap-2">
          {processing
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {L('Tann...', 'Processing...', 'Traitement...')}</>
            : L('Konfime Peman', 'Confirm Payment', 'Confirmer Paiement')}
        </button>
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
            ? L('Tikè ou ann atant!', 'Ticket pending!', 'Billet en attente!')
            : L('Tikè konfime!', 'Ticket confirmed!', 'Billet confirmé!')}
        </h2>
        <p className="text-gray-400 text-sm mb-8">
          {payMethod === 'cash'
            ? L('Peye nan pòt pou konfime plas ou.', 'Pay at the door to confirm your spot.', 'Payez à l\'entrée pour confirmer.')
            : payMethod === 'moncash' || payMethod === 'natcash'
            ? L('Nou pral verifye peman ou a. Tikè ou ap aktive nan kèk minit.', 'We\'ll verify your payment. Your ticket will activate shortly.', 'Nous vérifierons votre paiement.')
            : L('Tikè ou prèt. Montre kòd la nan pòt.', 'Your ticket is ready. Show the code at the door.', 'Votre billet est prêt.')}
        </p>

        <div className="space-y-3 mb-8">
          {ticketCodes.map((code, i) => (
            <div key={code} className="bg-white/[0.06] rounded-xl p-4">
              <p className="text-[10px] text-gray-500 mb-1">
                {L('Tikè', 'Ticket', 'Billet')} {ticketCodes.length > 1 ? `#${i + 1}` : ''} · {selSection?.name}
                {selSeats[i] ? ` · Plas ${selSeats[i]}` : ''}
              </p>
              <p className="font-heading text-2xl tracking-widest text-orange">{code}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Link href={`/ticket/${ticketCodes[0]}`}
            className="flex-1 py-3 rounded-xl bg-orange text-white font-bold text-sm hover:bg-orange/90 transition-all">
            {L('Wè Tikè', 'View Ticket', 'Voir Billet')}
          </Link>
          <Link href="/events"
            className="flex-1 py-3 rounded-xl bg-white/[0.08] text-white font-bold text-sm hover:bg-white/[0.12] transition-all">
            {L('Tounen', 'Back', 'Retour')}
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
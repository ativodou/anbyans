'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';

interface Section { id:string; name:string; cls:string; color:string; price:number; rows:number; cols:number; desc:Record<string,string>; taken:number[]; }
interface Evt { id:number; name:string; cat:string; venue:string; date:Record<string,string>; time:string; emoji:string; artists:string; status:string; sections:Section[]; }

const events: Evt[] = [
  { id:1, name:'Kompa Fest 2026', cat:'Mizik', venue:'Parc Istorik, Milot', date:{ht:'15 Mars 2026',en:'Mar 15, 2026',fr:'15 mars 2026'}, time:'20:00', emoji:'🎶', artists:'T-Vice, Klass, Harmonik', status:'live', sections:[
    { id:'vvip', name:'VVIP', cls:'vvip', color:'#FFD700', price:150, rows:2, cols:10, desc:{ht:'Pi pre sènn · Sèvis VIP · Bwason enkli',en:'Closest to stage · VIP service · Drinks included',fr:'Le plus près de la scène · Service VIP · Boissons incluses'}, taken:[3,7,8,14] },
    { id:'vip', name:'VIP', cls:'vip', color:'#FF6B35', price:75, rows:4, cols:14, desc:{ht:'Dezyèm ranje · Aksè bar VIP',en:'Second row · VIP bar access',fr:'Deuxième rangée · Accès bar VIP'}, taken:[1,5,12,18,22,30,33,41,45] },
    { id:'ga', name:'General Admission', cls:'ga', color:'#00D4FF', price:15, rows:6, cols:18, desc:{ht:'Aksè jeneral · Kanpe',en:'General access · Standing',fr:'Accès général · Debout'}, taken:[2,8,15,22,29,35,42,48,55,61,68,74,80,87,92,99] },
  ]},
  { id:2, name:'DJ Stéphane Live', cat:'Fèt', venue:'Karibe Hotel, Pétion-Ville', date:{ht:'22 Mars 2026',en:'Mar 22, 2026',fr:'22 mars 2026'}, time:'22:00', emoji:'🎧', artists:'DJ Stéphane', status:'soon', sections:[
    { id:'vip', name:'VIP', cls:'vip', color:'#FF6B35', price:100, rows:3, cols:10, desc:{ht:'Tou pre DJ booth',en:'Near the DJ booth',fr:'Près de la cabine DJ'}, taken:[2,5,14,19] },
    { id:'ga', name:'General Admission', cls:'ga', color:'#00D4FF', price:25, rows:5, cols:16, desc:{ht:'Aksè jeneral · Danse!',en:'General access · Dance!',fr:'Accès général · Dansez !'}, taken:[3,10,22,38,55,60] },
  ]},
  { id:3, name:'Rara Lakay 2026', cat:'Festival', venue:'Champ de Mars, Pòtoprens', date:{ht:'5 Avr 2026',en:'Apr 5, 2026',fr:'5 avril 2026'}, time:'18:00', emoji:'🥁', artists:'RAM, Boukman Eksperyans', status:'soon', sections:[
    { id:'vvip', name:'VVIP', cls:'vvip', color:'#FFD700', price:75, rows:2, cols:8, desc:{ht:'Tribinn VIP ak sèvis',en:'VIP tribune with service',fr:'Tribune VIP avec service'}, taken:[1,6,11] },
    { id:'vip', name:'VIP', cls:'vip', color:'#FF6B35', price:35, rows:3, cols:12, desc:{ht:'Zon VIP devan',en:'Front VIP zone',fr:'Zone VIP avant'}, taken:[4,8,15,22,28] },
    { id:'ga', name:'General Admission', cls:'ga', color:'#00D4FF', price:10, rows:8, cols:20, desc:{ht:'Aksè jeneral',en:'General access',fr:'Accès général'}, taken:[5,12,20,33,45,60,78,88,100,120,130,140] },
  ]},
];

const FEE = 0.085;
const MAX_SEATS = 10;
const ROWS = 'ABCDEFGHIJKLMNOP';
const PROMOS: Record<string,number> = { KOMPA10: 0.10, ANBYANS: 0.15 };

export default function BuyTicketPage() {
  const { t, locale } = useT();
  const L = (ht: string, en: string, fr: string) => {
    const map: Record<'ht' | 'en' | 'fr', string> = { ht, en, fr };
    return map[locale as keyof typeof map];
  };

  const STEP_LABELS = [
    L('Chwazi Evènman','Choose Event','Choisir un événement'),
    L('Chwazi Seksyon','Choose Section','Choisir une section'),
    L('Chwazi Plas','Choose Seats','Choisir des places'),
    L('Revize','Review','Réviser'),
    t('buy_step_pay'),
  ];

  const [step, setStep] = useState(1);
  const [ev, setEv] = useState<Evt|null>(null);
  const [sec, setSec] = useState<Section|null>(null);
  const [seats, setSeats] = useState<string[]>([]);
  const [pay, setPay] = useState('');
  const [promo, setPromo] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [holdTime, setHoldTime] = useState(600);
  const [qrKey, setQrKey] = useState(0);
  const [qrCountdown, setQrCountdown] = useState(15);

  useEffect(() => {
    if (step < 3 || confirmed) return;
    const ti = setInterval(() => setHoldTime(p => Math.max(0, p-1)), 1000);
    return () => clearInterval(ti);
  }, [step, confirmed]);

  useEffect(() => {
    if (!confirmed) return;
    const ti = setInterval(() => {
      setQrCountdown(p => { if (p <= 1) { setQrKey(k => k+1); return 15; } return p-1; });
    }, 1000);
    return () => clearInterval(ti);
  }, [confirmed]);

  const calcTotal = useCallback(() => {
    if (!sec || seats.length === 0) return { sub:0, fee:0, disc:0, total:0 };
    const sub = seats.length * sec.price;
    const fee = Math.round(sub * FEE * 100) / 100;
    const disc = promo > 0 ? Math.round(sub * promo * 100) / 100 : 0;
    return { sub, fee, disc, total: sub + fee - disc };
  }, [sec, seats, promo]);

  const { sub, fee, disc, total } = calcTotal();
  const holdMin = Math.floor(holdTime / 60);
  const holdSec = holdTime % 60;

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (PROMOS[code]) { setPromo(PROMOS[code]); setPromoMsg(`✅ ${code} — ${Math.round(PROMOS[code]*100)}% ${L('rabè','off','remise')}!`); }
    else { setPromoMsg(`✕ ${L('Kòd pa valid.','Invalid code.','Code invalide.')}`); }
  };

  const toggleSeat = (id: string) => {
    if (seats.includes(id)) setSeats(seats.filter(s => s !== id));
    else if (seats.length < MAX_SEATS) setSeats([...seats, id]);
  };

  const doPayment = () => {
    setProcessing(true);
    setTimeout(() => { setProcessing(false); setConfirmed(true); }, 2500);
  };

  const goNext = () => {
    if (step === 5) { doPayment(); return; }
    setStep(step + 1);
  };

  const goBack = () => {
    if (step === 3) setSeats([]);
    if (step > 1) setStep(step - 1);
  };

  const canNext = step === 1 ? !!ev : step === 2 ? !!sec : step === 3 ? seats.length > 0 : step === 4 ? true : !!pay;

  const perSeat = L('pa plas','per seat','par place');
  const availOf = L('disponib sou','available of','disponible sur');
  const stageLabel = L('SÈNN','STAGE','SCÈNE');
  const chooseLabel = L('Chwazi','Selected','Sélectionné');
  const takenLabel = L('Pran','Taken','Pris');
  const availLabel = L('Disponib','Available','Disponible');

  if (confirmed) {
    const ref = 'ANB-' + Date.now().toString(36).toUpperCase().slice(-6);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px] text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="font-heading text-3xl tracking-wide mb-1">{L('TIKÈ OU PARE!','YOUR TICKET IS READY!','VOTRE BILLET EST PRÊT !')}</h2>
          <p className="text-xs text-gray-light mb-6">{L('Prezante QR kòd sa a nan antre a.','Show this QR code at the entrance.','Présentez ce QR code à l\'entrée.')}</p>
          <div className="bg-dark-card border border-border rounded-2xl p-6 relative">
            <div className="absolute top-1/2 -left-2.5 w-5 h-5 rounded-full bg-dark" />
            <div className="absolute top-1/2 -right-2.5 w-5 h-5 rounded-full bg-dark" />
            <p className="font-bold text-lg">{ev?.name}</p>
            <p className="text-xs text-gray-light mt-1">📍 {ev?.venue} · 📅 {ev?.date[locale]} · 🕐 {ev?.time}</p>
            <div className="mt-3 mb-3">
              <span className="px-3 py-1 rounded-md text-[10px] font-bold border" style={{ color: sec?.color, borderColor: sec?.color, background: sec?.color + '15' }}>
                {sec?.name}
              </span>
            </div>
            <p className="text-xs text-gray-light">{L('Plas','Seats','Places')}: {seats.join(', ')} ({seats.length} {seats.length === 1 ? L('tikè','ticket','billet') : t('tickets')})</p>
            <div className="mt-4 mb-2 flex justify-center">
              <div className="grid grid-cols-[repeat(13,1fr)] gap-px w-[156px] h-[156px]" key={qrKey}>
                {Array.from({length:169}).map((_,i) => {
                  const edge = i < 13 || i >= 156 || i % 13 === 0 || i % 13 === 12;
                  const corner = (i < 39 && i % 13 < 3) || (i < 39 && i % 13 >= 10) || (i >= 130 && i < 156 && i % 13 < 3);
                  const black = corner || edge || Math.random() > 0.55;
                  return <div key={i} className={`${black ? 'bg-white' : 'bg-transparent'}`} />;
                })}
              </div>
            </div>
            <p className="text-[10px] text-gray-muted">{L('QR kòd ap chanje chak','QR code changes every','Le QR code change toutes les')} {qrCountdown}s</p>
            <p className="text-xs font-bold mt-3">Ref: {ref}</p>
          </div>
          <div className="flex gap-2.5 justify-center mt-6">
            <Link href="/events" className="px-5 py-3 rounded-lg bg-cyan text-dark font-bold text-sm hover:bg-white transition-all">🎫 {L('Wè Plis Evènman','See More Events','Voir plus d\'événements')}</Link>
            <button className="px-5 py-3 rounded-lg border border-border text-gray-light font-bold text-sm hover:text-white transition-all">📲 WhatsApp</button>
          </div>
        </div>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cyan border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-light">{t('buy_processing')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <nav className="sticky top-0 z-50 bg-dark border-b border-border px-5">
        <div className="max-w-[1100px] mx-auto flex items-center h-[52px] gap-3.5">
          <Link href="/"><img src="/logo.jpg" alt="Anbyans" className="h-[30px] rounded" /></Link>
          <span className="font-heading text-base tracking-wide flex-1">{L('ACHTE TIKÈ','BUY TICKETS','ACHETER DES BILLETS')}</span>
          {step >= 3 && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-orange">
              <div className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
              <span className={holdTime <= 60 ? 'text-red' : ''}>{holdMin}:{holdSec < 10 ? '0' : ''}{holdSec}</span>
            </div>
          )}
          <LangSwitcher />
          <Link href="/events" className="px-3 py-1.5 rounded-lg border border-border text-gray-light text-[11px] hover:border-cyan hover:text-cyan transition-all">← {t('back')}</Link>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto w-full px-5 pt-5 flex-1">
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

        {step === 1 && (
          <div>
            <h3 className="font-heading text-xl tracking-wide mb-3.5">{L('CHWAZI EVÈNMAN','CHOOSE EVENT','CHOISIR UN ÉVÉNEMENT')}</h3>
            <div className="flex flex-col gap-2.5">
              {events.map(e => {
                const minP = Math.min(...e.sections.map(s => s.price));
                const selected = ev?.id === e.id;
                return (
                  <div key={e.id} onClick={() => { setEv(e); setSec(null); setSeats([]); setPromo(0); setTimeout(goNext, 200); }}
                    className={`flex gap-3.5 bg-dark-card border rounded-card p-3.5 cursor-pointer transition-all hover:-translate-y-0.5 ${selected ? 'border-cyan bg-cyan-dim' : 'border-border hover:border-white/[0.12]'}`}>
                    <div className="w-20 h-20 rounded-[10px] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-4xl flex-shrink-0">{e.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] uppercase tracking-widest text-cyan font-bold">{e.cat}</div>
                      <div className="text-base font-bold mt-0.5">{e.name}</div>
                      <div className="flex flex-wrap gap-2.5 text-[11px] text-gray-light mt-1">
                        <span>📍 {e.venue}</span><span>📅 {e.date[locale]}</span><span>🕐 {e.time}</span><span>🎤 {e.artists}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-heading text-xl">${minP}</div>
                      <div className="text-[9px] text-gray-muted">{t('browse_from').toLowerCase()}</div>
                      {e.status === 'live' && <div className="mt-1 text-[9px] font-bold text-red animate-pulse">{L('● AN DIRÈK','● LIVE','● EN DIRECT')}</div>}
                      {e.status === 'soon' && <div className="mt-1 text-[9px] font-bold text-orange">{L('AP VINI','UPCOMING','À VENIR')}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && ev && (
          <div>
            <h3 className="font-heading text-xl tracking-wide mb-3.5">{ev.name} — {t('buy_select_section')}</h3>
            <div className="bg-dark-card border border-border rounded-card p-4 mb-4 text-center">
              <span className="text-2xl">🎤</span>
              <p className="text-xs text-gray-muted font-bold mt-1">{stageLabel}</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {ev.sections.map(s => {
                const tot = s.rows * s.cols;
                const avail = tot - s.taken.length;
                const pct = Math.round(s.taken.length / tot * 100);
                const selected = sec?.id === s.id;
                return (
                  <div key={s.id} onClick={() => { setSec(s); setSeats([]); setTimeout(goNext, 200); }}
                    className={`flex items-center gap-3.5 bg-dark-card border rounded-card p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${selected ? 'border-cyan bg-cyan-dim' : 'border-border hover:border-white/[0.12]'}`}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background:s.color}} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold">{s.name}</div>
                      <div className="text-xs text-gray-light mt-0.5">{s.desc[locale]}</div>
                      <div className={`text-[11px] mt-1 ${pct > 75 ? 'text-red' : 'text-green'}`}>{pct > 75 ? '⚡ ' : ''}{avail} {availOf} {tot}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-heading text-2xl" style={{color:s.color}}>${s.price}</div>
                      <div className="text-[9px] text-gray-muted">{perSeat}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && sec && (
          <div>
            <h3 className="font-heading text-xl tracking-wide mb-3.5">{sec.name} — {t('buy_select_seats')}</h3>
            <div className="bg-dark-card border border-border rounded-card p-4 mb-4 text-center">
              <span className="text-xl">🎤</span>
              <p className="text-[10px] text-gray-muted font-bold mt-0.5">{stageLabel}</p>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-sm" style={{background:sec.color}} />
              <span className="text-xs font-bold">{sec.name}</span>
              <span className="text-xs text-gray-muted">— ${sec.price} {perSeat}</span>
            </div>
            <div className="overflow-x-auto pb-4">
              <div className="flex flex-col gap-1 min-w-fit">
                {Array.from({length: sec.rows}).map((_, r) => (
                  <div key={r} className="flex items-center gap-0.5">
                    <span className="w-5 text-[9px] text-gray-muted text-center font-bold">{ROWS[r]}</span>
                    {Array.from({length: sec.cols}).map((_, c) => {
                      const idx = r * sec.cols + c;
                      const seatId = ROWS[r] + (c + 1);
                      const taken = sec.taken.includes(idx);
                      const selected = seats.includes(seatId);
                      const isGap = sec.cols > 12 && (c === 2 || c === sec.cols - 3);
                      return (
                        <div key={c} className="flex items-center">
                          {isGap && <div className="w-3" />}
                          <button onClick={() => !taken && toggleSeat(seatId)} disabled={taken}
                            className={`w-7 h-7 rounded text-[8px] font-bold transition-all ${taken ? 'bg-white/[0.03] text-gray-muted/30 cursor-not-allowed opacity-20' : selected ? 'text-dark scale-110 shadow-lg' : 'bg-white/[0.06] text-gray-light hover:bg-white/[0.12] cursor-pointer'}`}
                            style={selected ? {background: sec.color} : undefined}>
                            {c + 1}
                          </button>
                        </div>
                      );
                    })}
                    <span className="w-5 text-[9px] text-gray-muted text-center font-bold">{ROWS[r]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-4 mt-2 mb-4">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-muted"><div className="w-4 h-4 rounded bg-white/[0.06]" /> {availLabel}</div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-muted"><div className="w-4 h-4 rounded" style={{background:sec.color}} /> {chooseLabel}</div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-muted"><div className="w-4 h-4 rounded bg-white/[0.03] opacity-20" /> {takenLabel}</div>
            </div>
            {seats.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {seats.map(s => (
                  <span key={s} className="px-2 py-0.5 rounded text-[10px] font-bold border" style={{color:sec.color, borderColor:sec.color, background:sec.color+'15'}}>{s}</span>
                ))}
                <span className="ml-auto font-heading text-xl" style={{color:sec.color}}>${seats.length * sec.price}</span>
              </div>
            )}
          </div>
        )}

        {step === 4 && ev && sec && (
          <div>
            <h3 className="font-heading text-xl tracking-wide mb-3.5">{L('REVIZE KÒMAND','REVIEW ORDER','RÉVISER LA COMMANDE')}</h3>
            <div className="bg-dark-card border border-border rounded-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-[10px] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-3xl flex-shrink-0">{ev.emoji}</div>
                <div>
                  <p className="font-bold">{ev.name}</p>
                  <p className="text-xs text-gray-light">📍 {ev.venue} · 📅 {ev.date[locale]} · 🕐 {ev.time}</p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-light mb-2">{L('Seksyon & Plas','Section & Seats','Section & Places')}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {seats.map(s => (
                    <span key={s} className="px-2.5 py-1 rounded text-[10px] font-bold border" style={{color:sec.color, borderColor:sec.color, background:sec.color+'15'}}>{sec.name} {s}</span>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-light">{sec.name} × {seats.length}</span><span>${sub.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-light">{t('buy_fees')} (8.5%)</span><span>${fee.toFixed(2)}</span></div>
                {disc > 0 && <div className="flex justify-between text-sm"><span className="text-green">{L('Rabè','Discount','Remise')} ({Math.round(promo*100)}%)</span><span className="text-green">-${disc.toFixed(2)}</span></div>}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="font-bold">{t('total').toUpperCase()}</span>
                  <span className="font-heading text-3xl text-cyan">${total.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-muted text-center">{L('Frè enkli. Pa gen sipriz.','Fees included. No surprises.','Frais inclus. Pas de surprise.')}</p>
              <div className="flex gap-2">
                <input value={promoCode} onChange={e => setPromoCode(e.target.value)} placeholder={L('Kòd pwomo (opsyonèl)','Promo code (optional)','Code promo (optionnel)')!} className="flex-1 px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" />
                <button onClick={applyPromo} className="px-4 py-2.5 rounded-[10px] bg-cyan-dim text-cyan text-xs font-bold border border-cyan-border hover:bg-cyan hover:text-dark transition-all">{L('Aplike','Apply','Appliquer')}</button>
              </div>
              {promoMsg && <p className={`text-[11px] ${promoMsg.startsWith('✅') ? 'text-green' : 'text-red'}`}>{promoMsg}</p>}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h3 className="font-heading text-xl tracking-wide mb-3.5">{t('buy_step_pay').toUpperCase()}</h3>
            <div className="flex flex-col gap-2.5">
              {[
                { id:'moncash', icon:'📱', name:'MonCash', desc:t('pay_moncash') },
                { id:'natcash', icon:'💚', name:'Natcash', desc:t('pay_natcash') },
                { id:'card', icon:'💳', name:t('pay_card'), desc:t('pay_card_desc') },
                { id:'zelle', icon:'⚡', name:'Zelle', desc:t('pay_zelle') },
                { id:'paypal', icon:'🅿️', name:'PayPal', desc:t('pay_paypal') },
                { id:'cashapp', icon:'💲', name:'Cash App', desc:t('pay_cashapp') },
                { id:'cash', icon:'💵', name:t('pay_cash'), desc:t('pay_cash_desc') },
              ].map(m => (
                <div key={m.id}>
                  <div onClick={() => setPay(m.id)}
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
                  {m.id === 'card' && pay === 'card' && (
                    <div className="bg-dark-card border border-border rounded-card p-4 mt-1.5 space-y-3">
                      <div><label className="block text-[11px] font-semibold text-gray-light mb-1">{t('pay_card_number')}</label><input placeholder="1234 5678 9012 3456" className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" /></div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div><label className="block text-[11px] font-semibold text-gray-light mb-1">{t('pay_expiry')}</label><input placeholder="MM/YY" className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" /></div>
                        <div><label className="block text-[11px] font-semibold text-gray-light mb-1">CVC</label><input placeholder="123" className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" /></div>
                      </div>
                      <div><label className="block text-[11px] font-semibold text-gray-light mb-1">{t('pay_name_on_card')}</label><input placeholder="MARIE PIERRE" className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" /></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-dark border-t border-border px-5 py-3">
        <div className="max-w-[1100px] mx-auto flex items-center gap-3">
          <div className="flex-1 text-xs text-gray-light">
            {step === 1 && (ev ? <><strong>{ev.name}</strong></> : L('Chwazi yon evènman.','Choose an event.','Choisissez un événement.'))}
            {step === 2 && (sec ? <><strong>{sec.name}</strong> — ${sec.price} {perSeat}</> : L('Chwazi yon seksyon.','Choose a section.','Choisissez une section.'))}
            {step === 3 && (seats.length > 0 ? <><strong>{seats.length} {L('plas','seats','places')}</strong> · ${total.toFixed(2)}</> : L('Chwazi omwen 1 plas.','Select at least 1 seat.','Sélectionnez au moins 1 place.'))}
            {step === 4 && <>{t('total')}: <strong>${total.toFixed(2)}</strong></>}
            {step === 5 && <>{t('total')}: <strong>${total.toFixed(2)}</strong></>}
          </div>
          {step > 1 && (
            <button onClick={goBack} className="px-4 py-2.5 rounded-[10px] border border-border text-gray-light text-xs font-bold hover:border-cyan hover:text-cyan transition-all">{t('buy_back')}</button>
          )}
          <button onClick={goNext} disabled={!canNext}
            className={`px-6 py-2.5 rounded-[10px] font-bold text-sm transition-all ${step === 5 ? (canNext ? 'bg-green text-white hover:bg-green/80' : 'bg-white/[0.04] text-gray-muted cursor-not-allowed') : (canNext ? 'bg-cyan text-dark hover:bg-white' : 'bg-white/[0.04] text-gray-muted cursor-not-allowed')}`}>
            {step === 5 ? `🔒 ${t('buy_pay_btn')} $${total.toFixed(2)}` : step === 3 ? L('Revize →','Review →','Réviser →') : t('buy_continue')}
          </button>
        </div>
      </div>
    </div>
  );
}

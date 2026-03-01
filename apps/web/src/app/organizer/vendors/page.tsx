'use client';

import Link from 'next/link';
import { useState } from 'react';

/* ══════════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════════ */

interface BulkTier {
  minQty: number;
  maxQty: number | null;
  priceEach: number;
}

interface SectionPricing {
  section: string;
  sectionColor: string;
  onlinePrice: number;
  bulkTiers: BulkTier[];
  available: number;
}

interface EventConfig {
  id: number;
  name: string;
  emoji: string;
  date: string;
  sections: SectionPricing[];
}

interface Purchase {
  eventId: number;
  eventName: string;
  eventEmoji: string;
  eventDate: string;
  section: string;
  sectionColor: string;
  qty: number;
  priceEach: number;
  totalPaid: number;
  sold: number;
  purchaseDate: string;
}

interface Vendor {
  id: number;
  name: string;
  contact: string;
  phone: string;
  city: string;
  payMethod: string;
  payAccount: string;
  status: 'active' | 'inactive' | 'pending';
  joinedDate: string;
  purchases: Purchase[];
}

const EVENTS: EventConfig[] = [
  { id:1, name:'Kompa Fest 2026', emoji:'🎶', date:'15 Mars', sections:[
    { section:'VVIP', sectionColor:'#FFD700', onlinePrice:150, available:50, bulkTiers:[
      { minQty:5, maxQty:10, priceEach:120 },
      { minQty:11, maxQty:25, priceEach:110 },
      { minQty:26, maxQty:null, priceEach:100 },
    ]},
    { section:'VIP', sectionColor:'#FF6B35', onlinePrice:75, available:80, bulkTiers:[
      { minQty:10, maxQty:25, priceEach:60 },
      { minQty:26, maxQty:50, priceEach:55 },
      { minQty:51, maxQty:null, priceEach:50 },
    ]},
    { section:'GA', sectionColor:'#00D4FF', onlinePrice:15, available:200, bulkTiers:[
      { minQty:25, maxQty:50, priceEach:11 },
      { minQty:51, maxQty:100, priceEach:10 },
      { minQty:101, maxQty:null, priceEach:8 },
    ]},
  ]},
  { id:2, name:'DJ Stéphane Live', emoji:'🎧', date:'22 Mars', sections:[
    { section:'VIP', sectionColor:'#FF6B35', onlinePrice:100, available:40, bulkTiers:[
      { minQty:10, maxQty:25, priceEach:80 },
      { minQty:26, maxQty:null, priceEach:70 },
    ]},
    { section:'GA', sectionColor:'#00D4FF', onlinePrice:25, available:120, bulkTiers:[
      { minQty:25, maxQty:50, priceEach:20 },
      { minQty:51, maxQty:null, priceEach:17 },
    ]},
  ]},
  { id:3, name:'Rara Lakay 2026', emoji:'🥁', date:'5 Avr', sections:[
    { section:'VVIP', sectionColor:'#FFD700', onlinePrice:75, available:20, bulkTiers:[
      { minQty:5, maxQty:10, priceEach:60 },
      { minQty:11, maxQty:null, priceEach:55 },
    ]},
    { section:'VIP', sectionColor:'#FF6B35', onlinePrice:35, available:50, bulkTiers:[
      { minQty:10, maxQty:25, priceEach:28 },
      { minQty:26, maxQty:null, priceEach:25 },
    ]},
    { section:'GA', sectionColor:'#00D4FF', onlinePrice:10, available:200, bulkTiers:[
      { minQty:25, maxQty:50, priceEach:8 },
      { minQty:51, maxQty:100, priceEach:7 },
      { minQty:101, maxQty:null, priceEach:6 },
    ]},
  ]},
];

const VENDORS: Vendor[] = [
  { id:1, name:'Ti Jak Boutik', contact:'Jean-Marc Pierre', phone:'+509 3412 1111', city:'Pétion-Ville', payMethod:'MonCash', payAccount:'+509 3412 1111', status:'active', joinedDate:'12 Jan 2026', purchases:[
    { eventId:1, eventName:'Kompa Fest 2026', eventEmoji:'🎶', eventDate:'15 Mars', section:'VIP', sectionColor:'#FF6B35', qty:30, priceEach:55, totalPaid:1650, sold:22, purchaseDate:'10 Fev' },
    { eventId:1, eventName:'Kompa Fest 2026', eventEmoji:'🎶', eventDate:'15 Mars', section:'GA', sectionColor:'#00D4FF', qty:50, priceEach:10, totalPaid:500, sold:38, purchaseDate:'10 Fev' },
    { eventId:2, eventName:'DJ Stéphane Live', eventEmoji:'🎧', eventDate:'22 Mars', section:'GA', sectionColor:'#00D4FF', qty:30, priceEach:20, totalPaid:600, sold:8, purchaseDate:'15 Fev' },
  ]},
  { id:2, name:'Farmasi Lespwa', contact:'Marie Julien', phone:'+509 3412 2222', city:'Pòtoprens', payMethod:'Natcash', payAccount:'+509 3412 2222', status:'active', joinedDate:'20 Jan 2026', purchases:[
    { eventId:1, eventName:'Kompa Fest 2026', eventEmoji:'🎶', eventDate:'15 Mars', section:'GA', sectionColor:'#00D4FF', qty:100, priceEach:8, totalPaid:800, sold:35, purchaseDate:'12 Fev' },
  ]},
  { id:3, name:'Babo Barbershop', contact:'Roberto Charles', phone:'+509 3412 3333', city:'Delmas', payMethod:'MonCash', payAccount:'+509 3412 3333', status:'active', joinedDate:'25 Jan 2026', purchases:[
    { eventId:1, eventName:'Kompa Fest 2026', eventEmoji:'🎶', eventDate:'15 Mars', section:'VIP', sectionColor:'#FF6B35', qty:25, priceEach:60, totalPaid:1500, sold:25, purchaseDate:'8 Fev' },
    { eventId:3, eventName:'Rara Lakay 2026', eventEmoji:'🥁', eventDate:'5 Avr', section:'GA', sectionColor:'#00D4FF', qty:50, priceEach:8, totalPaid:400, sold:12, purchaseDate:'20 Fev' },
  ]},
  { id:4, name:'Lakay Mizik', contact:'Sophia Bien-Aimé', phone:'+509 3412 4444', city:'Jacmel', payMethod:'MonCash', payAccount:'+509 3412 4444', status:'active', joinedDate:'1 Fev 2026', purchases:[
    { eventId:3, eventName:'Rara Lakay 2026', eventEmoji:'🥁', eventDate:'5 Avr', section:'VIP', sectionColor:'#FF6B35', qty:10, priceEach:28, totalPaid:280, sold:4, purchaseDate:'22 Fev' },
    { eventId:3, eventName:'Rara Lakay 2026', eventEmoji:'🥁', eventDate:'5 Avr', section:'GA', sectionColor:'#00D4FF', qty:25, priceEach:8, totalPaid:200, sold:8, purchaseDate:'22 Fev' },
  ]},
  { id:5, name:'Quick Stop PV', contact:'Patrick Duval', phone:'+509 3412 5555', city:'Pétion-Ville', payMethod:'Natcash', payAccount:'+509 3412 5555', status:'pending', joinedDate:'—', purchases:[] },
];

/* ══════════════════════════════════════════════════════════════════ */

export default function OrganizerVendorsPage() {
  const [expandedVendor, setExpandedVendor] = useState<number|null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [pricingEvent, setPricingEvent] = useState(0);

  const filtered = VENDORS.filter(v => {
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    if (filterEvent !== 'all' && !v.purchases.some(p => p.eventId === Number(filterEvent))) return false;
    return true;
  });

  const totalPurchased = VENDORS.flatMap(v => v.purchases).reduce((a, b) => a + b.qty, 0);
  const totalSold = VENDORS.flatMap(v => v.purchases).reduce((a, b) => a + b.sold, 0);
  const totalRevenue = VENDORS.flatMap(v => v.purchases).reduce((a, b) => a + b.totalPaid, 0);

  const fmtTier = (t: { minQty:number; maxQty:number|null }) => t.maxQty ? `${t.minQty}–${t.maxQty}` : `${t.minQty}+`;

  return (
    <div className="min-h-screen flex flex-col bg-dark">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-dark border-b border-border px-5">
        <div className="max-w-[1200px] mx-auto flex items-center h-14 gap-3">
          <Link href="/organizer/dashboard" className="text-gray-light text-xs hover:text-white transition-colors">← Dachbòd</Link>
          <div className="w-px h-5 bg-border" />
          <span className="font-heading text-lg tracking-wide flex-1">JERE VANDÈ</span>
          <button onClick={() => setShowPricing(!showPricing)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-orange-border text-orange text-xs font-bold hover:bg-orange hover:text-white transition-all">
            💲 Pri Angwo
          </button>
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
            ➕ Envite Vandè
          </button>
        </div>
      </nav>

      <div className="max-w-[1200px] mx-auto w-full px-5 py-5 flex-1">

        {/* ═══ SUMMARY STATS ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="bg-dark-card border border-border rounded-card p-3.5">
            <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">Vandè Aktif</p>
            <p className="font-heading text-2xl">{VENDORS.filter(v => v.status === 'active').length}</p>
          </div>
          <div className="bg-dark-card border border-border rounded-card p-3.5">
            <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">Tikè Achte pa Vandè</p>
            <p className="font-heading text-2xl">{totalPurchased}</p>
          </div>
          <div className="bg-dark-card border border-border rounded-card p-3.5">
            <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">Tikè Vandè Vann</p>
            <p className="font-heading text-2xl text-green">{totalSold} <span className="text-[10px] text-gray-muted font-body font-normal">({totalPurchased > 0 ? Math.round((totalSold/totalPurchased)*100) : 0}%)</span></p>
          </div>
          <div className="bg-dark-card border border-green rounded-card p-3.5">
            <p className="text-[9px] text-green uppercase tracking-widest mb-1">💰 Revni (Peye Davans)</p>
            <p className="font-heading text-2xl text-green">${totalRevenue.toLocaleString()}</p>
          </div>
        </div>

        {/* ═══ BULK PRICING PANEL ═══ */}
        {showPricing && (
          <div className="bg-dark-card border border-orange-border rounded-card p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg tracking-wide">💲 PRI ANGWO PA EVÈNMAN</h3>
              <button onClick={() => setShowPricing(false)} className="text-gray-muted hover:text-white text-sm">✕</button>
            </div>
            <p className="text-xs text-gray-light mb-4">Fikse pri angwo pou vandè yo. Plis yo achte, mwens yo peye pa tikè. Vandè peye davans — pa gen dèt.</p>

            {/* Event Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {EVENTS.map((ev, i) => (
                <button key={ev.id} onClick={() => setPricingEvent(i)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${pricingEvent === i ? 'bg-orange text-white' : 'border border-border text-gray-light hover:text-white hover:border-white/[0.15]'}`}>
                  {ev.emoji} {ev.name}
                </button>
              ))}
            </div>

            {/* Section Pricing Tables */}
            <div className="space-y-4">
              {EVENTS[pricingEvent].sections.map(sec => (
                <div key={sec.section} className="border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full" style={{background:sec.sectionColor}} />
                    <span className="text-sm font-bold">{sec.section}</span>
                    <span className="text-[10px] text-gray-muted">· Pri online: <strong className="text-white">${sec.onlinePrice}</strong> · {sec.available} disponib pou vandè</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2">Kantite</th>
                          <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">Pri Angwo pa Tikè</th>
                          <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">Rabè</th>
                          <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">Egzanp Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sec.bulkTiers.map((t, i) => {
                          const discount = Math.round(((sec.onlinePrice - t.priceEach) / sec.onlinePrice) * 100);
                          const exQty = t.minQty;
                          return (
                            <tr key={i} className="border-b border-border last:border-0">
                              <td className="py-2.5 text-xs font-bold">{fmtTier(t)} tikè</td>
                              <td className="py-2.5 text-xs text-right">
                                <span className="font-heading text-lg">${t.priceEach}</span>
                                <span className="text-[10px] text-gray-muted ml-1">chak</span>
                              </td>
                              <td className="py-2.5 text-xs text-right"><span className="text-green font-bold">-{discount}%</span></td>
                              <td className="py-2.5 text-xs text-right text-gray-light">{exQty} × ${t.priceEach} = <strong className="text-white">${exQty * t.priceEach}</strong></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button className="mt-3 text-[10px] text-orange hover:underline">✏️ Modifye pri pou seksyon sa a</button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-muted mt-4 bg-white/[0.02] rounded-lg p-3">💡 Vandè peye davans. Lajan an ale dirèkteman nan kont ou lè yo achte tikè. Pa gen dèt, pa gen kouri dèyè lajan.</p>
          </div>
        )}

        {/* ═══ FILTERS ═══ */}
        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 rounded-full border border-border bg-transparent text-gray-light text-[11px] font-semibold outline-none cursor-pointer">
            <option value="all" className="bg-dark-card">Tout estati</option>
            <option value="active" className="bg-dark-card">✅ Aktif</option>
            <option value="pending" className="bg-dark-card">⏳ An atant</option>
            <option value="inactive" className="bg-dark-card">⛔ Inaktif</option>
          </select>
          <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} className="px-3 py-1.5 rounded-full border border-border bg-transparent text-gray-light text-[11px] font-semibold outline-none cursor-pointer">
            <option value="all" className="bg-dark-card">Tout evènman</option>
            {EVENTS.map(ev => <option key={ev.id} value={ev.id} className="bg-dark-card">{ev.emoji} {ev.name}</option>)}
          </select>
          <span className="text-[11px] text-gray-muted ml-auto">{filtered.length} vandè</span>
        </div>

        {/* ═══ INVITE FORM ═══ */}
        {showInvite && (
          <div className="bg-dark-card border border-orange-border rounded-card p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-lg tracking-wide">ENVITE YON NOUVO VANDÈ</h3>
              <button onClick={() => setShowInvite(false)} className="text-gray-muted hover:text-white text-sm">✕</button>
            </div>
            <p className="text-xs text-gray-light mb-4">Vandè a ap resevwa yon lyen WhatsApp pou kreye kont li. Apre sa li ka achte tikè angwo.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Non Biznis *</label><input className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Ex: Ti Jak Boutik" /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Kontakt *</label><input className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Non moun responsab" /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Telefòn WhatsApp *</label><input className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="+509 3412 0000" /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Vil *</label><input className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Pétion-Ville" /></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Metòd Peman</label>
                <select className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange">
                  <option className="bg-dark-card">📱 MonCash</option><option className="bg-dark-card">💚 Natcash</option><option className="bg-dark-card">🏦 Kont Bank</option><option className="bg-dark-card">💳 Stripe</option><option className="bg-dark-card">⚡ Zelle</option><option className="bg-dark-card">🅿️ PayPal</option><option className="bg-dark-card">💲 Cash App</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="px-5 py-2.5 rounded-[10px] bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">📨 Voye Envitasyon WhatsApp</button>
              <button onClick={() => setShowInvite(false)} className="px-5 py-2.5 rounded-[10px] border border-border text-gray-light text-xs font-bold hover:text-white transition-all">Anile</button>
            </div>
          </div>
        )}

        {/* ═══ VENDOR LIST ═══ */}
        <div className="space-y-3">
          {filtered.map(v => {
            const expanded = expandedVendor === v.id;
            const vTotalQty = v.purchases.reduce((a, b) => a + b.qty, 0);
            const vTotalSold = v.purchases.reduce((a, b) => a + b.sold, 0);
            const vTotalPaid = v.purchases.reduce((a, b) => a + b.totalPaid, 0);

            return (
              <div key={v.id} className="bg-dark-card border border-border rounded-card overflow-hidden hover:border-white/[0.08] transition-all">
                {/* HEADER */}
                <div className="p-4 cursor-pointer" onClick={() => setExpandedVendor(expanded ? null : v.id)}>
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-purple-dim border border-purple-border flex items-center justify-center text-xl flex-shrink-0">🏪</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="font-bold text-sm">{v.name}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                          v.status === 'active' ? 'bg-green-dim text-green' : v.status === 'pending' ? 'bg-yellow-dim text-yellow' : 'bg-white/[0.05] text-gray-muted'
                        }`}>
                          {v.status === 'active' ? 'AKTIF' : v.status === 'pending' ? 'AN ATANT' : 'INAKTIF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-light">{v.contact} · 📍 {v.city} · {v.phone}</p>
                      <p className="text-[10px] text-gray-muted mt-0.5">{v.payMethod} — {v.payAccount} · Depi {v.joinedDate}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[9px] text-gray-muted uppercase">Achte</p>
                          <p className="text-sm font-bold">{vTotalQty}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-gray-muted uppercase">Vann</p>
                          <p className="text-sm font-bold text-green">{vTotalSold}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-green uppercase">Peye</p>
                          <p className="text-sm font-bold text-green">${vTotalPaid.toLocaleString()}</p>
                        </div>
                        <span className={`text-gray-muted text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* EXPANDED — PURCHASES */}
                {expanded && (
                  <div className="border-t border-border">
                    {v.purchases.length === 0 ? (
                      <div className="p-5 text-center">
                        <p className="text-xs text-gray-muted mb-3">{v.status === 'pending' ? 'Vandè sa a poko aksepte envitasyon an.' : 'Vandè sa a poko achte tikè.'}</p>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left mb-3">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2">Evènman</th>
                                <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2">Seksyon</th>
                                <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-center">Achte</th>
                                <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-center">Vann</th>
                                <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-center">Rete</th>
                                <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">Pri Angwo</th>
                                <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">Total Peye</th>
                                <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">Dat Acha</th>
                              </tr>
                            </thead>
                            <tbody>
                              {v.purchases.map((p, i) => {
                                const remaining = p.qty - p.sold;
                                const pct = Math.round((p.sold / p.qty) * 100);
                                return (
                                  <tr key={i} className="border-b border-border last:border-0">
                                    <td className="py-2.5"><span className="text-xs">{p.eventEmoji} {p.eventName}</span><p className="text-[9px] text-gray-muted">📅 {p.eventDate}</p></td>
                                    <td className="py-2.5"><span className="px-2 py-0.5 rounded text-[9px] font-bold border" style={{color:p.sectionColor, borderColor:p.sectionColor, background:p.sectionColor+'15'}}>{p.section}</span></td>
                                    <td className="text-xs text-center font-bold">{p.qty}</td>
                                    <td className="text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <span className="text-xs font-bold text-green">{p.sold}</span>
                                        <div className="w-10 h-1.5 bg-white/[0.06] rounded-full overflow-hidden"><div className="h-full bg-green rounded-full" style={{width:`${pct}%`}} /></div>
                                      </div>
                                    </td>
                                    <td className={`text-xs text-center font-bold ${remaining <= 5 && remaining > 0 ? 'text-orange' : remaining === 0 ? 'text-gray-muted' : ''}`}>
                                      {remaining === 0 ? '✓ Fini' : remaining}
                                    </td>
                                    <td className="text-xs text-right font-bold">${p.priceEach} <span className="text-[9px] text-gray-muted font-normal">chak</span></td>
                                    <td className="text-xs text-right text-green font-bold">${p.totalPaid.toLocaleString()}</td>
                                    <td className="text-xs text-right text-gray-muted">{p.purchaseDate}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex items-center gap-4 pt-2 border-t border-border flex-wrap">
                          <div><span className="text-[9px] text-gray-muted uppercase">Total Achte:</span> <span className="text-xs font-bold">{vTotalQty}</span></div>
                          <div><span className="text-[9px] text-gray-muted uppercase">Total Vann:</span> <span className="text-xs font-bold text-green">{vTotalSold}</span></div>
                          <div><span className="text-[9px] text-green uppercase font-bold">💰 Peye Davans:</span> <span className="text-xs font-bold text-green">${vTotalPaid.toLocaleString()}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

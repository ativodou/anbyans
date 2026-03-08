'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';

/* ══════════════════════════════════════════════════════════════════ */

interface BulkTier { minQty: number; maxQty: number | null; priceEach: number; }

interface LocalizedText { ht: string; en: string; fr: string; }

interface AvailableEvent {
  id: number; name: string; emoji: string; date: LocalizedText;
  sections: { section: string; sectionColor: string; onlinePrice: number; available: number; bulkTiers: BulkTier[] }[];
}

interface OwnedStock {
  eventId: number; eventName: string; eventEmoji: string; eventDate: LocalizedText;
  section: string; sectionColor: string;
  qty: number; costEach: number; totalCost: number;
  sold: number; purchaseDate: LocalizedText;
}

const AVAILABLE_EVENTS: AvailableEvent[] = [
  { id:1, name:'Kompa Fest 2026', emoji:'🎶', date:{ht:'15 Mars',en:'Mar 15',fr:'15 mars'}, sections:[
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
  { id:2, name:'DJ Stéphane Live', emoji:'🎧', date:{ht:'22 Mars',en:'Mar 22',fr:'22 mars'}, sections:[
    { section:'GA', sectionColor:'#00D4FF', onlinePrice:25, available:120, bulkTiers:[
      { minQty:25, maxQty:50, priceEach:20 },
      { minQty:51, maxQty:null, priceEach:17 },
    ]},
  ]},
];

const OWNED: OwnedStock[] = [
  { eventId:1, eventName:'Kompa Fest 2026', eventEmoji:'🎶', eventDate:{ht:'15 Mars',en:'Mar 15',fr:'15 mars'}, section:'VIP', sectionColor:'#FF6B35', qty:30, costEach:55, totalCost:1650, sold:22, purchaseDate:{ht:'10 Fev',en:'Feb 10',fr:'10 fév'} },
  { eventId:1, eventName:'Kompa Fest 2026', eventEmoji:'🎶', eventDate:{ht:'15 Mars',en:'Mar 15',fr:'15 mars'}, section:'GA', sectionColor:'#00D4FF', qty:50, costEach:10, totalCost:500, sold:38, purchaseDate:{ht:'10 Fev',en:'Feb 10',fr:'10 fév'} },
  { eventId:2, eventName:'DJ Stéphane Live', eventEmoji:'🎧', eventDate:{ht:'22 Mars',en:'Mar 22',fr:'22 mars'}, section:'GA', sectionColor:'#00D4FF', qty:30, costEach:20, totalCost:600, sold:8, purchaseDate:{ht:'15 Fev',en:'Feb 15',fr:'15 fév'} },
];

const RECENT_SALES = [
  { time:'5 min', event:'Kompa Fest 2026', section:'VIP', sectionColor:'#FF6B35', qty:1, sellPrice:75, costPrice:55, buyer:'Marie J.', phone:'+509 3412 8888' },
  { time:'18 min', event:'Kompa Fest 2026', section:'GA', sectionColor:'#00D4FF', qty:2, sellPrice:15, costPrice:10, buyer:'Roberto C.', phone:'+509 3412 7777' },
  { time:'45 min', event:'DJ Stéphane Live', section:'GA', sectionColor:'#00D4FF', qty:1, sellPrice:25, costPrice:20, buyer:'Patrick D.', phone:'+509 3412 6666' },
  { time:'1h', event:'Kompa Fest 2026', section:'GA', sectionColor:'#00D4FF', qty:3, sellPrice:15, costPrice:10, buyer:'Sophia B.', phone:'+509 3412 5555' },
  { time:'2h', event:'Kompa Fest 2026', section:'VIP', sectionColor:'#FF6B35', qty:1, sellPrice:75, costPrice:55, buyer:'Jacques M.', phone:'+509 3412 4444' },
];

type Tab = 'sell' | 'buy' | 'inventory' | 'sales';

/* ══════════════════════════════════════════════════════════════════ */

export default function VendorDashboardPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<typeof locale, string>)[locale];
  const byLocale = (value: LocalizedText) => value[locale as keyof LocalizedText];
  const [tab, setTab] = useState<Tab>('sell');

  // Sell state
  const [sellStock, setSellStock] = useState(0);
  const [sellQty, setSellQty] = useState(1);
  const [sellPrice, setSellPrice] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Buy state
  const [buyEvent, setBuyEvent] = useState(0);
  const [buySection, setBuySection] = useState(0);
  const [buyQty, setBuyQty] = useState(10);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [buyComplete, setBuyComplete] = useState(false);

  // Calculations
  const totalInvested = OWNED.reduce((a, b) => a + b.totalCost, 0);
  const totalStock = OWNED.reduce((a, b) => a + b.qty, 0);
  const totalSold = OWNED.reduce((a, b) => a + b.sold, 0);
  const totalRemaining = totalStock - totalSold;
  const totalSalesRevenue = RECENT_SALES.reduce((a, s) => a + s.qty * s.sellPrice, 0);
  const totalSalesCost = RECENT_SALES.reduce((a, s) => a + s.qty * s.costPrice, 0);
  const totalProfit = totalSalesRevenue - totalSalesCost;

  const currentStock = OWNED[sellStock];
  const remaining = currentStock ? currentStock.qty - currentStock.sold : 0;
  const suggestedPrice = currentStock ? Math.round(currentStock.costEach * 1.2) : 0;
  const actualSellPrice = Number(sellPrice) || suggestedPrice;
  const saleTotal = sellQty * actualSellPrice;
  const saleProfit = sellQty * (actualSellPrice - (currentStock?.costEach || 0));

  // Buy calculations
  const selectedEvent = AVAILABLE_EVENTS[buyEvent];
  const selectedSection = selectedEvent?.sections[buySection];
  const getBulkPrice = (tiers: BulkTier[], qty: number) => {
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (qty >= tiers[i].minQty) return tiers[i].priceEach;
    }
    return tiers[0]?.priceEach || 0;
  };
  const bulkPrice = selectedSection ? getBulkPrice(selectedSection.bulkTiers, buyQty) : 0;
  const buyTotal = buyQty * bulkPrice;
  const fmtTier = (tier: BulkTier) => tier.maxQty ? `${tier.minQty}–${tier.maxQty}` : `${tier.minQty}+`;

  const handleSell = () => {
    if (!buyerName || !buyerPhone) return;
    setShowConfirm(true);
  };
  const confirmSale = () => {
    setConfirmed(true);
    setTimeout(() => { setConfirmed(false); setShowConfirm(false); setBuyerName(''); setBuyerPhone(''); setSellQty(1); setSellPrice(''); }, 3000);
  };
  const confirmBuy = () => {
    setBuyComplete(true);
    setTimeout(() => { setBuyComplete(false); setShowBuyConfirm(false); }, 3000);
  };

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id:'sell', icon:'🎫', label:t('vend_dash_sell') },
    { id:'buy', icon:'🛒', label:t('vend_dash_buy') },
    { id:'inventory', icon:'📦', label:t('vend_dash_inventory') },
    { id:'sales', icon:'📋', label:t('vend_dash_sales') },
  ];

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-dark border-b border-border px-5">
        <div className="max-w-[800px] mx-auto flex items-center h-14 gap-3">
          <Link href="/"><img src="/logo.jpg" alt="Anbyans" className="h-8 rounded" /></Link>
          <div className="w-px h-5 bg-border" />
          <span className="font-heading text-lg tracking-wide flex-1">TI JAK BOUTIK</span>
          <LangSwitcher />
          <span className="text-[10px] text-purple font-bold bg-purple-dim px-2 py-0.5 rounded">🏪 {L('REVANDÈ','RESELLER','VENDEUR')}</span>
          <button onClick={() => router.back()} className="text-gray-muted hover:text-red text-sm ml-2">🚪</button>
        </div>
      </nav>

      {/* TABS */}
      <div className="sticky top-14 z-40 bg-dark border-b border-border px-5">
        <div className="max-w-[800px] mx-auto flex">
          {TABS.map(tb => (
            <button key={tb.id} onClick={() => { setTab(tb.id); setShowConfirm(false); setConfirmed(false); setShowBuyConfirm(false); setBuyComplete(false); }}
              className={`flex-1 py-3 text-[12px] font-bold text-center transition-all border-b-2 ${tab === tb.id ? 'text-purple border-purple' : 'text-gray-muted border-transparent hover:text-gray-light'}`}>
              {tb.icon} {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[800px] mx-auto w-full px-5 py-5 flex-1">

        {/* ═══ SELL TAB ═══ */}
        {tab === 'sell' && !showConfirm && !confirmed && (
          <div>
            <h2 className="font-heading text-xl tracking-wide mb-4">{t('vend_sell_title')}</h2>
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="bg-dark-card border border-border rounded-card p-3 text-center">
                <p className="text-[9px] text-gray-muted uppercase">{t('vend_sell_stock')}</p>
                <p className="font-heading text-2xl">{totalRemaining}</p>
              </div>
              <div className="bg-dark-card border border-border rounded-card p-3 text-center">
                <p className="text-[9px] text-gray-muted uppercase">{t('sold')}</p>
                <p className="font-heading text-2xl text-green">{totalSold}</p>
              </div>
              <div className="bg-dark-card border border-border rounded-card p-3 text-center">
                <p className="text-[9px] text-gray-muted uppercase">{t('revenue')}</p>
                <p className="font-heading text-2xl">${totalSalesRevenue}</p>
              </div>
              <div className="bg-dark-card border border-green rounded-card p-3 text-center">
                <p className="text-[9px] text-green uppercase">{t('profit')}</p>
                <p className="font-heading text-2xl text-green">${totalProfit}</p>
              </div>
            </div>

            <div className="bg-dark-card border border-purple-border rounded-2xl p-5">
              <div className="space-y-4">
                {/* Select from owned stock */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('vend_sell_select')} *</label>
                  <div className="space-y-2">
                    {OWNED.map((s, i) => {
                      const rem = s.qty - s.sold;
                      if (rem <= 0) return null;
                      return (
                        <button
                          key={i}
                          onClick={() => { setSellStock(i); setSellPrice(''); }}
                          className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${sellStock === i ? 'border-purple bg-purple-dim' : 'border-border hover:border-white/[0.1]'}`}
                        >
                          <div className="flex items-center gap-3 text-left">
                            <span className="text-2xl">{s.eventEmoji}</span>
                            <div>
                              <p className="text-xs font-bold">{s.eventName}</p>
                              <p className="text-[10px] text-gray-muted">📅 {byLocale(s.eventDate)} · <span style={{color:s.sectionColor}}>{s.section}</span></p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold">{rem} {t('vend_sell_remaining')}</p>
                            <p className="text-[9px] text-gray-muted">{t('vend_sell_cost')}: ${s.costEach}/{L('tikè','ticket','billet')}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Qty + Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('quantity')}</label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setSellQty(Math.max(1, sellQty - 1))} className="w-10 h-10 rounded-xl border border-border text-lg font-bold hover:border-purple hover:text-purple transition-all">−</button>
                      <span className="font-heading text-3xl w-12 text-center">{sellQty}</span>
                      <button onClick={() => setSellQty(Math.min(remaining, sellQty + 1))} className="w-10 h-10 rounded-xl border border-border text-lg font-bold hover:border-purple hover:text-purple transition-all">+</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('vend_sell_price')}</label>
                    <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder={`Ex: ${suggestedPrice}`}
                      className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-lg font-heading outline-none focus:border-purple placeholder:text-gray-muted" />
                    <p className="text-[9px] text-gray-muted mt-1">{L('Ou te peye','You paid','Vous avez payé')} ${currentStock?.costEach}/{L('tikè','ticket','billet')} · {L('Pri online','Online price','Prix en ligne')}: ${OWNED[sellStock]?.eventId === 1 && OWNED[sellStock]?.section === 'VIP' ? '75' : OWNED[sellStock]?.section === 'GA' ? '15–25' : '—'}</p>
                  </div>
                </div>

                {/* Sale summary */}
                <div className="bg-white/[0.02] border border-border rounded-xl p-3 flex items-center justify-between">
                  <div><p className="text-[10px] text-gray-muted">{L('Total Vant','Total Sale','Total vente')}</p><p className="font-heading text-2xl">${saleTotal}</p></div>
                  <div className="text-right"><p className="text-[10px] text-gray-muted">{t('profit')}</p><p className={`font-heading text-2xl ${saleProfit >= 0 ? 'text-green' : 'text-red'}`}>{saleProfit >= 0 ? '+' : ''}${saleProfit}</p></div>
                </div>

                {/* Buyer */}
                <div className="border-t border-border pt-4">
                  <p className="text-[10px] uppercase tracking-widest text-purple font-bold mb-3">{t('vend_sell_customer')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">{t('vend_sell_customer_name')} *</label><input value={buyerName} onChange={e => setBuyerName(e.target.value)} className="w-full px-3 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder={L('Non konplè','Full name','Nom complet')!} /></div>
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">{L('Telefòn WhatsApp','WhatsApp Phone','Téléphone WhatsApp')} *</label><input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="+509 3412 0000" /></div>
                  </div>
                </div>
              </div>

              <button onClick={handleSell} disabled={remaining === 0} className="w-full mt-5 py-4 rounded-xl bg-purple text-white font-bold text-base hover:bg-purple/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                🎫 {t('vend_sell_btn')} {sellQty} {t('tickets')} — ${saleTotal}
              </button>
              <p className="text-[10px] text-gray-muted text-center mt-2">{t('vend_sell_whatsapp_sent')}</p>
            </div>
          </div>
        )}

        {/* CONFIRM SALE */}
        {tab === 'sell' && showConfirm && !confirmed && (
          <div className="bg-dark-card border border-purple-border rounded-2xl p-6 text-center">
            <div className="text-5xl mb-3">🎫</div>
            <h3 className="font-heading text-2xl tracking-wide mb-4">{t('vend_sell_confirm')}</h3>
            <div className="bg-white/[0.02] border border-border rounded-xl p-4 mb-5 text-left max-w-sm mx-auto">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-light">{L('Evènman:','Event:','Événement :')}</span><span className="font-bold">{currentStock?.eventName}</span></div>
                <div className="flex justify-between"><span className="text-gray-light">{L('Seksyon:','Section:','Section :')}</span><span className="font-bold" style={{color:currentStock?.sectionColor}}>{currentStock?.section}</span></div>
                <div className="flex justify-between"><span className="text-gray-light">{t('quantity')}:</span><span className="font-bold">{sellQty}</span></div>
                <div className="flex justify-between"><span className="text-gray-light">{L('Pri pa tikè:','Price per ticket:','Prix par billet :')}</span><span className="font-bold">${actualSellPrice}</span></div>
                <div className="flex justify-between"><span className="text-gray-light">{L('Kliyan:','Customer:','Client :')}</span><span className="font-bold">{buyerName}</span></div>
                <div className="flex justify-between"><span className="text-gray-light">WhatsApp:</span><span className="font-bold">{buyerPhone}</span></div>
                <div className="flex justify-between border-t border-border pt-2 mt-2"><span className="text-gray-light">{t('total')}:</span><span className="font-heading text-2xl text-white">${saleTotal}</span></div>
                <div className="flex justify-between"><span className="text-gray-light">{t('profit')}:</span><span className={`font-bold ${saleProfit >= 0 ? 'text-green' : 'text-red'}`}>{saleProfit >= 0 ? '+' : ''}${saleProfit}</span></div>
              </div>
            </div>
            <div className="flex gap-3 max-w-sm mx-auto">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-xl border border-border text-gray-light font-bold text-sm hover:text-white transition-all">← {t('back')}</button>
              <button onClick={confirmSale} className="flex-1 py-3 rounded-xl bg-green text-white font-bold text-sm hover:bg-green/80 transition-all">✓ {t('confirm')}</button>
            </div>
          </div>
        )}

        {tab === 'sell' && confirmed && (
          <div className="bg-dark-card border border-green rounded-2xl p-8 text-center">
            <div className="text-6xl mb-3">✅</div>
            <h3 className="font-heading text-3xl tracking-wide mb-2 text-green">{t('vend_sell_success')}</h3>
            <p className="text-xs text-gray-light mb-1">{t('vend_sell_whatsapp_sent')} <strong className="text-white">{buyerPhone}</strong></p>
            <p className="text-sm font-bold text-green mt-2">{t('profit')}: +${saleProfit}</p>
          </div>
        )}

        {/* ═══ BUY TAB ═══ */}
        {tab === 'buy' && !showBuyConfirm && !buyComplete && (
          <div>
            <h2 className="font-heading text-xl tracking-wide mb-1">{t('vend_buy_title')}</h2>
            <p className="text-xs text-gray-light mb-5">{t('vend_buy_subtitle')}</p>
            <div className="space-y-2">
              {AVAILABLE_EVENTS.map((ev, i) => (
                <button
                  key={ev.id}
                  onClick={() => { setBuyEvent(i); setBuySection(0); setBuyQty(ev.sections[0]?.bulkTiers[0]?.minQty || 10); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${buyEvent === i ? 'border-purple bg-purple-dim' : 'border-border hover:border-white/[0.1]'}`}
                >
                  <span className="text-2xl">{ev.emoji}</span>
                  <div className="text-left">
                    <p className="text-xs font-bold">{ev.name}</p>
                    <p className="text-[10px] text-gray-muted">📅 {byLocale(ev.date)}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Section */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Seksyon','Section','Section')}</label>
                <div className="flex gap-2">
                  {selectedEvent?.sections.map((sec, i) => (
                    <button key={i} onClick={() => { setBuySection(i); setBuyQty(sec.bulkTiers[0]?.minQty || 10); }}
                      className={`flex-1 p-3 rounded-xl border text-center transition-all ${buySection === i ? 'border-purple bg-purple-dim' : 'border-border hover:border-white/[0.1]'}`}>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold border inline-block mb-1" style={{color:sec.sectionColor, borderColor:sec.sectionColor, background:sec.sectionColor+'15'}}>{sec.section}</span>
                      <p className="text-[10px] text-gray-muted">Online: ${sec.onlinePrice}</p>
                      <p className="text-[9px] text-gray-muted">{sec.available} {L('disponib','available','disponible')}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulk Pricing Table */}
              {selectedSection && (
                <div className="mb-4 bg-white/[0.02] border border-border rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-2">💲 {t('vend_buy_bulk_price')} — {selectedSection.section}</p>
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-border">
                      <th className="text-[9px] text-gray-muted uppercase pb-2">{t('quantity')}</th>
                      <th className="text-[9px] text-gray-muted uppercase pb-2 text-right">{L('Pri Chak','Price Each','Prix unitaire')}</th>
                      <th className="text-[9px] text-gray-muted uppercase pb-2 text-right">{t('vend_buy_discount')}</th>
                    </tr></thead>
                    <tbody>
                      {selectedSection.bulkTiers.map((tier, i) => {
                        const disc = Math.round(((selectedSection.onlinePrice - tier.priceEach) / selectedSection.onlinePrice) * 100);
                        const active = buyQty >= tier.minQty && (tier.maxQty === null || buyQty <= tier.maxQty);
                        return (
                          <tr key={i} className={`border-b border-border last:border-0 ${active ? 'bg-purple-dim' : ''}`}>
                            <td className={`py-2 text-xs ${active ? 'font-bold text-purple' : ''}`}>{fmtTier(tier)} {L('tikè','tickets','billets')} {active && `← ${L('ou','you','vous')}`}</td>
                            <td className="py-2 text-xs text-right"><span className={`font-heading text-base ${active ? 'text-white' : ''}`}>${tier.priceEach}</span></td>
                            <td className="py-2 text-xs text-right"><span className="text-green font-bold">-{disc}%</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Quantity */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('quantity')}</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setBuyQty(Math.max(1, buyQty - 5))} className="w-10 h-10 rounded-xl border border-border text-sm font-bold hover:border-purple hover:text-purple transition-all">-5</button>
                  <button onClick={() => setBuyQty(Math.max(1, buyQty - 1))} className="w-10 h-10 rounded-xl border border-border text-lg font-bold hover:border-purple hover:text-purple transition-all">−</button>
                  <span className="font-heading text-4xl w-20 text-center">{buyQty}</span>
                  <button onClick={() => setBuyQty(Math.min(selectedSection?.available || 999, buyQty + 1))} className="w-10 h-10 rounded-xl border border-border text-lg font-bold hover:border-purple hover:text-purple transition-all">+</button>
                  <button onClick={() => setBuyQty(Math.min(selectedSection?.available || 999, buyQty + 5))} className="w-10 h-10 rounded-xl border border-border text-sm font-bold hover:border-purple hover:text-purple transition-all">+5</button>
                </div>
              </div>

              {/* Total */}
              <div className="bg-purple-dim border border-purple-border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-muted uppercase">{t('vend_buy_bulk_price')}</p>
                  <p className="text-sm">${bulkPrice} × {buyQty} {t('tickets')}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-muted uppercase">{t('vend_buy_you_pay')}</p>
                  <p className="font-heading text-3xl">${buyTotal.toLocaleString()}</p>
                </div>
              </div>

              <button onClick={() => setShowBuyConfirm(true)} disabled={buyQty < (selectedSection?.bulkTiers[0]?.minQty || 1)}
                className="w-full mt-4 py-4 rounded-xl bg-purple text-white font-bold text-base hover:bg-purple/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                🛒 {t('vend_dash_buy')} {buyQty} {t('tickets')} — ${buyTotal.toLocaleString()}
              </button>
              <p className="text-[10px] text-gray-muted text-center mt-2">{L('Tikè yo ap parèt nan envantè ou imedyatman apre peman','Tickets will appear in your inventory immediately after payment','Les billets apparaîtront dans votre inventaire immédiatement après le paiement')}</p>
          </div>
        )}

        {/* BUY CONFIRM */}
        {tab === 'buy' && showBuyConfirm && !buyComplete && (
          <div className="bg-dark-card border border-purple-border rounded-2xl p-6 text-center">
            <div className="text-5xl mb-3">🛒</div>
            <h3 className="font-heading text-2xl tracking-wide mb-4">{t('vend_buy_confirm')}</h3>
            <div className="bg-white/[0.02] border border-border rounded-xl p-4 mb-5 text-left max-w-sm mx-auto text-xs space-y-2">
              <div className="flex justify-between"><span className="text-gray-light">{L('Evènman:','Event:','Événement :')}</span><span className="font-bold">{selectedEvent?.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-light">{L('Seksyon:','Section:','Section :')}</span><span className="font-bold" style={{color:selectedSection?.sectionColor}}>{selectedSection?.section}</span></div>
              <div className="flex justify-between"><span className="text-gray-light">{t('quantity')}:</span><span className="font-bold">{buyQty} {t('tickets')}</span></div>
              <div className="flex justify-between"><span className="text-gray-light">{t('vend_buy_bulk_price')}:</span><span className="font-bold">${bulkPrice} {t('vend_buy_each')}</span></div>
              <div className="flex justify-between border-t border-border pt-2 mt-2"><span className="text-gray-light">{t('total')}:</span><span className="font-heading text-2xl">${buyTotal.toLocaleString()}</span></div>
            </div>
            <p className="text-[10px] text-gray-muted mb-4">{L('Chwazi kijan ou vle peye:','Choose how to pay:','Choisissez comment payer :')}</p>
            <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto mb-4">
              {[`📱 MonCash`,`💚 Natcash`,`💳 ${L('Kat Kredi/Debi','Credit/Debit Card','Carte de crédit/débit')}`,`🏦 ${L('Transfè Bank','Bank Transfer','Virement')}`,`⚡ Zelle`,`💲 Cash App`,`🅿️ PayPal`].map(m => (
                <button key={m} onClick={confirmBuy} className="px-3 py-2.5 rounded-xl border border-border text-gray-light text-[11px] font-bold hover:text-white hover:border-purple transition-all">{m}</button>
              ))}
            </div>
            <button onClick={() => setShowBuyConfirm(false)} className="text-[11px] text-gray-muted hover:text-white">← {t('back')}</button>
          </div>
        )}

        {tab === 'buy' && buyComplete && (
          <div className="bg-dark-card border border-green rounded-2xl p-8 text-center">
            <div className="text-6xl mb-3">✅</div>
            <h3 className="font-heading text-3xl tracking-wide mb-2 text-green">{t('vend_buy_success')}</h3>
            <p className="text-xs text-gray-light mb-1"><strong>{buyQty}</strong> {t('tickets')} <span style={{color:selectedSection?.sectionColor}}>{selectedSection?.section}</span> {L('pou','for','pour')} <strong>{selectedEvent?.name}</strong></p>
            <p className="text-xs text-gray-light">{L('ajoute nan envantè ou. Ou ka kòmanse vann kounye a!','added to your inventory. You can start selling now!','ajoutés à votre inventaire. Vous pouvez commencer à vendre !')}</p>
            <button onClick={() => { setBuyComplete(false); setTab('sell'); }} className="mt-5 px-6 py-3 rounded-xl bg-purple text-white font-bold text-sm hover:bg-purple/80 transition-all">🎫 {t('vend_buy_go_sell')}</button>
          </div>
        )}

        {/* ═══ INVENTORY TAB ═══ */}
        {tab === 'inventory' && (
          <div>
            <h2 className="font-heading text-xl tracking-wide mb-4">{t('vend_inv_title')}</h2>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-dark-card border border-border rounded-card p-3 text-center">
                <p className="text-[9px] text-gray-muted uppercase">{t('vend_inv_bought')}</p>
                <p className="font-heading text-2xl">{totalStock}</p>
              </div>
              <div className="bg-dark-card border border-border rounded-card p-3 text-center">
                <p className="text-[9px] text-gray-muted uppercase">{t('sold')}</p>
                <p className="font-heading text-2xl text-green">{totalSold}</p>
              </div>
              <div className="bg-dark-card border border-border rounded-card p-3 text-center">
                <p className="text-[9px] text-gray-muted uppercase">{t('remaining')}</p>
                <p className="font-heading text-2xl">{totalRemaining}</p>
              </div>
            </div>

            <div className="space-y-3">
              {OWNED.map((s, i) => {
                const rem = s.qty - s.sold;
                const pct = s.qty > 0 ? Math.round((s.sold / s.qty) * 100) : 0;
                return (
                  <div key={i} className="bg-dark-card border border-border rounded-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{s.eventEmoji}</span>
                        <div>
                          <p className="text-xs font-bold">{s.eventName}</p>
                          <p className="text-[10px] text-gray-muted">📅 {byLocale(s.eventDate)} · {L('Achte','Bought','Acheté')} {byLocale(s.purchaseDate)}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold border" style={{color:s.sectionColor, borderColor:s.sectionColor, background:s.sectionColor+'15'}}>{s.section}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-center">
                      <div><p className="text-[9px] text-gray-muted">{L('Achte','Bought','Acheté')}</p><p className="text-sm font-bold">{s.qty}</p></div>
                      <div><p className="text-[9px] text-gray-muted">{t('sold')}</p><p className="text-sm font-bold text-green">{s.sold}</p></div>
                      <div><p className="text-[9px] text-gray-muted">{t('remaining')}</p><p className={`text-sm font-bold ${rem <= 5 && rem > 0 ? 'text-orange' : ''}`}>{rem}{rem <= 5 && rem > 0 ? ' ⚠️' : ''}</p></div>
                      <div><p className="text-[9px] text-gray-muted">{t('vend_sell_cost')}</p><p className="text-sm font-bold">${s.costEach}</p></div>
                      <div><p className="text-[9px] text-gray-muted">{t('vend_inv_invested')}</p><p className="text-sm font-bold">${s.totalCost}</p></div>
                    </div>
                    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mt-2.5"><div className="h-full bg-purple rounded-full" style={{width:`${pct}%`}} /></div>
                    <p className="text-[9px] text-gray-muted text-right mt-1">{pct}% {L('vann','sold','vendu')}</p>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setTab('buy')} className="w-full mt-4 py-3 rounded-xl border-2 border-dashed border-purple text-purple text-sm font-bold hover:bg-purple-dim transition-all">🛒 {t('vend_inv_buy_more')}</button>
          </div>
        )}

        {/* ═══ SALES TAB ═══ */}
        {tab === 'sales' && (
          <div>
            <h2 className="font-heading text-xl tracking-wide mb-4">{t('vend_sales_title')}</h2>
            <div className="bg-dark-card border border-border rounded-card p-4 mb-5">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div><p className="text-[9px] text-gray-muted uppercase">{t('vend_dash_sales')}</p><p className="font-heading text-2xl">{RECENT_SALES.reduce((a,s)=>a+s.qty,0)}</p></div>
                <div><p className="text-[9px] text-gray-muted uppercase">{t('revenue')}</p><p className="font-heading text-2xl">${totalSalesRevenue}</p></div>
                <div><p className="text-[9px] text-gray-muted uppercase">{t('vend_sales_cost')}</p><p className="font-heading text-2xl text-gray-light">${totalSalesCost}</p></div>
                <div><p className="text-[9px] text-green uppercase">{t('profit')}</p><p className="font-heading text-2xl text-green">${totalProfit}</p></div>
              </div>
            </div>
            <div className="space-y-2">
              {RECENT_SALES.map((s, i) => {
                const profit = s.qty * (s.sellPrice - s.costPrice);
                return (
                  <div key={i} className="bg-dark-card border border-border rounded-card p-3 flex items-center gap-3">
                    <span className="text-[10px] text-gray-muted w-10 flex-shrink-0">{s.time}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{s.event}</p>
                      <p className="text-[10px] text-gray-light">{s.qty}× <span style={{color:s.sectionColor}}>{s.section}</span> · {s.buyer} · {s.phone}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold">${s.qty * s.sellPrice}</p>
                      <p className="text-[9px] text-green font-bold">+${profit} {L('pwofi','profit','profit')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

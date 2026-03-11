'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import {
  getVendorByUid,
  getVendorPurchases,
  getOrganizerEvents,
  getEventBulkPricing,
  vendorBulkPurchase,
  vendorSellTicket,
  VendorData,
  VendorPurchase,
  EventData,
  ResellerSectionPricing,
} from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────
interface BulkTier { minQty: number; maxQty: number | null; priceEach: number; }

interface VendorSale {
  id?: string;
  ticketCode: string;
  eventName: string;
  section: string;
  sectionColor: string;
  qty: number;
  sellPriceEach: number;
  costPriceEach: number;
  buyerName: string;
  buyerPhone: string;
  soldAt: any;
}

type Tab = 'sell' | 'buy' | 'inventory' | 'sales';

const fmtTier = (t: BulkTier) => t.maxQty ? `${t.minQty}–${t.maxQty}` : `${t.minQty}+`;
const getBulkPrice = (tiers: BulkTier[], qty: number) => {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (qty >= tiers[i].minQty) return tiers[i].priceEach;
  }
  return tiers[0]?.priceEach || 0;
};

// ══════════════════════════════════════════════════════════════════
export default function VendorDashboardPage() {
  const router = useRouter();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  // ─── State ───────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('sell');
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [owned, setOwned] = useState<VendorPurchase[]>([]);
  const [sales, setSales] = useState<VendorSale[]>([]);
  const [availableEvents, setAvailableEvents] = useState<(EventData & { pricing: ResellerSectionPricing[] })[]>([]);

  // Sell state
  const [sellStockIdx, setSellStockIdx] = useState(0);
  const [sellQty, setSellQty] = useState(1);
  const [sellPrice, setSellPrice] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [showSellConfirm, setShowSellConfirm] = useState(false);
  const [sellSuccess, setSellSuccess] = useState(false);
  const [sellCodes, setSellCodes] = useState<string[]>([]);
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState('');

  // Buy state
  const [buyEventIdx, setBuyEventIdx] = useState(0);
  const [buySectionIdx, setBuySectionIdx] = useState(0);
  const [buyQty, setBuyQty] = useState(10);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState('');

  // ─── Load data ───────────────────────────────────────────────────
  const loadData = useCallback(async (uid: string) => {
    try {
      const v = await getVendorByUid(uid);
      if (!v || !v.id) { router.push('/vendor/auth'); return; }
      setVendor(v);

      // Load owned stock
      const purchases = await getVendorPurchases(v.id);
      setOwned(purchases);

      // Load sales history
      const salesQ = query(
        collection(db, 'vendorSales'),
        where('vendorId', '==', v.id),
        orderBy('soldAt', 'desc')
      );
      try {
        const salesSnap = await getDocs(salesQ);
        setSales(salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorSale)));
      } catch { /* index not yet created, skip */ }

      // Load organizer events with bulk pricing
      if (v.organizerId) {
        const events = await getOrganizerEvents(v.organizerId);
        const eventsWithPricing = await Promise.all(
          events
            .filter(e => e.status === 'published' )
            .map(async (e) => {
              const pricing = await getEventBulkPricing(e.id!);
              return { ...e, pricing: pricing.filter(p => p.bulkTiers && p.bulkTiers.length > 0) };
            })
        );
        setAvailableEvents(eventsWithPricing.filter(e => e.pricing.length > 0));
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      if (!u) { router.push('/vendor/auth'); return; }
      loadData(u.uid);
    });
    return () => unsub();
  }, [loadData, router]);

  // ─── Derived ─────────────────────────────────────────────────────
  const totalStock = owned.reduce((a, b) => a + b.qty, 0);
  const totalSold = owned.reduce((a, b) => a + b.sold, 0);
  const totalRemaining = totalStock - totalSold;
  const totalInvested = owned.reduce((a, b) => a + b.totalPaid, 0);
  const totalRevenue = sales.reduce((a, s) => a + s.qty * s.sellPriceEach, 0);
  const totalCost = sales.reduce((a, s) => a + s.qty * s.costPriceEach, 0);
  const totalProfit = totalRevenue - totalCost;

  const currentStock = owned[sellStockIdx];
  const remaining = currentStock ? currentStock.qty - currentStock.sold : 0;
  const suggestedPrice = currentStock ? Math.round(currentStock.priceEach * 1.2) : 0;
  const actualSellPrice = Number(sellPrice) || suggestedPrice;
  const saleTotal = sellQty * actualSellPrice;
  const saleProfit = sellQty * (actualSellPrice - (currentStock?.priceEach || 0));

  const selectedEvent = availableEvents[buyEventIdx];
  const selectedSection = selectedEvent?.pricing[buySectionIdx];
  const bulkPrice = selectedSection ? getBulkPrice(selectedSection.bulkTiers, buyQty) : 0;
  const buyTotal = buyQty * bulkPrice;

  // ─── Actions ─────────────────────────────────────────────────────
  async function handleConfirmSell() {
    if (!currentStock?.id || !vendor?.id) return;
    setSellLoading(true);
    setSellError('');
    try {
      const codes = await vendorSellTicket({
        purchaseId: currentStock.id,
        eventId: currentStock.eventId,
        buyerName,
        buyerPhone,
        qty: sellQty,
      });
      setSellCodes(codes);
      setSellSuccess(true);
      setShowSellConfirm(false);
      // Refresh stock
      const updated = await getVendorPurchases(vendor.id);
      setOwned(updated);
      // Re-fetch sales
      const salesQ = query(
        collection(db, 'vendorSales'),
        where('vendorId', '==', vendor.id),
        orderBy('soldAt', 'desc')
      );
      try {
        const salesSnap = await getDocs(salesQ);
        setSales(salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorSale)));
      } catch { /* index not ready */ }
    } catch (e: any) {
      setSellError(e.message || L('Erè. Eseye ankò.', 'Error. Try again.', 'Erreur. Réessayez.'));
    } finally {
      setSellLoading(false);
    }
  }

  async function handleConfirmBuy() {
    if (!vendor?.id || !selectedEvent?.id || !selectedSection) return;
    setBuyLoading(true);
    setBuyError('');
    try {
      await vendorBulkPurchase({
        vendorId: vendor.id,
        vendorName: vendor.name,
        organizerId: vendor.organizerId,
        eventId: selectedEvent.id!,
        eventName: selectedEvent.name,
        eventEmoji: '🎫',
        eventDate: selectedEvent.startDate,
        section: selectedSection.section,
        sectionColor: selectedSection.sectionColor,
        qty: buyQty,
        priceEach: bulkPrice,
      });
      setBuySuccess(true);
      setShowBuyConfirm(false);
      // Refresh stock
      const updated = await getVendorPurchases(vendor.id);
      setOwned(updated);
    } catch (e: any) {
      setBuyError(e.message || L('Erè. Eseye ankò.', 'Error. Try again.', 'Erreur. Réessayez.'));
    } finally {
      setBuyLoading(false);
    }
  }

  function resetSell() {
    setSellSuccess(false); setSellCodes([]); setSellQty(1); setSellPrice('');
    setBuyerName(''); setBuyerPhone(''); setSellError('');
  }
  function resetBuy() {
    setBuySuccess(false); setBuyQty(10); setBuyError('');
  }

  // ─── Loading ─────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #a855f7', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'sell', icon: '🎫', label: L('Vann', 'Sell', 'Vendre') },
    { id: 'buy', icon: '🛒', label: L('Achte', 'Buy', 'Acheter') },
    { id: 'inventory', icon: '📦', label: L('Envantè', 'Inventory', 'Inventaire') },
    { id: 'sales', icon: '📋', label: L('Istwa', 'History', 'Historique') },
  ];

  const card: React.CSSProperties = { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16 };
  const btn = (color: string): React.CSSProperties => ({
    padding: '12px 20px', borderRadius: 10, border: 'none', background: color,
    color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%',
  });
  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #1e1e2e',
    background: '#0a0a0f', color: '#fff', fontSize: 13, boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e', padding: '0 16px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', height: 52, gap: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2 }}>ANBYANS</span>
          <div style={{ width: 1, height: 20, background: '#1e1e2e' }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{vendor?.name || 'VANDE'}</span>
          <span style={{ background: '#a855f722', color: '#a855f7', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>
            🏪 {L('REVANDÈ', 'RESELLER', 'VENDEUR')}
          </span>
          <button onClick={() => auth.signOut().then(() => router.push('/vendor/auth'))}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer' }}>🚪</button>
        </div>
      </nav>

      {/* TABS */}
      <div style={{ position: 'sticky', top: 52, zIndex: 40, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); resetSell(); resetBuy(); setShowSellConfirm(false); setShowBuyConfirm(false); }}
              style={{
                flex: 1, padding: '14px 0', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, color: tab === t.id ? '#a855f7' : '#555',
                borderBottom: `2px solid ${tab === t.id ? '#a855f7' : 'transparent'}`,
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px' }}>

        {/* ══════════ SELL TAB ══════════ */}
        {tab === 'sell' && !showSellConfirm && !sellSuccess && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{L('Vann Tikè', 'Sell Tickets', 'Vendre des Billets')}</h2>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
              {[
                { label: L('Envantè', 'Stock', 'Stock'), value: totalRemaining, color: '#fff' },
                { label: L('Vann', 'Sold', 'Vendus'), value: totalSold, color: '#22c55e' },
                { label: L('Revni', 'Revenue', 'Revenu'), value: `$${totalRevenue}`, color: '#fff' },
                { label: L('Pwofi', 'Profit', 'Profit'), value: `$${totalProfit}`, color: '#22c55e' },
              ].map(s => (
                <div key={s.label} style={{ ...card, textAlign: 'center', padding: 12 }}>
                  <p style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* No stock */}
            {owned.filter(s => s.qty - s.sold > 0).length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>📦</p>
                <p style={{ color: '#888', marginBottom: 16 }}>{L('Pa gen tikè nan envantè ou.', 'No tickets in your inventory.', 'Aucun billet en inventaire.')}</p>
                <button onClick={() => setTab('buy')} style={{ ...btn('#a855f7'), width: 'auto', padding: '10px 24px' }}>
                  🛒 {L('Achte tikè bulk', 'Buy bulk tickets', 'Acheter des billets en gros')}
                </button>
              </div>
            )}

            {/* Sell form */}
            {owned.filter(s => s.qty - s.sold > 0).length > 0 && (
              <div style={{ ...card, borderColor: '#a855f733' }}>
                {/* Pick stock */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                    {L('Chwazi tikè ou vle vann', 'Select tickets to sell', 'Sélectionner les billets')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {owned.map((s, i) => {
                      const rem = s.qty - s.sold;
                      if (rem <= 0) return null;
                      return (
                        <button key={i} onClick={() => { setSellStockIdx(i); setSellQty(1); setSellPrice(''); }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 14px', borderRadius: 10,
                            border: `1px solid ${sellStockIdx === i ? '#a855f7' : '#1e1e2e'}`,
                            background: sellStockIdx === i ? '#a855f715' : 'transparent',
                            cursor: 'pointer', textAlign: 'left',
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 24 }}>{s.eventEmoji}</span>
                            <div>
                              <p style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{s.eventName}</p>
                              <p style={{ color: '#666', fontSize: 10 }}>📅 {s.eventDate} · <span style={{ color: s.sectionColor }}>{s.section}</span></p>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{rem} {L('rete', 'left', 'restants')}</p>
                            <p style={{ color: '#555', fontSize: 10 }}>${s.priceEach}/{L('tikè', 'ticket', 'billet')}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Qty + Price */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <p style={{ color: '#888', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{L('Kantite', 'Quantity', 'Quantité')}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setSellQty(Math.max(1, sellQty - 1))}
                        style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #1e1e2e', background: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>−</button>
                      <span style={{ fontSize: 28, fontWeight: 800, minWidth: 40, textAlign: 'center' }}>{sellQty}</span>
                      <button onClick={() => setSellQty(Math.min(remaining, sellQty + 1))}
                        style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #1e1e2e', background: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                  <div>
                    <p style={{ color: '#888', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{L('Pri vant', 'Sell price', 'Prix de vente')}</p>
                    <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                      placeholder={`$${suggestedPrice}`} style={inp} />
                    <p style={{ color: '#555', fontSize: 10, marginTop: 4 }}>
                      {L('Ou te peye', 'You paid', 'Vous avez payé')} ${currentStock?.priceEach}/{L('tikè', 'ticket', 'billet')}
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div><p style={{ color: '#666', fontSize: 10 }}>{L('Total', 'Total', 'Total')}</p><p style={{ fontSize: 24, fontWeight: 800 }}>${saleTotal}</p></div>
                  <div style={{ textAlign: 'right' }}><p style={{ color: '#666', fontSize: 10 }}>{L('Pwofi', 'Profit', 'Profit')}</p>
                    <p style={{ fontSize: 24, fontWeight: 800, color: saleProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                      {saleProfit >= 0 ? '+' : ''}${saleProfit}
                    </p>
                  </div>
                </div>

                {/* Buyer */}
                <div style={{ borderTop: '1px solid #1e1e2e', paddingTop: 16, marginBottom: 16 }}>
                  <p style={{ color: '#a855f7', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                    {L('Enfòmasyon Kliyan', 'Customer Info', 'Informations Client')}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 4 }}>{L('Non *', 'Name *', 'Nom *')}</label>
                      <input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder={L('Non konplè', 'Full name', 'Nom complet')} style={inp} />
                    </div>
                    <div>
                      <label style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 4 }}>WhatsApp *</label>
                      <input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} placeholder="+509 XXXX XXXX" style={inp} />
                    </div>
                  </div>
                </div>

                {sellError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{sellError}</p>}

                <button onClick={() => { if (!buyerName || !buyerPhone) { setSellError(L('Ranpli non ak telefòn kliyan an.', 'Fill in customer name and phone.', 'Remplissez nom et téléphone.')); return; } setSellError(''); setShowSellConfirm(true); }}
                  disabled={remaining === 0}
                  style={{ ...btn('#a855f7'), opacity: remaining === 0 ? 0.4 : 1 }}>
                  🎫 {L('Vann', 'Sell', 'Vendre')} {sellQty} {L('tikè', 'ticket(s)', 'billet(s)')} — ${saleTotal}
                </button>
                <p style={{ color: '#555', fontSize: 10, textAlign: 'center', marginTop: 6 }}>
                  {L('Tikè ap voye bay kliyan an via WhatsApp', 'Ticket sent to customer via WhatsApp', 'Billet envoyé au client via WhatsApp')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* SELL CONFIRM */}
        {tab === 'sell' && showSellConfirm && (
          <div style={{ ...card, borderColor: '#a855f733', textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🎫</p>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{L('Konfime Vant', 'Confirm Sale', 'Confirmer la vente')}</h3>
            <div style={{ ...card, textAlign: 'left', maxWidth: 320, margin: '0 auto 20px', padding: 14 }}>
              {[
                [L('Evènman', 'Event', 'Événement'), currentStock?.eventName],
                [L('Seksyon', 'Section', 'Section'), currentStock?.section],
                [L('Kantite', 'Qty', 'Quantité'), sellQty],
                [L('Pri/tikè', 'Price/ticket', 'Prix/billet'), `$${actualSellPrice}`],
                [L('Kliyan', 'Customer', 'Client'), buyerName],
                ['WhatsApp', buyerPhone],
                [L('Total', 'Total', 'Total'), `$${saleTotal}`],
                [L('Pwofi ou', 'Your profit', 'Votre profit'), `+$${saleProfit}`],
              ].map(([k, v]) => (
                <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e1e2e', fontSize: 12 }}>
                  <span style={{ color: '#666' }}>{k}</span>
                  <span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            {sellError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{sellError}</p>}
            <div style={{ display: 'flex', gap: 10, maxWidth: 320, margin: '0 auto' }}>
              <button onClick={() => setShowSellConfirm(false)} style={{ ...btn('#1e1e2e'), flex: 1 }}>
                ← {L('Retounen', 'Back', 'Retour')}
              </button>
              <button onClick={handleConfirmSell} disabled={sellLoading} style={{ ...btn('#22c55e'), flex: 1, opacity: sellLoading ? 0.6 : 1 }}>
                {sellLoading ? '...' : `✓ ${L('Konfime', 'Confirm', 'Confirmer')}`}
              </button>
            </div>
          </div>
        )}

        {/* SELL SUCCESS */}
        {tab === 'sell' && sellSuccess && (
          <div style={{ ...card, borderColor: '#22c55e', textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 56, marginBottom: 12 }}>✅</p>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: '#22c55e', marginBottom: 8 }}>
              {L('Vant reyisi!', 'Sale complete!', 'Vente réussie !')}
            </h3>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>
              {L('Tikè voye bay', 'Ticket sent to', 'Billet envoyé à')} <strong style={{ color: '#fff' }}>{buyerPhone}</strong>
            </p>
            {sellCodes.length > 0 && (
              <div style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: 12, margin: '12px auto', maxWidth: 300 }}>
                <p style={{ color: '#555', fontSize: 10, marginBottom: 6 }}>Kòd tikè</p>
                {sellCodes.map(c => <p key={c} style={{ fontFamily: 'monospace', fontSize: 13, color: '#22c55e' }}>{c}</p>)}
              </div>
            )}
            <p style={{ color: '#22c55e', fontWeight: 700, fontSize: 16, marginTop: 8 }}>+${saleProfit} {L('pwofi', 'profit', 'profit')}</p>
            <button onClick={resetSell} style={{ ...btn('#a855f7'), width: 'auto', padding: '10px 24px', marginTop: 16 }}>
              🎫 {L('Vann ankò', 'Sell more', 'Vendre encore')}
            </button>
          </div>
        )}

        {/* ══════════ BUY TAB ══════════ */}
        {tab === 'buy' && !showBuyConfirm && !buySuccess && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{L('Achte Tikè Bulk', 'Buy Bulk Tickets', 'Achat en Gros')}</h2>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 20 }}>
              {L('Achte tikè an gwo pou pri redwi, epi vann yo pou pwofi.', 'Buy tickets in bulk at reduced prices and resell for profit.', 'Achetez en gros à prix réduit, revendez avec profit.')}
            </p>

            {availableEvents.length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>🎪</p>
                <p style={{ color: '#888' }}>{L('Pa gen evènman disponib pou vann kounye a.', 'No events available for resale right now.', 'Aucun événement disponible pour la revente.')}</p>
                <p style={{ color: '#555', fontSize: 11, marginTop: 8 }}>
                  {L('Mande òganizatè a aktive vant bulk.', 'Ask the organizer to enable bulk pricing.', "Demandez à l'organisateur d'activer la vente en gros.")}
                </p>
              </div>
            )}

            {availableEvents.length > 0 && (
              <>
                {/* Event picker */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                    {L('Evènman', 'Event', 'Événement')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {availableEvents.map((ev, i) => (
                      <button key={ev.id} onClick={() => { setBuyEventIdx(i); setBuySectionIdx(0); setBuyQty(ev.pricing[0]?.bulkTiers[0]?.minQty || 10); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10,
                          border: `1px solid ${buyEventIdx === i ? '#a855f7' : '#1e1e2e'}`,
                          background: buyEventIdx === i ? '#a855f715' : 'transparent', cursor: 'pointer', textAlign: 'left',
                        }}>
                        <span style={{ fontSize: 24 }}>{ev.imageUrl}</span>
                        <div>
                          <p style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{ev.name}</p>
                          <p style={{ color: '#666', fontSize: 10 }}>📅 {ev.startDate}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section picker */}
                {selectedEvent && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                      {L('Seksyon', 'Section', 'Section')}
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {selectedEvent.pricing.map((sec, i) => (
                        <button key={i} onClick={() => { setBuySectionIdx(i); setBuyQty(sec.bulkTiers[0]?.minQty || 10); }}
                          style={{
                            flex: 1, padding: 10, borderRadius: 10, textAlign: 'center',
                            border: `1px solid ${buySectionIdx === i ? '#a855f7' : '#1e1e2e'}`,
                            background: buySectionIdx === i ? '#a855f715' : 'transparent', cursor: 'pointer',
                          }}>
                          <span style={{ color: sec.sectionColor, fontWeight: 700, fontSize: 13 }}>{sec.section}</span>
                          <p style={{ color: '#666', fontSize: 10, marginTop: 2 }}>Online: ${sec.onlinePrice}</p>
                          <p style={{ color: '#555', fontSize: 10 }}>{sec.available} {L('disponib', 'available', 'disponibles')}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bulk pricing table */}
                {selectedSection && (
                  <div style={{ ...card, marginBottom: 16 }}>
                    <p style={{ color: '#f97316', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
                      💲 {L('Pri Bulk', 'Bulk Pricing', 'Tarifs en gros')} — {selectedSection.section}
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1e1e2e' }}>
                          {[L('Kantite', 'Quantity', 'Quantité'), L('Pri Chak', 'Each', 'Unitaire'), L('Rabè', 'Discount', 'Rabais')].map(h => (
                            <th key={h} style={{ textAlign: h === L('Pri Chak', 'Each', 'Unitaire') ? 'right' : h === L('Rabè', 'Discount', 'Rabais') ? 'right' : 'left', color: '#555', fontSize: 9, textTransform: 'uppercase', paddingBottom: 8 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSection.bulkTiers.map((tier: BulkTier, i: number) => {
                          const disc = Math.round(((selectedSection.onlinePrice - tier.priceEach) / selectedSection.onlinePrice) * 100);
                          const active = buyQty >= tier.minQty && (tier.maxQty === null || buyQty <= tier.maxQty);
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #1e1e2e', background: active ? '#a855f715' : 'transparent' }}>
                              <td style={{ padding: '8px 0', fontSize: 12, color: active ? '#a855f7' : '#fff', fontWeight: active ? 700 : 400 }}>
                                {fmtTier(tier)} {L('tikè', 'tickets', 'billets')} {active && '← ou'}
                              </td>
                              <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 700 }}>${tier.priceEach}</td>
                              <td style={{ textAlign: 'right', color: '#22c55e', fontSize: 12, fontWeight: 700 }}>-{disc}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Qty */}
                {selectedSection && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ color: '#888', fontSize: 11, fontWeight: 700, marginBottom: 10 }}>{L('Kantite', 'Quantity', 'Quantité')}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {[-5, -1].map(d => (
                        <button key={d} onClick={() => setBuyQty(Math.max(1, buyQty + d))}
                          style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #1e1e2e', background: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{d}</button>
                      ))}
                      <span style={{ fontSize: 32, fontWeight: 800, minWidth: 60, textAlign: 'center' }}>{buyQty}</span>
                      {[1, 5].map(d => (
                        <button key={d} onClick={() => setBuyQty(Math.min(selectedSection.available, buyQty + d))}
                          style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #1e1e2e', background: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+{d}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                {selectedSection && (
                  <div style={{ background: '#a855f715', border: '1px solid #a855f733', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <p style={{ color: '#888', fontSize: 10 }}>{L('Pri bulk', 'Bulk price', 'Prix en gros')}</p>
                      <p style={{ fontSize: 13 }}>${bulkPrice} × {buyQty} {L('tikè', 'tickets', 'billets')}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: '#888', fontSize: 10 }}>{L('Ou peye', 'You pay', 'Vous payez')}</p>
                      <p style={{ fontSize: 28, fontWeight: 800 }}>${buyTotal.toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {buyError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{buyError}</p>}

                <button onClick={() => setShowBuyConfirm(true)}
                  disabled={!selectedSection || buyQty < (selectedSection?.bulkTiers[0]?.minQty || 1)}
                  style={{ ...btn('#a855f7'), opacity: (!selectedSection || buyQty < (selectedSection?.bulkTiers[0]?.minQty || 1)) ? 0.4 : 1 }}>
                  🛒 {L('Achte', 'Buy', 'Acheter')} {buyQty} {L('tikè', 'tickets', 'billets')} — ${buyTotal.toLocaleString()}
                </button>
              </>
            )}
          </div>
        )}

        {/* BUY CONFIRM */}
        {tab === 'buy' && showBuyConfirm && !buySuccess && (
          <div style={{ ...card, borderColor: '#a855f733', textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🛒</p>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{L('Konfime Acha', 'Confirm Purchase', 'Confirmer l\'achat')}</h3>
            <div style={{ ...card, textAlign: 'left', maxWidth: 320, margin: '0 auto 20px', padding: 14 }}>
              {[
                [L('Evènman', 'Event', 'Événement'), selectedEvent?.name],
                [L('Seksyon', 'Section', 'Section'), selectedSection?.section],
                [L('Kantite', 'Qty', 'Quantité'), `${buyQty} ${L('tikè', 'tickets', 'billets')}`],
                [L('Pri bulk', 'Bulk price', 'Prix en gros'), `$${bulkPrice} ${L('chak', 'each', 'chacun')}`],
                [L('Total', 'Total', 'Total'), `$${buyTotal.toLocaleString()}`],
              ].map(([k, v]) => (
                <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e1e2e', fontSize: 12 }}>
                  <span style={{ color: '#666' }}>{k}</span><span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 14 }}>{L('Chwazi metòd peman:', 'Choose payment method:', 'Choisissez le mode de paiement :')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 360, margin: '0 auto 16px' }}>
              {['📱 MonCash', '💚 Natcash', '💳 Card', '⚡ Zelle', '💲 Cash App', '🅿️ PayPal'].map(m => (
                <button key={m} onClick={handleConfirmBuy} disabled={buyLoading}
                  style={{ padding: '10px 6px', borderRadius: 10, border: '1px solid #1e1e2e', background: 'none', color: '#ccc', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {m}
                </button>
              ))}
            </div>
            {buyError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{buyError}</p>}
            <button onClick={() => setShowBuyConfirm(false)} style={{ color: '#555', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
              ← {L('Retounen', 'Back', 'Retour')}
            </button>
          </div>
        )}

        {/* BUY SUCCESS */}
        {tab === 'buy' && buySuccess && (
          <div style={{ ...card, borderColor: '#22c55e', textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 56, marginBottom: 12 }}>✅</p>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: '#22c55e', marginBottom: 8 }}>{L('Achte reyisi!', 'Purchase complete!', 'Achat réussi !')}</h3>
            <p style={{ color: '#888', fontSize: 13 }}>
              <strong>{buyQty}</strong> {L('tikè', 'tickets', 'billets')} <span style={{ color: selectedSection?.sectionColor }}>{selectedSection?.section}</span> {L('pou', 'for', 'pour')} <strong>{selectedEvent?.name}</strong>
            </p>
            <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>{L('ajoute nan envantè ou. Kòmanse vann kounye a!', 'added to your inventory. Start selling now!', 'ajoutés à votre inventaire. Commencez à vendre !')}</p>
            <button onClick={() => { resetBuy(); setTab('sell'); }} style={{ ...btn('#a855f7'), width: 'auto', padding: '10px 24px', marginTop: 16 }}>
              🎫 {L('Ale vann', 'Go sell', 'Aller vendre')}
            </button>
          </div>
        )}

        {/* ══════════ INVENTORY TAB ══════════ */}
        {tab === 'inventory' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{L('Envantè', 'Inventory', 'Inventaire')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {[
                { label: L('Achte', 'Bought', 'Achetés'), value: totalStock },
                { label: L('Vann', 'Sold', 'Vendus'), value: totalSold, color: '#22c55e' },
                { label: L('Rete', 'Remaining', 'Restants'), value: totalRemaining },
                { label: L('Envesti', 'Invested', 'Investi'), value: `$${totalInvested}` },
                { label: L('Revni', 'Revenue', 'Revenu'), value: `$${totalRevenue}` },
                { label: L('Pwofi', 'Profit', 'Profit'), value: `$${totalProfit}`, color: '#22c55e' },
              ].map(s => (
                <div key={s.label} style={{ ...card, textAlign: 'center', padding: 12 }}>
                  <p style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: s.color || '#fff' }}>{s.value}</p>
                </div>
              ))}
            </div>

            {owned.length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 40, marginBottom: 10 }}>📦</p>
                <p style={{ color: '#888' }}>{L('Envantè vid.', 'Empty inventory.', 'Inventaire vide.')}</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {owned.map((s, i) => {
                const rem = s.qty - s.sold;
                const pct = s.qty > 0 ? Math.round((s.sold / s.qty) * 100) : 0;
                return (
                  <div key={i} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ fontSize: 24 }}>{s.eventEmoji}</span>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 13 }}>{s.eventName}</p>
                          <p style={{ color: '#666', fontSize: 11 }}>📅 {s.eventDate} · {L('Achte', 'Bought', 'Acheté')} {s.purchaseDate}</p>
                        </div>
                      </div>
                      <span style={{ color: s.sectionColor, border: `1px solid ${s.sectionColor}`, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{s.section}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, textAlign: 'center', marginBottom: 10 }}>
                      {[
                        { l: L('Achte', 'Bought', 'Achetés'), v: s.qty },
                        { l: L('Vann', 'Sold', 'Vendus'), v: s.sold, c: '#22c55e' },
                        { l: L('Rete', 'Left', 'Restants'), v: rem, c: rem <= 5 && rem > 0 ? '#f97316' : '#fff' },
                        { l: L('Pri', 'Cost', 'Coût'), v: `$${s.priceEach}` },
                        { l: L('Envesti', 'Invested', 'Investi'), v: `$${s.totalPaid}` },
                      ].map(x => (
                        <div key={x.l}><p style={{ color: '#555', fontSize: 9, marginBottom: 2 }}>{x.l}</p><p style={{ fontWeight: 700, fontSize: 13, color: x.c || '#fff' }}>{x.v}{rem <= 5 && rem > 0 && x.l === L('Rete', 'Left', 'Restants') ? ' ⚠️' : ''}</p></div>
                      ))}
                    </div>
                    <div style={{ height: 6, background: '#1e1e2e', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#a855f7', borderRadius: 3 }} />
                    </div>
                    <p style={{ color: '#555', fontSize: 10, textAlign: 'right', marginTop: 4 }}>{pct}% {L('vann', 'sold', 'vendu')}</p>
                  </div>
                );
              })}
            </div>

            <button onClick={() => setTab('buy')} style={{ ...btn('transparent'), border: '2px dashed #a855f7', color: '#a855f7', marginTop: 12 }}>
              🛒 {L('Achte plis tikè', 'Buy more tickets', 'Acheter plus de billets')}
            </button>
          </div>
        )}

        {/* ══════════ SALES HISTORY TAB ══════════ */}
        {tab === 'sales' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{L('Istwa Vant', 'Sales History', 'Historique des Ventes')}</h2>

            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
                {[
                  { l: L('Vant', 'Sales', 'Ventes'), v: sales.reduce((a, s) => a + s.qty, 0) },
                  { l: L('Revni', 'Revenue', 'Revenu'), v: `$${totalRevenue}` },
                  { l: L('Depans', 'Cost', 'Coût'), v: `$${totalCost}` },
                  { l: L('Pwofi', 'Profit', 'Profit'), v: `$${totalProfit}`, c: '#22c55e' },
                ].map(s => (
                  <div key={s.l}><p style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>{s.l}</p><p style={{ fontSize: 18, fontWeight: 800, color: s.c || '#fff' }}>{s.v}</p></div>
                ))}
              </div>
            </div>

            {sales.length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 40, marginBottom: 10 }}>📋</p>
                <p style={{ color: '#888' }}>{L('Okenn vant poko fèt.', 'No sales yet.', 'Aucune vente pour l\'instant.')}</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sales.map((s, i) => {
                const profit = s.qty * (s.sellPriceEach - s.costPriceEach);
                return (
                  <div key={i} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 12 }}>{s.eventName}</p>
                      <p style={{ color: '#666', fontSize: 11 }}>
                        {s.qty}× <span style={{ color: s.sectionColor }}>{s.section}</span> · {s.buyerName} · {s.buyerPhone}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13 }}>${s.qty * s.sellPriceEach}</p>
                      <p style={{ color: '#22c55e', fontSize: 10, fontWeight: 700 }}>+${profit} {L('pwofi', 'profit', 'profit')}</p>
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

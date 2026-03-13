'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/i18n';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  getVendorByUid,
  getEvent,
  getEventBulkPricing,
  getPublishedEvents,
  getVendorRequests,
  requestVendorAccess,
  vendorBulkPurchase,
  vendorSellTicket,
  type VendorData,
  type VendorPurchase,
  type VendorRequest,
  type EventData,
  type ResellerSectionPricing,
} from '@/lib/db';

interface CalTier { label: string; openDate: string; closeDate: string; priceEach: number; }
interface BulkTier { minQty: number; maxQty: number | null; priceEach: number; }
interface VendorSale {
  id?: string; ticketCode: string; eventName: string; section: string;
  sectionColor: string; qty: number; sellPriceEach: number; costPriceEach: number;
  buyerName: string; buyerPhone: string; soldAt: unknown;
}
type ApprovedEvent = EventData & { pricing: ResellerSectionPricing[] };
type Tab = 'events' | 'sell' | 'buy' | 'inventory' | 'sales';

const getBulkPrice = (tiers: BulkTier[], qty: number) => {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (qty >= tiers[i].minQty) return tiers[i].priceEach;
  }
  return tiers[0]?.priceEach ?? 0;
};

export default function VendorDashboardPage() {
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  const [tab, setTab] = useState<Tab>('events');
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [noVendorDoc, setNoVendorDoc] = useState(false);
  const [owned, setOwned] = useState<VendorPurchase[]>([]);
  const [sales, setSales] = useState<VendorSale[]>([]);
  const [approvedEvents, setApprovedEvents] = useState<ApprovedEvent[]>([]);
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [vendorRequests, setVendorRequests] = useState<VendorRequest[]>([]);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

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

  const [buyEventIdx, setBuyEventIdx] = useState(0);
  const [buySectionIdx, setBuySectionIdx] = useState(0);
  const [buyQty, setBuyQty] = useState(10);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;

    const loadData = async (uid: string) => {
      try {
        const v = await getVendorByUid(uid);
        if (cancelled) return;

        if (!v?.id) {
          setNoVendorDoc(true);
          setLoading(false);
          return;
        }

        setVendor(v);

        try {
          const pSnap = await getDocs(query(collection(db, 'vendorPurchases'), where('vendorId', '==', v.id)));
          if (!cancelled) {
            setOwned(
              pSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPurchase))
                .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
            );
          }
        } catch (e) { console.warn('purchases', e); }

        try {
          const sSnap = await getDocs(query(collection(db, 'vendorSales'), where('vendorId', '==', v.id)));
          if (!cancelled) setSales(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorSale)));
        } catch (e) { console.warn('sales', e); }

        try {
          const pub = await getPublishedEvents();
          if (!cancelled) setAllEvents(pub.filter(ev => (ev.startDate ?? '') >= today));
        } catch (e) { console.warn('allEvents', e); }

        if (v.id) {
          try {
            const reqs = await getVendorRequests(v.id);
            if (!cancelled) setVendorRequests(reqs);

            const approvedReqs = reqs.filter(r => r.status === 'approved');
            if (approvedReqs.length > 0) {
              const results = await Promise.all(
                approvedReqs.map(async r => {
                  try {
                    const [ev, pricing] = await Promise.all([getEvent(r.eventId), getEventBulkPricing(r.eventId)]);
                    if (!ev) return null;
                    return { ...ev, pricing } as ApprovedEvent;
                  } catch { return null; }
                })
              );
              if (!cancelled) setApprovedEvents(results.filter((e): e is ApprovedEvent => e !== null));
            }
          } catch (e) { console.warn('vendorRequests', e); }
        }
      } catch (e) {
        console.error('loadData', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const unsub = auth.onAuthStateChanged(u => {
      unsub();
      if (u) { loadData(u.uid); }
      else { window.location.href = '/vendor/auth'; }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalStock     = owned.reduce((a, b) => a + b.qty, 0);
  const totalSold      = owned.reduce((a, b) => a + b.sold, 0);
  const totalRemaining = totalStock - totalSold;
  const totalInvested  = owned.reduce((a, b) => a + b.totalPaid, 0);
  const totalRevenue   = sales.reduce((a, s) => a + s.qty * s.sellPriceEach, 0);
  const totalCost      = sales.reduce((a, s) => a + s.qty * s.costPriceEach, 0);
  const totalProfit    = totalRevenue - totalCost;

  const currentStock    = owned[sellStockIdx];
  const remaining       = currentStock ? currentStock.qty - currentStock.sold : 0;
  const suggestedPrice  = currentStock ? Math.round(currentStock.priceEach * 1.2) : 0;
  const actualSellPrice = Number(sellPrice) || suggestedPrice;
  const saleTotal       = sellQty * actualSellPrice;
  const saleProfit      = sellQty * (actualSellPrice - (currentStock?.priceEach ?? 0));

  const selectedEvent   = approvedEvents[buyEventIdx];
  const selectedSection = selectedEvent?.pricing[buySectionIdx];
  const calTiers        = ((selectedSection as unknown as { calendarTiers?: CalTier[] })?.calendarTiers ?? []) as CalTier[];
  const activeCalTier   = calTiers.find(t => today >= t.openDate && today <= t.closeDate);
  const bulkPrice       = activeCalTier
    ? activeCalTier.priceEach
    : selectedSection ? getBulkPrice(((selectedSection as unknown as { bulkTiers?: BulkTier[] }).bulkTiers ?? []), buyQty) : 0;
  const buyWindowOpen   = calTiers.length === 0 || !!activeCalTier;
  const buyTotal        = buyQty * bulkPrice;

  const refreshStock = async (vendorId: string) => {
    try {
      const pSnap = await getDocs(query(collection(db, 'vendorPurchases'), where('vendorId', '==', vendorId)));
      setOwned(
        pSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPurchase))
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      );
    } catch (e) { console.warn('refresh', e); }
  };

  async function handleConfirmSell() {
    if (!currentStock?.id || !vendor?.id) return;
    setSellLoading(true); setSellError('');
    try {
      const result = await vendorSellTicket({ purchaseId: currentStock.id, eventId: currentStock.eventId, buyerName, buyerPhone, qty: sellQty });
      const r = Array.isArray(result) ? { codes: result, pin: '' } : result;
      setSellCodes(r.codes);
      const ticketUrl = `${window.location.origin}/ticket/${r.codes[0]}`;
      const msg = [
        '🎫 *ANBYANS - TIKÈ OU PARE!*', '',
        `🎭 ${currentStock.eventName}`,
        `📅 ${currentStock.eventDate} · 🎟️ Seksyon: ${currentStock.section}`, '',
        ...r.codes.map((c, i) => `🔑 Tikè ${i + 1}: ${c}`),
        r.pin ? `🔐 PIN: ${r.pin}` : '',
        '', `📱 Wè tikè ou: ${ticketUrl}`, '',
        '⚠️ Kenbe PIN ou an sekirite.',
        '🛡️ Tikè sa voye dirèkteman pa Anbyans — pa vandè a.',
      ].filter(Boolean).join('\n');
      const phone = buyerPhone.replace(/[^0-9]/g, '');
      window.open(phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      setSellSuccess(true); setShowSellConfirm(false);
      await refreshStock(vendor.id);
    } catch (e: unknown) {
      setSellError(e instanceof Error ? e.message : 'Erè.');
    } finally { setSellLoading(false); }
  }

  async function handleConfirmBuy() {
    if (!vendor?.id || !selectedEvent?.id || !selectedSection) return;
    setBuyLoading(true); setBuyError('');
    try {
      await vendorBulkPurchase({
        vendorId: vendor.id, vendorName: vendor.name,
        organizerId: selectedEvent.organizerId ?? '',
        eventId: selectedEvent.id!, eventName: selectedEvent.name ?? '',
        eventEmoji: selectedEvent.emoji ?? '🎫', eventDate: selectedEvent.startDate ?? '',
        section: selectedSection.section, sectionColor: selectedSection.sectionColor,
        qty: buyQty, priceEach: bulkPrice,
      });
      setBuySuccess(true); setShowBuyConfirm(false);
      await refreshStock(vendor.id);
    } catch (e: unknown) {
      setBuyError(e instanceof Error ? e.message : 'Erè.');
    } finally { setBuyLoading(false); }
  }

  const resetSell = () => { setSellSuccess(false); setSellCodes([]); setSellQty(1); setSellPrice(''); setBuyerName(''); setBuyerPhone(''); setSellError(''); };
  const resetBuy  = () => { setBuySuccess(false); setBuyQty(10); setBuyError(''); };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #a855f7', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (noVendorDoc) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <p style={{ fontSize: 48 }}>⏳</p>
      <p style={{ color: '#fff', fontWeight: 800, fontSize: 20, textAlign: 'center' }}>
        {L('Kont ou an atant apwobasyon', 'Account pending approval', "Compte en attente d'approbation")}
      </p>
      <p style={{ color: '#666', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
        {L('Ou poko asosye ak yon òganizatè. Demann aksè sou evènman ki entèrese ou.', "You're not yet linked to an organizer. Request access on events that interest you.", "Vous n'êtes pas encore associé à un organisateur.")}
      </p>
      <button onClick={() => auth.signOut().then(() => { window.location.href = '/vendor/auth'; })}
        style={{ marginTop: 8, padding: '10px 28px', borderRadius: 8, border: 'none', background: '#1e1e2e', color: '#888', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
        🚪 {L('Dekonekte', 'Sign out', 'Déconnexion')}
      </button>
    </div>
  );

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'events',    icon: '🎪', label: L('Evènman', 'Events', 'Événements') },
    { id: 'sell',      icon: '🎫', label: L('Vann', 'Sell', 'Vendre') },
    { id: 'buy',       icon: '🛒', label: L('Achte', 'Buy', 'Acheter') },
    { id: 'inventory', icon: '📦', label: L('Envantè', 'Inventory', 'Inventaire') },
    { id: 'sales',     icon: '📋', label: L('Istwa', 'History', 'Historique') },
  ];
  const card: React.CSSProperties = { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16 };
  const btn  = (color: string): React.CSSProperties => ({ padding: '12px 20px', borderRadius: 10, border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%' });
  const inp: React.CSSProperties  = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e', padding: '0 16px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', height: 52, gap: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2 }}>ANBYANS</span>
          <div style={{ width: 1, height: 20, background: '#1e1e2e' }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{vendor?.name ?? 'VANDE'}</span>
          <span style={{ background: '#a855f722', color: '#a855f7', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>🏪 {L('REVANDÈ', 'RESELLER', 'VENDEUR')}</span>
          <button onClick={() => auth.signOut().then(() => { window.location.href = '/vendor/auth'; })}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer' }}>🚪</button>
        </div>
      </nav>

      <div style={{ position: 'sticky', top: 52, zIndex: 40, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex' }}>
          {TABS.map(t => (
            <button key={t.id}
              onClick={() => { setTab(t.id); resetSell(); resetBuy(); setShowSellConfirm(false); setShowBuyConfirm(false); }}
              style={{ flex: 1, padding: '14px 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: tab === t.id ? '#a855f7' : '#555', borderBottom: `2px solid ${tab === t.id ? '#a855f7' : 'transparent'}` }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px' }}>

        {/* EVENTS TAB */}
        {tab === 'events' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{L('Evènman', 'Events', 'Événements')}</h2>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 20 }}>
              {L('Chwazi evènman ou vle travay. Demann aksè — òganizatè a ap konfime ou.',
                'Choose events you want to work. Request access — the organizer will confirm you.',
                "Choisissez les événements. Demandez l'accès — l'organisateur vous confirmera.")}
            </p>

            {allEvents.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
                <p style={{ color: '#888' }}>{L('Pa gen evènman piblik disponib.', 'No public events available.', 'Aucun événement public disponible.')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {allEvents.map(ev => {
                  const req        = vendorRequests.find(r => r.eventId === ev.id);
                  const myEv       = approvedEvents.find(ae => ae.id === ev.id);
                  const isApproved = req?.status === 'approved';
                  const isPending  = req?.status === 'pending';
                  const isDenied   = req?.status === 'denied';
                  const hasBulk    = isApproved && !!myEv?.pricing?.length;

                  const StatusBadge = () => {
                    if (isApproved) return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#22c55e22', color: '#22c55e' }}>✓ {L('APWOUVE', 'APPROVED', 'APPROUVÉ')}</span>;
                    if (isPending)  return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#f9731622', color: '#f97316' }}>⏳ {L('AN ATANT', 'PENDING', 'EN ATTENTE')}</span>;
                    if (isDenied)   return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#ef444422', color: '#ef4444' }}>✕ {L('REFIZE', 'DENIED', 'REFUSÉ')}</span>;
                    return null;
                  };

                  return (
                    <div key={ev.id} style={{ ...card, borderColor: isApproved ? '#22c55e33' : isPending ? '#f9731633' : '#1e1e2e' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                        <span style={{ fontSize: 32, flexShrink: 0 }}>{ev.emoji ?? '🎪'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                            <p style={{ fontWeight: 800, fontSize: 14, margin: 0 }}>{ev.name}</p>
                            <StatusBadge />
                          </div>
                          <p style={{ color: '#888', fontSize: 11, margin: 0 }}>
                            📅 {ev.startDate}{ev.venue ? ` · 📍 ${ev.venue}` : ''}{ev.city ? ` · ${ev.city}` : ''}
                          </p>
                        </div>
                      </div>

                      {isApproved && hasBulk && myEv && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                          {myEv.pricing.map((sec, si) => {
                            const secCal     = ((sec as unknown as { calendarTiers?: CalTier[] }).calendarTiers ?? []) as CalTier[];
                            const activeTier = secCal.find(t => today >= t.openDate && today <= t.closeDate);
                            const nextTier   = secCal.find(t => today < t.openDate);
                            const activePrice = activeTier?.priceEach ?? (sec as unknown as { activePrice?: number }).activePrice;
                            const isOpen     = !!activeTier || secCal.length === 0;
                            const discount   = activePrice && sec.onlinePrice ? Math.round(((sec.onlinePrice - activePrice) / sec.onlinePrice) * 100) : 0;
                            return (
                              <div key={si} style={{ background: '#0a0a0f', border: `1px solid ${isOpen ? sec.sectionColor + '44' : '#1e1e2e'}`, borderRadius: 10, padding: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: sec.sectionColor, display: 'inline-block' }} />
                                    <span style={{ fontWeight: 700, fontSize: 13 }}>{sec.section}</span>
                                    <span style={{ color: '#555', fontSize: 11 }}>{sec.available} {L('disponib', 'avail', 'dispo')}</span>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <span style={{ color: '#888', fontSize: 10, textDecoration: 'line-through', marginRight: 6 }}>${sec.onlinePrice}</span>
                                    {isOpen && activePrice
                                      ? <><span style={{ color: '#22c55e', fontWeight: 800, fontSize: 15 }}>${activePrice}</span>{discount > 0 && <span style={{ color: '#22c55e', fontSize: 10, marginLeft: 4 }}>-{discount}%</span>}</>
                                      : <span style={{ color: '#ef4444', fontSize: 11 }}>🔒 {L('Fèmen', 'Closed', 'Fermé')}</span>}
                                  </div>
                                </div>
                                {secCal.length > 0 && (
                                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                                    {secCal.map((t, ti) => {
                                      const isAct = today >= t.openDate && today <= t.closeDate;
                                      const isPast = today > t.closeDate;
                                      return (
                                        <span key={ti} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: isAct ? '#a855f722' : isPast ? '#1e1e2e' : '#0a0a0f', color: isAct ? '#a855f7' : isPast ? '#444' : '#666', border: `1px solid ${isAct ? '#a855f744' : '#1e1e2e'}`, textDecoration: isPast ? 'line-through' : 'none' }}>
                                          {t.label} ${t.priceEach}{isAct ? ' ← kounye a' : isPast ? ' ✓' : ` (${t.openDate})`}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {!activeTier && nextTier && (
                                  <p style={{ color: '#f97316', fontSize: 10, marginBottom: 6 }}>
                                    ⏳ {L('Pwochen:', 'Next:', 'Prochain :')} {nextTier.label} ${nextTier.priceEach} — {L('ouvè', 'opens', 'ouvre')} {nextTier.openDate}
                                  </p>
                                )}
                                {isOpen && activePrice && sec.available > 0 && (
                                  <button
                                    onClick={() => {
                                      const idx = approvedEvents.findIndex(ae => ae.id === ev.id);
                                      setBuyEventIdx(idx >= 0 ? idx : 0);
                                      setBuySectionIdx(si);
                                      setBuyQty(10);
                                      setTab('buy');
                                    }}
                                    style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: '#a855f7', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                    🛒 {L('Achte bulk', 'Buy bulk', 'Achat en gros')} — ${activePrice}/{L('tikè', 'ticket', 'billet')}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {isApproved && !hasBulk && (
                        <div style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                          <p style={{ color: '#888', fontSize: 12, margin: 0 }}>
                            ⏳ {L("Apwouve! Òganizatè a poko fikse pri bulk.", "Approved! Organizer hasn't set bulk pricing yet.", "Approuvé ! L'organisateur n'a pas encore fixé les tarifs.")}
                          </p>
                        </div>
                      )}

                      {isPending && (
                        <div style={{ background: '#f9731610', border: '1px solid #f9731633', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                          <p style={{ color: '#f97316', fontSize: 12, margin: 0 }}>
                            ⏳ {L("Demann ou voye. Òganizatè a ap revize li.", "Request sent. The organizer is reviewing it.", "Demande envoyée. L'organisateur l'examine.")}
                          </p>
                        </div>
                      )}

                      {isDenied && (
                        <div style={{ background: '#ef444410', border: '1px solid #ef444433', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                          <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>
                            ✕ {L("Demann ou pa aksepte. Kontakte òganizatè a dirèkteman.", "Request was not accepted. Contact the organizer directly.", "Demande non acceptée. Contactez l'organisateur directement.")}
                          </p>
                        </div>
                      )}

                      {!req && (
                        <div>
                          {requestError?.startsWith(ev.id!) && (
                            <p style={{ color: '#ef4444', fontSize: 11, marginBottom: 6, textAlign: 'center', wordBreak: 'break-word' }}>
                              ⚠️ {requestError.split('::')[1] || L('Erè — Eseye ankò', 'Error — Try again', 'Erreur — Réessayez')}
                            </p>
                          )}
                          <button
                            disabled={requesting === ev.id}
                            onClick={async () => {
                              if (!vendor?.id) return;
                              setRequesting(ev.id!);
                              setRequestError(null);
                              try {
                                const newReq = await requestVendorAccess({
                                  vendorId: vendor.id!, vendorName: vendor.name, vendorPhone: vendor.phone, vendorCity: vendor.city,
                                  eventId: ev.id!, eventName: ev.name ?? '', eventEmoji: ev.emoji ?? '🎪',
                                  eventDate: ev.startDate ?? '', organizerId: ev.organizerId ?? '',
                                });
                                setVendorRequests(prev => [...prev, newReq]);
                              } catch (e: unknown) {
                                console.error('requestVendorAccess error:', e);
                                const msg = e instanceof Error ? e.message : String(e);
                                setRequestError(ev.id! + '::' + msg);
                              }
                              finally { setRequesting(null); }
                            }}
                            style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: `2px solid ${requestError?.startsWith(ev.id!) ? '#ef4444' : '#a855f7'}`, background: 'transparent', color: requestError?.startsWith(ev.id!) ? '#ef4444' : '#a855f7', fontSize: 13, fontWeight: 700, cursor: requesting === ev.id ? 'not-allowed' : 'pointer', opacity: requesting === ev.id ? 0.6 : 1 }}>
                            {requesting === ev.id ? `⏳ ${L('Ap voye...', 'Sending...', 'Envoi...')}` : `🙋 ${L('Mande travay evènman sa a', 'Request to work this event', 'Demander à travailler cet événement')}`}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SELL TAB */}
        {tab === 'sell' && !showSellConfirm && !sellSuccess && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{L('Vann Tikè', 'Sell Tickets', 'Vendre des Billets')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
              {[
                { label: L('Envantè','Stock','Stock'),     value: totalRemaining },
                { label: L('Vann','Sold','Vendus'),        value: totalSold,         color: '#22c55e' },
                { label: L('Revni','Revenue','Revenu'),    value: `$${totalRevenue}` },
                { label: L('Pwofi','Profit','Profit'),     value: `$${totalProfit}`,  color: '#22c55e' },
              ].map(s => (
                <div key={s.label} style={{ ...card, textAlign: 'center', padding: 12 }}>
                  <p style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: s.color ?? '#fff' }}>{s.value}</p>
                </div>
              ))}
            </div>

            {owned.filter(s => s.qty - s.sold > 0).length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>📦</p>
                <p style={{ color: '#888', marginBottom: 16 }}>{L('Pa gen tikè nan envantè ou.', 'No tickets in your inventory.', 'Aucun billet en inventaire.')}</p>
                <button onClick={() => setTab('buy')} style={{ ...btn('#a855f7'), width: 'auto', padding: '10px 24px' }}>🛒 {L('Achte tikè bulk', 'Buy bulk tickets', 'Acheter des billets en gros')}</button>
              </div>
            ) : (
              <div style={{ ...card, borderColor: '#a855f733' }}>
                <p style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{L('Chwazi tikè ou vle vann', 'Select tickets to sell', 'Sélectionner les billets')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {owned.map((s, i) => {
                    const rem = s.qty - s.sold;
                    if (rem <= 0) return null;
                    return (
                      <button key={i} onClick={() => { setSellStockIdx(i); setSellQty(1); setSellPrice(''); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, border: `1px solid ${sellStockIdx === i ? '#a855f7' : '#1e1e2e'}`, background: sellStockIdx === i ? '#a855f715' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <p style={{ color: '#888', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{L('Kantite', 'Quantity', 'Quantité')}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setSellQty(Math.max(1, sellQty - 1))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #1e1e2e', background: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>−</button>
                      <span style={{ fontSize: 28, fontWeight: 800, minWidth: 40, textAlign: 'center' }}>{sellQty}</span>
                      <button onClick={() => setSellQty(Math.min(remaining, sellQty + 1))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #1e1e2e', background: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                  <div>
                    <p style={{ color: '#888', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{L('Pri vant', 'Sell price', 'Prix de vente')}</p>
                    <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder={`$${suggestedPrice}`} style={inp} />
                    <p style={{ color: '#555', fontSize: 10, marginTop: 4 }}>{L('Ou te peye', 'You paid', 'Vous avez payé')} ${currentStock?.priceEach}/{L('tikè', 'ticket', 'billet')}</p>
                  </div>
                </div>

                <div style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div><p style={{ color: '#666', fontSize: 10 }}>Total</p><p style={{ fontSize: 24, fontWeight: 800 }}>${saleTotal}</p></div>
                  <div style={{ textAlign: 'right' }}><p style={{ color: '#666', fontSize: 10 }}>{L('Pwofi', 'Profit', 'Profit')}</p><p style={{ fontSize: 24, fontWeight: 800, color: saleProfit >= 0 ? '#22c55e' : '#ef4444' }}>{saleProfit >= 0 ? '+' : ''}${saleProfit}</p></div>
                </div>

                <div style={{ borderTop: '1px solid #1e1e2e', paddingTop: 16, marginBottom: 16 }}>
                  <p style={{ color: '#a855f7', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{L('Enfòmasyon Kliyan', 'Customer Info', 'Informations Client')}</p>
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
                <button
                  onClick={() => {
                    if (!buyerName || !buyerPhone) { setSellError(L('Ranpli non ak telefòn kliyan an.', 'Fill in customer name and phone.', 'Remplissez nom et téléphone.')); return; }
                    setSellError(''); setShowSellConfirm(true);
                  }}
                  disabled={remaining === 0}
                  style={{ ...btn('#a855f7'), opacity: remaining === 0 ? 0.4 : 1 }}>
                  🎫 {L('Vann', 'Sell', 'Vendre')} {sellQty} {L('tikè', 'ticket(s)', 'billet(s)')} — ${saleTotal}
                </button>
                <p style={{ color: '#555', fontSize: 10, textAlign: 'center', marginTop: 6 }}>{L('Tikè ap voye bay kliyan an via WhatsApp', 'Ticket sent to customer via WhatsApp', 'Billet envoyé au client via WhatsApp')}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'sell' && showSellConfirm && (
          <div style={{ ...card, borderColor: '#a855f733', textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🎫</p>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{L('Konfime Vant', 'Confirm Sale', 'Confirmer la vente')}</h3>
            <div style={{ ...card, textAlign: 'left', maxWidth: 320, margin: '0 auto 20px', padding: 14 }}>
              {([
                [L('Evènman','Event','Événement'), currentStock?.eventName],
                [L('Seksyon','Section','Section'), currentStock?.section],
                [L('Kantite','Qty','Quantité'), sellQty],
                [L('Pri/tikè','Price/ticket','Prix/billet'), `$${actualSellPrice}`],
                [L('Kliyan','Customer','Client'), buyerName],
                ['WhatsApp', buyerPhone],
                [L('Total','Total','Total'), `$${saleTotal}`],
                [L('Pwofi ou','Your profit','Votre profit'), `+$${saleProfit}`],
              ] as [string, unknown][]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e1e2e', fontSize: 12 }}>
                  <span style={{ color: '#666' }}>{k}</span><span style={{ fontWeight: 700 }}>{String(v)}</span>
                </div>
              ))}
            </div>
            {sellError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{sellError}</p>}
            <div style={{ display: 'flex', gap: 10, maxWidth: 320, margin: '0 auto' }}>
              <button onClick={() => setShowSellConfirm(false)} style={{ ...btn('#1e1e2e'), flex: 1 }}>← {L('Retounen', 'Back', 'Retour')}</button>
              <button onClick={handleConfirmSell} disabled={sellLoading} style={{ ...btn('#22c55e'), flex: 1, opacity: sellLoading ? 0.6 : 1 }}>{sellLoading ? '...' : `✓ ${L('Konfime', 'Confirm', 'Confirmer')}`}</button>
            </div>
          </div>
        )}

        {tab === 'sell' && sellSuccess && (
          <div style={{ ...card, borderColor: '#22c55e', textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 56, marginBottom: 12 }}>✅</p>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: '#22c55e', marginBottom: 8 }}>{L('Vant reyisi!', 'Sale complete!', 'Vente réussie !')}</h3>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>{L('Tikè voye bay', 'Ticket sent to', 'Billet envoyé à')} <strong style={{ color: '#fff' }}>{buyerPhone}</strong></p>
            {sellCodes.length > 0 && (
              <div style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: 12, margin: '12px auto', maxWidth: 300 }}>
                <p style={{ color: '#555', fontSize: 10, marginBottom: 6 }}>Kòd tikè</p>
                {sellCodes.map(c => <p key={c} style={{ fontFamily: 'monospace', fontSize: 13, color: '#22c55e' }}>{c}</p>)}
              </div>
            )}
            <p style={{ color: '#22c55e', fontWeight: 700, fontSize: 16, marginTop: 8 }}>+${saleProfit} {L('pwofi', 'profit', 'profit')}</p>
            <button onClick={resetSell} style={{ ...btn('#a855f7'), width: 'auto', padding: '10px 24px', marginTop: 16 }}>🎫 {L('Vann ankò', 'Sell more', 'Vendre encore')}</button>
          </div>
        )}

        {/* BUY TAB */}
        {tab === 'buy' && !showBuyConfirm && !buySuccess && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{L('Achte Tikè Bulk', 'Buy Bulk Tickets', 'Achat en Gros')}</h2>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 20 }}>{L('Achte tikè an gwo pou pri redwi, epi vann yo pou pwofi.', 'Buy tickets in bulk at reduced prices and resell for profit.', 'Achetez en gros à prix réduit, revendez avec profit.')}</p>

            {approvedEvents.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>🎪</p>
                <p style={{ color: '#888' }}>{L('Pa gen evènman disponib pou bulk kounye a.', 'No events available for bulk purchase yet.', 'Aucun événement disponible pour achat en gros.')}</p>
                <p style={{ color: '#555', fontSize: 11, marginTop: 8 }}>{L('Demann aksè sou paj Evènman an.', 'Request access from the Events tab.', "Demandez l'accès depuis l'onglet Événements.")}</p>
                <button onClick={() => setTab('events')} style={{ ...btn('#a855f7'), width: 'auto', padding: '10px 24px', marginTop: 16 }}>🎪 {L('Ale nan Evènman', 'Go to Events', 'Aller aux Événements')}</button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{L('Evènman', 'Event', 'Événement')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {approvedEvents.map((ev, i) => (
                      <button key={ev.id} onClick={() => { setBuyEventIdx(i); setBuySectionIdx(0); setBuyQty(10); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: `1px solid ${buyEventIdx === i ? '#a855f7' : '#1e1e2e'}`, background: buyEventIdx === i ? '#a855f715' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontSize: 24 }}>{ev.emoji ?? '🎫'}</span>
                        <div>
                          <p style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{ev.name}</p>
                          <p style={{ color: '#666', fontSize: 10 }}>📅 {ev.startDate}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedEvent && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{L('Seksyon', 'Section', 'Section')}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {selectedEvent.pricing.map((sec, i) => (
                        <button key={i} onClick={() => { setBuySectionIdx(i); setBuyQty(10); }}
                          style={{ flex: 1, padding: 10, borderRadius: 10, textAlign: 'center', border: `1px solid ${buySectionIdx === i ? '#a855f7' : '#1e1e2e'}`, background: buySectionIdx === i ? '#a855f715' : 'transparent', cursor: 'pointer' }}>
                          <span style={{ color: sec.sectionColor, fontWeight: 700, fontSize: 13 }}>{sec.section}</span>
                          <p style={{ color: '#666', fontSize: 10, marginTop: 2 }}>Online: ${sec.onlinePrice}</p>
                          <p style={{ color: '#555', fontSize: 10 }}>{sec.available} {L('disponib', 'available', 'disponibles')}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSection && (() => {
                  const secCal    = ((selectedSection as unknown as { calendarTiers?: CalTier[] }).calendarTiers ?? []) as CalTier[];
                  const activeCal = secCal.find(t => today >= t.openDate && today <= t.closeDate);
                  return (
                    <div style={{ ...card, marginBottom: 16 }}>
                      <p style={{ color: '#a855f7', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>📅 {L('Pri pa Dat', 'Calendar Pricing', 'Tarifs par date')} — {selectedSection.section}</p>
                      {secCal.length > 0 ? (
                        <>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #1e1e2e' }}>
                                {['Fenèt', L('Dat','Dates','Dates'), L('Pri','Price','Prix'), L('Rabè','Discount','Rabais')].map(h => (
                                  <th key={h} style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', paddingBottom: 8, textAlign: 'left' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {secCal.map((t, i) => {
                                const disc     = Math.round(((selectedSection.onlinePrice - t.priceEach) / selectedSection.onlinePrice) * 100);
                                const isActive = today >= t.openDate && today <= t.closeDate;
                                const isPast   = today > t.closeDate;
                                return (
                                  <tr key={i} style={{ borderBottom: '1px solid #1e1e2e', background: isActive ? '#a855f715' : 'transparent', opacity: isPast ? 0.4 : 1 }}>
                                    <td style={{ padding: '8px 0', fontSize: 12, fontWeight: isActive ? 700 : 400, color: isActive ? '#a855f7' : '#fff' }}>
                                      {t.label} {isActive && '← now'} {today < t.openDate && '🔒'} {isPast && '✓'}
                                    </td>
                                    <td style={{ fontSize: 10, color: '#888' }}>{t.openDate} → {t.closeDate}</td>
                                    <td style={{ fontSize: 14, fontWeight: 700 }}>${t.priceEach}</td>
                                    <td style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>-{disc}%</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {activeCal
                            ? <div style={{ background: '#a855f715', border: '1px solid #a855f733', borderRadius: 6, padding: '6px 10px', marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ color: '#a855f7', fontSize: 11, fontWeight: 700 }}>✓ {activeCal.label} — ${activeCal.priceEach}/{L('tikè','ticket','billet')}</p>
                                <p style={{ color: '#666', fontSize: 10 }}>{L('Fèmen','Closes','Ferme')} {activeCal.closeDate}</p>
                              </div>
                            : <div style={{ background: '#ef444415', border: '1px solid #ef444433', borderRadius: 6, padding: '6px 10px', marginTop: 10 }}>
                                <p style={{ color: '#ef4444', fontSize: 11 }}>⚠️ {L('Pa gen fenèt ouvert kounye a.','No pricing window open now.','Aucune fenêtre ouverte.')}</p>
                              </div>
                          }
                        </>
                      ) : (
                        <p style={{ color: '#555', fontSize: 12 }}>{L('Pa gen kalandriye pri.','No calendar pricing set.','Pas de tarification calendaire.')}</p>
                      )}
                    </div>
                  );
                })()}

                {selectedSection && (
                  <>
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

                    <div style={{ background: '#a855f715', border: '1px solid #a855f733', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div>
                        <p style={{ color: '#888', fontSize: 10 }}>{L('Pri bulk','Bulk price','Prix en gros')}</p>
                        <p style={{ fontSize: 13 }}>${bulkPrice} × {buyQty} {L('tikè','tickets','billets')}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#888', fontSize: 10 }}>{L('Ou peye','You pay','Vous payez')}</p>
                        <p style={{ fontSize: 28, fontWeight: 800 }}>${buyTotal.toLocaleString()}</p>
                      </div>
                    </div>

                    {buyError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{buyError}</p>}
                    <button onClick={() => setShowBuyConfirm(true)} disabled={!buyWindowOpen || buyQty < 1}
                      style={{ ...btn('#a855f7'), opacity: (!buyWindowOpen || buyQty < 1) ? 0.4 : 1 }}>
                      🛒 {L('Achte','Buy','Acheter')} {buyQty} {L('tikè','tickets','billets')} — ${buyTotal.toLocaleString()}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'buy' && showBuyConfirm && !buySuccess && (
          <div style={{ ...card, borderColor: '#a855f733', textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🛒</p>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{L('Konfime Acha', 'Confirm Purchase', "Confirmer l'achat")}</h3>
            <div style={{ ...card, textAlign: 'left', maxWidth: 320, margin: '0 auto 20px', padding: 14 }}>
              {([
                [L('Evènman','Event','Événement'), selectedEvent?.name],
                [L('Seksyon','Section','Section'), selectedSection?.section],
                [L('Kantite','Qty','Quantité'), `${buyQty} ${L('tikè','tickets','billets')}`],
                [L('Pri bulk','Bulk price','Prix en gros'), `$${bulkPrice} ${L('chak','each','chacun')}`],
                [L('Total','Total','Total'), `$${buyTotal.toLocaleString()}`],
              ] as [string, unknown][]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e1e2e', fontSize: 12 }}>
                  <span style={{ color: '#666' }}>{k}</span><span style={{ fontWeight: 700 }}>{String(v)}</span>
                </div>
              ))}
            </div>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 14 }}>{L('Chwazi metòd peman:', 'Choose payment method:', 'Choisissez le mode de paiement :')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 360, margin: '0 auto 16px' }}>
              {['📱 MonCash', '💚 Natcash', '⚡ Zelle', '💲 Cash App', '🅿️ PayPal'].map(m => (
                <button key={m} onClick={handleConfirmBuy} disabled={buyLoading}
                  style={{ padding: '10px 6px', borderRadius: 10, border: '1px solid #1e1e2e', background: 'none', color: '#ccc', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{m}</button>
              ))}
              {(vendor as VendorData & { trusted?: boolean })?.trusted && (
                <button onClick={handleConfirmBuy} disabled={buyLoading}
                  style={{ padding: '10px 6px', borderRadius: 10, border: '1px solid #22c55e', background: '#22c55e15', color: '#22c55e', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  💳 {L('Kat Kredi','Credit Card','Carte')}
                  <span style={{ display: 'block', fontSize: 8, color: '#22c55e99', marginTop: 2 }}>✓ Trusted</span>
                </button>
              )}
            </div>
            {buyError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{buyError}</p>}
            <button onClick={() => setShowBuyConfirm(false)} style={{ color: '#555', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>← {L('Retounen', 'Back', 'Retour')}</button>
          </div>
        )}

        {tab === 'buy' && buySuccess && (
          <div style={{ ...card, borderColor: '#22c55e', textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 56, marginBottom: 12 }}>✅</p>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: '#22c55e', marginBottom: 8 }}>{L('Achte reyisi!', 'Purchase complete!', 'Achat réussi !')}</h3>
            <p style={{ color: '#888', fontSize: 13 }}>
              <strong>{buyQty}</strong> {L('tikè','tickets','billets')} <span style={{ color: selectedSection?.sectionColor }}>{selectedSection?.section}</span> {L('pou','for','pour')} <strong>{selectedEvent?.name}</strong>
            </p>
            <button onClick={() => { resetBuy(); setTab('sell'); }} style={{ ...btn('#a855f7'), width: 'auto', padding: '10px 24px', marginTop: 16 }}>🎫 {L('Ale vann', 'Go sell', 'Aller vendre')}</button>
          </div>
        )}

        {/* INVENTORY TAB */}
        {tab === 'inventory' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{L('Envantè', 'Inventory', 'Inventaire')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {[
                { label: L('Achte','Bought','Achetés'),     value: totalStock },
                { label: L('Vann','Sold','Vendus'),          value: totalSold,       color: '#22c55e' },
                { label: L('Rete','Remaining','Restants'),   value: totalRemaining },
                { label: L('Envesti','Invested','Investi'),  value: `$${totalInvested}` },
                { label: L('Revni','Revenue','Revenu'),      value: `$${totalRevenue}` },
                { label: L('Pwofi','Profit','Profit'),       value: `$${totalProfit}`, color: '#22c55e' },
              ].map(s => (
                <div key={s.label} style={{ ...card, textAlign: 'center', padding: 12 }}>
                  <p style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: s.color ?? '#fff' }}>{s.value}</p>
                </div>
              ))}
            </div>

            {owned.length === 0
              ? <div style={{ ...card, textAlign: 'center', padding: 40 }}><p style={{ fontSize: 40, marginBottom: 10 }}>📦</p><p style={{ color: '#888' }}>{L('Envantè vid.','Empty inventory.','Inventaire vide.')}</p></div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {owned.map((s, i) => {
                    const rem = s.qty - s.sold;
                    const pct = s.qty > 0 ? Math.round((s.sold / s.qty) * 100) : 0;
                    return (
                      <div key={i} style={card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <span style={{ fontSize: 24 }}>{s.eventEmoji}</span>
                            <div><p style={{ fontWeight: 700, fontSize: 13 }}>{s.eventName}</p><p style={{ color: '#666', fontSize: 11 }}>📅 {s.eventDate}</p></div>
                          </div>
                          <span style={{ color: s.sectionColor, border: `1px solid ${s.sectionColor}`, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{s.section}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, textAlign: 'center', marginBottom: 10 }}>
                          {[
                            { l: L('Achte','Bought','Achetés'), v: s.qty },
                            { l: L('Vann','Sold','Vendus'),     v: s.sold, c: '#22c55e' },
                            { l: L('Rete','Left','Restants'),   v: rem, c: rem <= 5 && rem > 0 ? '#f97316' : undefined },
                            { l: L('Pri','Cost','Coût'),        v: `$${s.priceEach}` },
                            { l: L('Envesti','Invested','Investi'), v: `$${s.totalPaid}` },
                          ].map(x => (
                            <div key={x.l}><p style={{ color: '#555', fontSize: 9, marginBottom: 2 }}>{x.l}</p><p style={{ fontWeight: 700, fontSize: 13, color: x.c ?? '#fff' }}>{x.v}</p></div>
                          ))}
                        </div>
                        <div style={{ height: 6, background: '#1e1e2e', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#a855f7', borderRadius: 3 }} />
                        </div>
                        <p style={{ color: '#555', fontSize: 10, textAlign: 'right', marginTop: 4 }}>{pct}% {L('vann','sold','vendu')}</p>
                      </div>
                    );
                  })}
                </div>
            }
            <button onClick={() => setTab('buy')} style={{ ...btn('transparent'), border: '2px dashed #a855f7', color: '#a855f7', marginTop: 12 }}>
              🛒 {L('Achte plis tikè','Buy more tickets','Acheter plus de billets')}
            </button>
          </div>
        )}

        {/* SALES HISTORY TAB */}
        {tab === 'sales' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{L('Istwa Vant', 'Sales History', 'Historique des Ventes')}</h2>
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
                {[
                  { l: L('Vant','Sales','Ventes'),    v: sales.reduce((a, s) => a + s.qty, 0) },
                  { l: L('Revni','Revenue','Revenu'),  v: `$${totalRevenue}` },
                  { l: L('Depans','Cost','Coût'),      v: `$${totalCost}` },
                  { l: L('Pwofi','Profit','Profit'),   v: `$${totalProfit}`, c: '#22c55e' },
                ].map(s => (
                  <div key={s.l}><p style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>{s.l}</p><p style={{ fontSize: 18, fontWeight: 800, color: s.c ?? '#fff' }}>{s.v}</p></div>
                ))}
              </div>
            </div>

            {sales.length === 0
              ? <div style={{ ...card, textAlign: 'center', padding: 40 }}><p style={{ fontSize: 40, marginBottom: 10 }}>📋</p><p style={{ color: '#888' }}>{L("Okenn vant poko fèt.", "No sales yet.", "Aucune vente pour l'instant.")}</p></div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sales.map((s, i) => {
                    const profit = s.qty * (s.sellPriceEach - s.costPriceEach);
                    return (
                      <div key={i} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 700, fontSize: 12 }}>{s.eventName}</p>
                          <p style={{ color: '#666', fontSize: 11 }}>{s.qty}× <span style={{ color: s.sectionColor }}>{s.section}</span> · {s.buyerName} · {s.buyerPhone}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 13 }}>${s.qty * s.sellPriceEach}</p>
                          <p style={{ color: '#22c55e', fontSize: 10, fontWeight: 700 }}>+${profit} {L('pwofi','profit','profit')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        )}

      </div>
    </div>
  );
}

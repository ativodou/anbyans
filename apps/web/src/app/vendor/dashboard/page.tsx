'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  getVendorByUid,
  getEvent,
  getOrganizerEvents,
  getEventBulkPricing,
  getPublishedEvents,
  getPlatformFeeRate,
  vendorBulkPurchase,
  vendorSellTicket,
  saveVendorDraft,
  loadVendorDraft,
  VendorData,
  VendorPurchase,
  EventData,
  ResellerSectionPricing,
} from '@/lib/db';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface BulkTier { minQty: number; maxQty: number | null; priceEach: number; }
interface CalTier { label: string; openDate: string; closeDate: string; priceEach: number; }

function VendorStripeForm({ onSuccess, onError }: { onSuccess: (piId: string) => void; onError: (msg: string) => void }) {
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
    <div style={{ marginTop: 16 }}>
      <PaymentElement />
      <button onClick={handlePay} disabled={confirming || !stripe}
        style={{ marginTop: 14, width: '100%', padding: 13, borderRadius: 10, border: 'none', background: confirming ? '#2a2a3a' : '#a855f7', color: '#fff', fontWeight: 700, fontSize: 14, cursor: confirming ? 'not-allowed' : 'pointer' }}>
        {confirming ? '...' : '💳 Peye Kounye a'}
      </button>
    </div>
  );
}
function StandFeeStripeForm({ onSuccess, onError }: { onSuccess: (piId: string) => void; onError: (msg: string) => void }) {
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
    <div style={{ marginTop: 16 }}>
      <PaymentElement />
      <button onClick={handlePay} disabled={confirming || !stripe}
        style={{ marginTop: 14, width: '100%', padding: 13, borderRadius: 10, border: 'none', background: confirming ? '#2a2a3a' : '#22c55e', color: '#fff', fontWeight: 700, fontSize: 14, cursor: confirming ? 'not-allowed' : 'pointer' }}>
        {confirming ? '...' : '💳 Peye Frè Stand la'}
      </button>
    </div>
  );
}

type VendorRequestStatus = 'pending' | 'approved' | 'denied';
interface VendorRequest {
  id?: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  vendorCity?: string;
  eventId: string;
  eventName: string;
  eventEmoji?: string;
  eventDate?: string;
  organizerId: string;
  status: VendorRequestStatus;
  createdAt?: any;
  standFee?: number;
  standFeePaid?: boolean;
  standFeePaymentId?: string;
}
interface VendorSale {
  id?: string;
  eventName: string;
  section: string;
  eventId?: string;
  eventDate?: string;
  sectionColor: string; qty: number; sellPriceEach: number; costPriceEach: number;
  buyerName: string; buyerPhone: string; soldAt: any;
}
type Tab = 'sell' | 'buy' | 'inventory' | 'sales' | 'events';

const getBulkPrice = (tiers: BulkTier[], qty: number) => {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (qty >= tiers[i].minQty) return tiers[i].priceEach;
  }
  return tiers[0]?.priceEach || 0;
};
const getVendorRequests = async (vendorId: string): Promise<VendorRequest[]> => {
  const q = query(collection(db, 'vendorRequests'), where('vendorId', '==', vendorId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorRequest));
};

type VendorAccessRequestInput = Omit<VendorRequest, 'id' | 'status' | 'createdAt'> & Partial<Pick<VendorRequest, 'status'>>;

const requestVendorAccess = async (data: VendorAccessRequestInput): Promise<VendorRequest> => {
  const payload = {
    ...data,
    status: data.status ?? 'pending',
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'vendorRequests'), payload);
  return { id: ref.id, ...payload } as VendorRequest;
};

export default function VendorDashboardPage() {
  const { t } = useT();
  const { user, loading: authLoading } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const draftApplied = useRef(false);
  const draftTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const router = useRouter();
  useEffect(() => {
    if (authLoading) return;
    const role = (user as any)?.role;
    if (user && role && role !== 'reseller') router.replace('/');
  }, [user, authLoading, router]);

  const displayName = (user as any)?.firstName
    ? `${(user as any).firstName} ${(user as any).lastName ?? ''}`.trim()
    : user?.email?.split('@')[0] ?? '';
  const initial = displayName.charAt(0).toUpperCase();

  const [tab, setTab] = useState<Tab>('sell');
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [noVendorDoc, setNoVendorDoc] = useState(false); // ← NEW: track missing vendor doc
  const [owned, setOwned] = useState<VendorPurchase[]>([]);
  const [sales, setSales] = useState<VendorSale[]>([]);
  const [approvedEvents, setApprovedEvents] = useState<(EventData & { pricing: ResellerSectionPricing[] })[]>([]);
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [vendorRequests, setVendorRequests] = useState<VendorRequest[]>([]);
  const [requesting, setRequesting] = useState<string | null>(null);

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

  const [standFeeReqId, setStandFeeReqId] = useState<string | null>(null);
  const [standFeeSecret, setStandFeeSecret] = useState<string | null>(null);
  const [standFeeLoading, setStandFeeLoading] = useState(false);
  const [standFeeError, setStandFeeError] = useState('');

  const [buyEventIdx, setBuyEventIdx] = useState(0);
  const [buySectionIdx, setBuySectionIdx] = useState(0);
  const [buyQty, setBuyQty] = useState(10);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [buyClientSecret, setBuyClientSecret] = useState<string | null>(null);
  const [buyOrgStripeId, setBuyOrgStripeId] = useState<string | null>(null);
  const [feeRate, setFeeRate] = useState(0.09);

  // ─── ONE effect, no useCallback, no router in deps ───────────────
  useEffect(() => {
    let cancelled = false;

    const loadData = async (uid: string) => {
      let draft: Record<string, any> | null = null;
      try { draft = await loadVendorDraft(uid); } catch {}
      try {
        let v = await getVendorByUid(uid);
        if (cancelled) return;

        if (!v || !v.id) {
          setNoVendorDoc(true);
          setLoading(false);
          return;
        }

        setVendor(v);

        // purchases — no orderBy to avoid composite index
        try {
          const pSnap = await getDocs(query(
            collection(db, 'vendorPurchases'),
            where('vendorId', '==', v.id)
          ));
          if (!cancelled) {
            const list = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPurchase))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setOwned(list);
          }
        } catch (e) { console.warn('purchases', e); }

        try {
          const sSnap = await getDocs(query(
            collection(db, 'vendorSales'),
            where('vendorId', '==', v.id)
          ));
          if (!cancelled) {
            setSales(sSnap.docs.map(d => ({ id: d.id, ...(d.data() as VendorSale) })));
          }
        } catch (e) { console.warn('sales', e); }

        // approved events — load bulk pricing for each event vendor is approved for
        // (done after vendorRequests load below — reloaded there)

        // all published events for the Events tab
        try {
          const pub = await getPublishedEvents();
          const now = new Date().toISOString().slice(0, 10);
          if (!cancelled) setAllEvents(pub.filter(ev => (ev.startDate || '') >= now));
        } catch (e) { console.warn('allEvents', e); }

        // vendor requests + approved event pricing
        if (v.id) {
          try {
            const reqs = await getVendorRequests(v.id);
            if (!cancelled) setVendorRequests(reqs);
            // load bulk pricing for approved events
            const approvedReqs = reqs.filter(r => r.status === 'approved');
            if (approvedReqs.length > 0) {
              const withPricing = await Promise.all(
                approvedReqs.map(async r => {
                  try {
                    const [ev, pricing] = await Promise.all([
                      getEvent(r.eventId),
                      getEventBulkPricing(r.eventId),
                    ]);
                    if (!ev) return null;
                    return { ...ev, pricing } as EventData & { pricing: ResellerSectionPricing[] };
                  } catch { return null; }
                })
              );
              const filtered = withPricing.filter(Boolean) as (EventData & { pricing: ResellerSectionPricing[] })[];
              if (!cancelled) {
                setApprovedEvents(filtered);
                if (draft && !draftApplied.current) {
                  draftApplied.current = true;
                  if (draft.tab) setTab(draft.tab as Tab);
                  if (draft.buyQty) setBuyQty(Number(draft.buyQty) || 10);
                  if (draft.buyEventId) {
                    const evIdx = filtered.findIndex(e => e.id === draft!.buyEventId);
                    if (evIdx >= 0) {
                      setBuyEventIdx(evIdx);
                      if (draft.buySectionName) {
                        const secIdx = filtered[evIdx]!.pricing.findIndex(s => s.section === draft!.buySectionName);
                        if (secIdx >= 0) setBuySectionIdx(secIdx);
                      }
                    }
                  }
                }
              }
            }
            // Apply tab from draft even if no approved events
            if (!draftApplied.current && draft?.tab) {
              draftApplied.current = true;
              if (!cancelled) setTab(draft.tab as Tab);
            }
          } catch (e) { console.warn('vendorRequests', e); }
        }
      } catch (e) {
        console.error('loadData', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    getPlatformFeeRate().then(setFeeRate);

    const unsub = auth.onAuthStateChanged(u => {
      unsub();
      if (u) { loadData(u.uid); }
      else { window.location.href = '/vendor/auth'; }
    });

    return () => { cancelled = true; unsub(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Real-time listener: vendor request status (approval shows without refresh) ──
  useEffect(() => {
    if (!vendor?.id) return;
    const q = query(collection(db, 'vendorRequests'), where('vendorId', '==', vendor.id));
    const unsub = onSnapshot(q, async (snap) => {
      const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorRequest));
      setVendorRequests(reqs);
      const approvedReqs = reqs.filter(r => r.status === 'approved');
      if (approvedReqs.length > 0) {
        const withPricing = await Promise.all(
          approvedReqs.map(async r => {
            try {
              const [ev, pricing] = await Promise.all([getEvent(r.eventId), getEventBulkPricing(r.eventId)]);
              if (!ev) return null;
              return { ...ev, pricing } as EventData & { pricing: ResellerSectionPricing[] };
            } catch { return null; }
          })
        );
        setApprovedEvents(withPricing.filter(Boolean) as (EventData & { pricing: ResellerSectionPricing[] })[]);
      }
    });
    return () => unsub();
  }, [vendor?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save vendor dashboard draft ───────────────────────────
  useEffect(() => {
    if (!user?.uid || !draftApplied.current) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const buyEventId = approvedEvents[buyEventIdx]?.id ?? '';
      const buySectionName = approvedEvents[buyEventIdx]?.pricing[buySectionIdx]?.section ?? '';
      saveVendorDraft(user.uid!, { tab, buyEventId, buySectionName, buyQty }).catch(() => {});
    }, 1500);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [tab, buyEventIdx, buySectionIdx, buyQty, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const selectedEvent = approvedEvents[buyEventIdx];
  const selectedSection = selectedEvent?.pricing[buySectionIdx];
  const today = new Date().toISOString().slice(0, 10);
  const calTiers: CalTier[] = (selectedSection as any)?.calendarTiers || [];
  const activeCalTier = calTiers.find((t: CalTier) => today >= t.openDate && today <= t.closeDate);
  const bulkPrice = activeCalTier ? activeCalTier.priceEach
    : selectedSection ? getBulkPrice(selectedSection.bulkTiers, buyQty) : 0;
  const buyWindowOpen = calTiers.length === 0 || !!activeCalTier;
  const buyTotal = buyQty * bulkPrice;

  const refreshStock = async (vendorId: string) => {
    try {
      const pSnap = await getDocs(query(collection(db, 'vendorPurchases'), where('vendorId', '==', vendorId)));
      setOwned(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPurchase))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (e) { console.warn('refresh', e); }
  };

  async function handlePayStandFee(req: VendorRequest) {
    if (!req.id || !req.standFee) return;
    setStandFeeLoading(true); setStandFeeError(''); setStandFeeReqId(req.id);
    try {
      const orgSnap = await getDoc(doc(db, 'organizers', req.organizerId || ''));
      const orgStripeId = orgSnap.exists() ? (orgSnap.data().stripeAccountId || null) : null;
      const res = await fetch('/api/payment/stand-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          amount: req.standFee,
          connectedAccountId: orgStripeId,
          eventName: req.eventName,
          vendorName: req.vendorName,
        }),
      });
      const data = await res.json();
      if (data.error) { setStandFeeError(data.error); setStandFeeLoading(false); return; }
      setStandFeeSecret(data.clientSecret);
    } catch (e: any) {
      setStandFeeError(e.message || 'Erè.');
    } finally { setStandFeeLoading(false); }
  }

  async function handleStandFeePaid(paymentIntentId: string) {
    if (!standFeeReqId) return;
    try {
      await updateDoc(doc(db, 'vendorRequests', standFeeReqId), {
        standFeePaid: true,
        standFeePaymentId: paymentIntentId,
      });
      setVendorRequests(prev => prev.map(r => r.id === standFeeReqId ? { ...r, standFeePaid: true } : r));
      setStandFeeSecret(null); setStandFeeReqId(null);
    } catch (e) { console.error(e); }
  }

  async function handleConfirmSell() {
    if (!currentStock?.id || !vendor?.id) return;
    setSellLoading(true); setSellError('');
    try {
      const result = await vendorSellTicket({
        purchaseId: currentStock.id, eventId: currentStock.eventId,
        buyerName, buyerPhone, qty: sellQty,
      });
      const r = Array.isArray(result) ? { codes: result, pin: '' } : result;
      setSellCodes(r.codes);
      const ticketUrl = `${window.location.origin}/ticket/${r.codes[0]}`;
      const msg = [
        '🎫 *ANBYANS - TIKÈ OU PARE!*', '',
        `🎭 ${currentStock.eventName}`,
        `📅 ${currentStock.eventDate} · 🎟️ Seksyon: ${currentStock.section}`, '',
        r.codes.map((c, i) => `🔑 Tikè ${i + 1}: ${c}`).join('\n'),
        r.pin ? `🔐 PIN: ${r.pin}` : '',
        '', `📱 Wè tikè ou: ${ticketUrl}`, '',
        '⚠️ Kenbe PIN ou an sekirite.',
        '🛡️ Tikè sa voye dirèkteman pa Anbyans — pa vandè a.',
      ].filter(Boolean).join('\n');
      const phone = buyerPhone.replace(/[^0-9]/g, '');
      window.open(phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      setSellSuccess(true); setShowSellConfirm(false);
      await refreshStock(vendor.id);
    } catch (e: any) {
      setSellError(e.message || 'Erè.');
    } finally { setSellLoading(false); }
  }

  async function handleConfirmBuy() {
    if (!vendor?.id || !selectedEvent?.id || !selectedSection) return;
    setBuyLoading(true); setBuyError(''); setBuyClientSecret(null);
    try {
      // Load organizer's Stripe Connect ID
      const orgSnap = await getDoc(doc(db, 'organizers', selectedEvent.organizerId || ''));
      const orgStripeId = orgSnap.exists() ? (orgSnap.data().stripeAccountId || null) : null;
      setBuyOrgStripeId(orgStripeId);

      const res = await fetch('/api/payment/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: buyTotal,
          applicationFeeAmount: (selectedSection.onlinePrice * buyQty) * feeRate,
          currency: 'usd',
          eventName: selectedEvent.name,
          seats: buyQty,
          connectedAccountId: orgStripeId,
        }),
      });
      const data = await res.json();
      if (data.error) { setBuyError(data.error); return; }
      setBuyClientSecret(data.clientSecret);
    } catch (e: any) {
      setBuyError(e.message || 'Erè.');
    } finally { setBuyLoading(false); }
  }

  async function handleBuyPaid(paymentIntentId: string) {
    if (!vendor?.id || !selectedEvent?.id || !selectedSection) return;
    setBuyLoading(true); setBuyError('');
    try {
      await vendorBulkPurchase({
        vendorId: vendor.id, vendorName: vendor.name,
        organizerId: selectedEvent.organizerId || vendor.organizerId,
        eventId: selectedEvent.id!, eventName: selectedEvent.name,
        eventEmoji: '🎫', eventDate: selectedEvent.startDate,
        section: selectedSection.section, sectionColor: selectedSection.sectionColor,
        qty: buyQty, priceEach: bulkPrice, paymentMethod: 'stripe',
      });
      setBuySuccess(true); setShowBuyConfirm(false); setBuyClientSecret(null);
      await refreshStock(vendor.id);
    } catch (e: any) {
      setBuyError(e.message || 'Erè.');
    } finally { setBuyLoading(false); }
  }

  function resetSell() { setSellSuccess(false); setSellCodes([]); setSellQty(1); setSellPrice(''); setBuyerName(''); setBuyerPhone(''); setSellError(''); }
  function resetBuy() { setBuySuccess(false); setBuyQty(10); setBuyError(''); setBuyClientSecret(null); }

  // ── Spinner pandan chajman ──
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #a855f7', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── FIX: Ekran "an atant" — pa redirect, pa loop ──
  if (noVendorDoc) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <p style={{ fontSize: 48 }}>⏳</p>
      <p style={{ color: '#fff', fontWeight: 800, fontSize: 20, textAlign: 'center' }}>
        {t('vend_dash_pending_approval')}
      </p>
      <p style={{ color: '#666', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
        {t('vend_dash_pending_body')}
      </p>
      <button
        onClick={() => auth.signOut().then(() => { window.location.href = '/vendor/auth'; })}
        style={{ marginTop: 8, padding: '10px 28px', borderRadius: 8, border: 'none', background: '#1e1e2e', color: '#888', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
        🚪 {t('logout')}
      </button>
    </div>
  );

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'events', icon: '🎪', label: t('vend_dash_events_tab') },
    { id: 'sell', icon: '🎫', label: t('vend_dash_sell') },
    { id: 'buy', icon: '🛒', label: t('vend_dash_buy') },
    { id: 'inventory', icon: '📦', label: t('vend_dash_inventory') },
    { id: 'sales', icon: '📋', label: t('vend_dash_history') },
  ];
  const card: React.CSSProperties = { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16 };
  const btn = (color: string): React.CSSProperties => ({ padding: '12px 20px', borderRadius: 10, border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%' });
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e', padding: '0 16px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', height: 52, gap: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2 }}>ANBYANS</span>
          <div style={{ width: 1, height: 20, background: '#1e1e2e' }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{vendor?.name || 'VANDE'}</span>
          <span style={{ background: '#a855f722', color: '#a855f7', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>🏪 {t('vend_dash_reseller_badge')}</span>
          <LangSwitcher />
          <div ref={profileRef} style={{ position: 'relative' }}>
            <button onClick={() => setProfileOpen(!profileOpen)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px', borderRadius: 8, border: `1px solid ${profileOpen ? '#a855f7' : '#1e1e2e'}`, background: profileOpen ? '#a855f722' : 'transparent', cursor: 'pointer' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                {initial}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{displayName}</div>
                <div style={{ color: '#a855f7', fontSize: 10, textTransform: 'capitalize' }}>{t('vend_dash_reseller_badge')}</div>
              </div>
              <span style={{ color: '#555', fontSize: 10, marginLeft: 4 }}>▼</span>
            </button>
            {profileOpen && (
              <>
                <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} />
                <div style={{ position: 'absolute', top: '110%', right: 0, width: 200, background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 10, padding: 6, zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e1e2e', marginBottom: 4 }}>
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{displayName}</div>
                    <div style={{ color: '#555', fontSize: 11 }}>{user?.email}</div>
                  </div>
                  <Link href="/vendor/profile" onClick={() => setProfileOpen(false)} style={{ display: 'block', padding: '8px 10px', borderRadius: 6, color: '#a855f7', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    ✏️ {t('vend_profile_title')}
                  </Link>
                  <button onClick={() => { auth.signOut(); window.location.href = '/vendor/auth'; }} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6, background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer' }}>
                    🚪 {t('org_signout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <div style={{ position: 'sticky', top: 52, zIndex: 40, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex' }}>
          {TABS.map(tbItem => (
            <button key={tbItem.id} onClick={() => { setTab(tbItem.id); resetSell(); resetBuy(); setShowSellConfirm(false); setShowBuyConfirm(false); }}
              style={{ flex: 1, padding: '14px 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: tab === tbItem.id ? '#a855f7' : '#555', borderBottom: `2px solid ${tab === tbItem.id ? '#a855f7' : 'transparent'}` }}>
              {tbItem.icon} {tbItem.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px' }}>

        {/* EVENTS TAB */}
        {tab === 'events' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{t('vend_dash_events_tab')}</h2>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 20 }}>
              {t('vend_dash_events_desc')}
            </p>

            {allEvents.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
                <p style={{ color: '#888' }}>{t('vend_dash_no_pub_events')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {allEvents.map(ev => {
                  const req = vendorRequests.find(r => r.eventId === ev.id);
                  const myEv = approvedEvents.find(ae => ae.id === ev.id);
                  const isApproved = req?.status === 'approved';
                  const isPending = req?.status === 'pending';
                  const isDenied = req?.status === 'denied';
                  const hasBulk = isApproved && !!myEv && myEv.pricing && myEv.pricing.length > 0;

                  const statusBadge = () => {
                    if (isApproved) return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#22c55e22', color: '#22c55e' }}>✓ {t('vend_dash_approved')}</span>;
                    if (isPending) return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#f9731622', color: '#f97316' }}>⏳ {t('vend_dash_pending')}</span>;
                    if (isDenied) return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#ef444422', color: '#ef4444' }}>✕ {t('vend_dash_denied')}</span>;
                    return null;
                  };

                  return (
                    <div key={ev.id} style={{ ...card, borderColor: isApproved ? '#22c55e33' : isPending ? '#f9731633' : '#1e1e2e' }}>
                      {/* Event header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                        <span style={{ fontSize: 32, flexShrink: 0 }}>{(ev as { emoji?: string }).emoji || '🎪'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                            <p style={{ fontWeight: 800, fontSize: 14, margin: 0 }}>{ev.name || (ev as any).title}</p>
                            {statusBadge()}
                          </div>
                          <p style={{ color: '#888', fontSize: 11, margin: 0 }}>
                            📅 {ev.startDate}{ev.venue ? ` · 📍 ${ev.venue}` : ''}{(ev as { city?: string }).city ? ` · ${(ev as { city?: string }).city}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Stand Fee Banner */}
                      {isApproved && req?.standFee && req.standFee > 0 && !req.standFeePaid && (
                        <div style={{ background: '#f9731615', border: '1px solid #f9731633', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <p style={{ color: '#f97316', fontWeight: 700, fontSize: 13 }}>💳 Frè Stand: ${req.standFee}</p>
                              <p style={{ color: '#888', fontSize: 11 }}>Peye frè booth ou anvan w achte tikè angwo.</p>
                            </div>
                            <button onClick={() => handlePayStandFee(req)} disabled={standFeeLoading && standFeeReqId === req.id}
                              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                              {standFeeLoading && standFeeReqId === req.id ? '...' : `Peye $${req.standFee}`}
                            </button>
                          </div>
                          {standFeeError && standFeeReqId === req.id && (
                            <p style={{ color: '#ef4444', fontSize: 11, marginTop: 6 }}>{standFeeError}</p>
                          )}
                          {standFeeSecret && standFeeReqId === req.id && (
                            <div style={{ marginTop: 12 }}>
                              <Elements stripe={stripePromise} options={{ clientSecret: standFeeSecret, appearance: { theme: 'night' } }}>
                                <StandFeeStripeForm
                                  onSuccess={handleStandFeePaid}
                                  onError={msg => setStandFeeError(msg)}
                                />
                              </Elements>
                            </div>
                          )}
                        </div>
                      )}

                      {isApproved && req?.standFee && req.standFee > 0 && req.standFeePaid && (
                        <div style={{ background: '#22c55e15', border: '1px solid #22c55e33', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                          <p style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>✓ Frè stand peye — ${ req.standFee}</p>
                        </div>
                      )}

                      {/* Approved — show bulk pricing per section */}
                      {isApproved && hasBulk && myEv && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                          {myEv.pricing.map((sec, si) => {
                            const calT = (sec as any).calendarTiers || [];
                            const activeTier = calT.find((t: any) => today >= t.openDate && today <= t.closeDate);
                            const nextTier = calT.find((t: any) => today < t.openDate);
                            const activePrice = activeTier?.priceEach ?? (sec as any).activePrice;
                            const isOpen = !!activeTier || calT.length === 0;
                            const discount = activePrice && sec.onlinePrice
                              ? Math.round(((sec.onlinePrice - activePrice) / sec.onlinePrice) * 100) : 0;

                            return (
                              <div key={si} style={{ background: '#0a0a0f', border: `1px solid ${isOpen ? sec.sectionColor + '44' : '#1e1e2e'}`, borderRadius: 10, padding: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: sec.sectionColor, display: 'inline-block', flexShrink: 0 }} />
                                    <span style={{ fontWeight: 700, fontSize: 13 }}>{sec.section}</span>
                                    <span style={{ color: '#555', fontSize: 11 }}>{sec.available} {t('vend_dash_avail')}</span>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <span style={{ color: '#888', fontSize: 10, textDecoration: 'line-through', marginRight: 6 }}>${sec.onlinePrice}</span>
                                    {isOpen && activePrice
                                      ? <><span style={{ color: '#22c55e', fontWeight: 800, fontSize: 15 }}>${activePrice}</span>
                                          {discount > 0 && <span style={{ color: '#22c55e', fontSize: 10, marginLeft: 4 }}>-{discount}%</span>}</>
                                      : <span style={{ color: '#ef4444', fontSize: 11 }}>🔒 {t('vend_dash_closed')}</span>}
                                  </div>
                                </div>

                                {calT.length > 0 && (
                                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                                    {calT.map((t: any, ti: number) => {
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
                                    ⏳ {t('vend_dash_next')} {nextTier.label} ${nextTier.priceEach} — {t('vend_dash_opens')} {nextTier.openDate}
                                  </p>
                                )}

                                {isOpen && activePrice && sec.available > 0 && (() => {
                                  const standFeeBlocked = req?.standFee && req.standFee > 0 && !req.standFeePaid;
                                  return standFeeBlocked ? (
                                    <p style={{ fontSize: 11, color: '#f97316', textAlign: 'center', padding: '8px 0' }}>
                                      ⚠️ Peye frè stand anvan pou achte tikè.
                                    </p>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        const idx = approvedEvents.findIndex(ae => ae.id === ev.id);
                                        setBuyEventIdx(idx);
                                        setBuySectionIdx(si);
                                        setBuyQty(10);
                                        setTab('buy');
                                      }}
                                      style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: '#a855f7', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                      🛒 {t('vend_dash_buy_bulk_btn')} — ${activePrice}/{t('vend_dash_ticket_lbl')}
                                    </button>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Approved but no bulk pricing configured yet */}
                      {isApproved && !hasBulk && (
                        <div style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                          <p style={{ color: '#888', fontSize: 12, margin: 0 }}>
                            ⏳ {t('vend_dash_approved_no_bulk')}
                          </p>
                        </div>
                      )}

                      {/* Pending */}
                      {isPending && (
                        <div style={{ background: '#f9731610', border: '1px solid #f9731633', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                          <p style={{ color: '#f97316', fontSize: 12, margin: 0 }}>
                            ⏳ {t('vend_dash_req_sent')}
                          </p>
                        </div>
                      )}

                      {/* Denied — can re-request with note */}
                      {isDenied && (
                        <div style={{ background: '#ef444410', border: '1px solid #ef444433', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                          <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>
                            ✕ {t('vend_dash_req_denied')}
                          </p>
                        </div>
                      )}

                      {/* No request yet — show request button */}
                      {!req && (
                        <button
                          disabled={requesting === ev.id}
                          onClick={async () => {
                            if (!vendor?.id) return;
                            setRequesting(ev.id!);
                            try {
                              const newReq = await requestVendorAccess({
                                vendorId: vendor.id!,
                                vendorName: vendor.name,
                                vendorPhone: vendor.phone,
                                vendorCity: vendor.city,
                                eventId: ev.id!,
                                eventName: ev.name || (ev as any).title || '',
                                eventEmoji: (ev as { emoji?: string }).emoji || '🎪',
                                eventDate: ev.startDate,
                                organizerId: ev.organizerId || (ev as any).uid || '',
                              });
                              setVendorRequests(prev => [...prev, newReq]);
                            } catch (e) { console.error(e); }
                            finally { setRequesting(null); }
                          }}
                          style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: '2px solid #a855f7', background: 'transparent', color: '#a855f7', fontSize: 13, fontWeight: 700, cursor: requesting === ev.id ? 'not-allowed' : 'pointer', opacity: requesting === ev.id ? 0.6 : 1 }}>
                          {requesting === ev.id ? '...' : `🙋 ${t('vend_dash_request_btn')}`}
                        </button>
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
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{t('vend_dash_sell_title')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
              {[
                { label: t('vend_dash_stock_label'), value: totalRemaining },
                { label: t('vend_dash_sold_label'), value: totalSold, color: '#22c55e' },
                { label: t('vend_dash_revenue'), value: `$${totalRevenue}` },
                { label: t('vend_dash_profit'), value: `$${totalProfit}`, color: '#22c55e' },
              ].map(s => (
                <div key={s.label} style={{ ...card, textAlign: 'center', padding: 12 }}>
                  <p style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: s.color || '#fff' }}>{s.value}</p>
                </div>
              ))}
            </div>
            {owned.filter(s => s.qty - s.sold > 0).length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>📦</p>
                <p style={{ color: '#888', marginBottom: 16 }}>{t('vend_dash_no_inventory')}</p>
                <button onClick={() => setTab('buy')} style={{ ...btn('#a855f7'), width: 'auto', padding: '10px 24px' }}>🛒 {t('vend_dash_buy_bulk_link')}</button>
              </div>
            ) : (
              <div style={{ ...card, borderColor: '#a855f733' }}>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{t('vend_dash_select_stock')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                            <p style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{rem} {t('vend_dash_left')}</p>
                            <p style={{ color: '#555', fontSize: 10 }}>${s.priceEach}/{t('vend_dash_ticket_lbl')}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <p style={{ color: '#888', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{t('quantity')}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setSellQty(Math.max(1, sellQty - 1))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #1e1e2e', background: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>−</button>
                      <span style={{ fontSize: 28, fontWeight: 800, minWidth: 40, textAlign: 'center' }}>{sellQty}</span>
                      <button onClick={() => setSellQty(Math.min(remaining, sellQty + 1))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #1e1e2e', background: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                  <div>
                    <p style={{ color: '#888', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{t('vend_dash_sell_price')}</p>
                    <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder={`$${suggestedPrice}`} style={inp} />
                    <p style={{ color: '#555', fontSize: 10, marginTop: 4 }}>{t('vend_dash_you_paid')} ${currentStock?.priceEach}/{t('vend_dash_ticket_lbl')}</p>
                  </div>
                </div>
                <div style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div><p style={{ color: '#666', fontSize: 10 }}>{t('total')}</p><p style={{ fontSize: 24, fontWeight: 800 }}>${saleTotal}</p></div>
                  <div style={{ textAlign: 'right' }}><p style={{ color: '#666', fontSize: 10 }}>{t('vend_dash_profit')}</p><p style={{ fontSize: 24, fontWeight: 800, color: saleProfit >= 0 ? '#22c55e' : '#ef4444' }}>{saleProfit >= 0 ? '+' : ''}${saleProfit}</p></div>
                </div>
                <div style={{ borderTop: '1px solid #1e1e2e', paddingTop: 16, marginBottom: 16 }}>
                  <p style={{ color: '#a855f7', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{t('vend_dash_customer_info')}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 4 }}>{t('vend_dash_name_req')}</label>
                      <input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder={t('tickets_full_name_ph')} style={inp} />
                    </div>
                    <div>
                      <label style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 4 }}>WhatsApp *</label>
                      <input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} placeholder="+509 XXXX XXXX" style={inp} />
                    </div>
                  </div>
                </div>
                {sellError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{sellError}</p>}
                <button onClick={() => { if (!buyerName || !buyerPhone) { setSellError(t('vend_dash_fill_customer')); return; } setSellError(''); setShowSellConfirm(true); }} disabled={remaining === 0} style={{ ...btn('#a855f7'), opacity: remaining === 0 ? 0.4 : 1 }}>
                  🎫 {t('vend_dash_sell')} {sellQty} {t('vend_dash_ticket_lbl')} — ${saleTotal}
                </button>
                <p style={{ color: '#555', fontSize: 10, textAlign: 'center', marginTop: 6 }}>{t('vend_dash_ticket_whatsapp')}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'sell' && showSellConfirm && (
          <div style={{ ...card, borderColor: '#a855f733', textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🎫</p>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{t('vend_dash_confirm_sale_h')}</h3>
            <div style={{ ...card, textAlign: 'left', maxWidth: 320, margin: '0 auto 20px', padding: 14 }}>
              {([[t('vend_dash_event_label'), currentStock?.eventName],[t('vend_dash_section_label'), currentStock?.section],[t('vend_dash_qty_label'), sellQty],[t('vend_dash_price_per'), `$${actualSellPrice}`],[t('vend_dash_customer'), buyerName],['WhatsApp', buyerPhone],[t('total'), `$${saleTotal}`],[t('vend_dash_your_profit'), `+$${saleProfit}`]] as [string, any][]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e1e2e', fontSize: 12 }}>
                  <span style={{ color: '#666' }}>{k}</span><span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            {sellError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{sellError}</p>}
            <div style={{ display: 'flex', gap: 10, maxWidth: 320, margin: '0 auto' }}>
              <button onClick={() => setShowSellConfirm(false)} style={{ ...btn('#1e1e2e'), flex: 1 }}>← {t('back')}</button>
              <button onClick={handleConfirmSell} disabled={sellLoading} style={{ ...btn('#22c55e'), flex: 1, opacity: sellLoading ? 0.6 : 1 }}>{sellLoading ? '...' : `✓ ${t('confirm')}`}</button>
            </div>
          </div>
        )}

        {tab === 'sell' && sellSuccess && (
          <div style={{ ...card, borderColor: '#22c55e', textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 56, marginBottom: 12 }}>✅</p>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: '#22c55e', marginBottom: 8 }}>{t('vend_dash_sale_success')}</h3>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>{t('vend_dash_ticket_sent_to')} <strong style={{ color: '#fff' }}>{buyerPhone}</strong></p>
            {sellCodes.length > 0 && (
              <div style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: 12, margin: '12px auto', maxWidth: 300 }}>
                <p style={{ color: '#555', fontSize: 10, marginBottom: 6 }}>Kòd tikè</p>
                {sellCodes.map(c => <p key={c} style={{ fontFamily: 'monospace', fontSize: 13, color: '#22c55e' }}>{c}</p>)}
              </div>
            )}
            <p style={{ color: '#22c55e', fontWeight: 700, fontSize: 16, marginTop: 8 }}>+${saleProfit} {t('vend_dash_profit_label')}</p>
            <button onClick={resetSell} style={{ ...btn('#a855f7'), width: 'auto', padding: '10px 24px', marginTop: 16 }}>🎫 {t('vend_dash_sell_more')}</button>
          </div>
        )}

        {/* BUY TAB */}
        {tab === 'buy' && !showBuyConfirm && !buySuccess && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{t('vend_dash_buy_title')}</h2>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 20 }}>{t('vend_dash_buy_desc')}</p>
            {approvedEvents.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>🎪</p>
                <p style={{ color: '#888' }}>{t('vend_dash_no_events_resale')}</p>
                <p style={{ color: '#555', fontSize: 11, marginTop: 8 }}>{t('vend_dash_ask_org_bulk')}</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{t('vend_dash_event_h')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {approvedEvents.map((ev, i) => (
                      <button key={ev.id} onClick={() => { setBuyEventIdx(i); setBuySectionIdx(0); setBuyQty(10); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: `1px solid ${buyEventIdx === i ? '#a855f7' : '#1e1e2e'}`, background: buyEventIdx === i ? '#a855f715' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontSize: 24 }}>🎫</span>
                        <div><p style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{ev.name}</p><p style={{ color: '#666', fontSize: 10 }}>📅 {ev.startDate}</p></div>
                      </button>
                    ))}
                  </div>
                </div>
                {selectedEvent && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{t('vend_dash_section_label')}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {selectedEvent.pricing.map((sec, i) => (
                        <button key={i} onClick={() => { setBuySectionIdx(i); setBuyQty(10); }}
                          style={{ flex: 1, padding: 10, borderRadius: 10, textAlign: 'center', border: `1px solid ${buySectionIdx === i ? '#a855f7' : '#1e1e2e'}`, background: buySectionIdx === i ? '#a855f715' : 'transparent', cursor: 'pointer' }}>
                          <span style={{ color: sec.sectionColor, fontWeight: 700, fontSize: 13 }}>{sec.section}</span>
                          <p style={{ color: '#666', fontSize: 10, marginTop: 2 }}>Online: ${sec.onlinePrice}</p>
                          <p style={{ color: '#555', fontSize: 10 }}>{sec.available} {t('vend_dash_avail')}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSection && (() => {
                  const calT: CalTier[] = (selectedSection as any).calendarTiers || [];
                  const activeCal = calT.find((t: CalTier) => today >= t.openDate && today <= t.closeDate);
                  return (
                    <div style={{ ...card, marginBottom: 16 }}>
                      <p style={{ color: '#a855f7', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>📅 {t('vend_dash_cal_pricing')} — {selectedSection.section}</p>
                      {calT.length > 0 ? (
                        <>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ borderBottom: '1px solid #1e1e2e' }}>{['Fenèt', t('vend_dash_dates'), t('vend_dash_price'), t('vend_dash_discount')].map(h => <th key={h} style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', paddingBottom: 8, textAlign: 'left' }}>{h}</th>)}</tr></thead>
                            <tbody>
                              {calT.map((t: CalTier, i: number) => {
                                const disc = Math.round(((selectedSection.onlinePrice - t.priceEach) / selectedSection.onlinePrice) * 100);
                                const isActive = today >= t.openDate && today <= t.closeDate;
                                const isPast = today > t.closeDate;
                                return (
                                  <tr key={i} style={{ borderBottom: '1px solid #1e1e2e', background: isActive ? '#a855f715' : 'transparent', opacity: isPast ? 0.4 : 1 }}>
                                    <td style={{ padding: '8px 0', fontSize: 12, fontWeight: isActive ? 700 : 400, color: isActive ? '#a855f7' : '#fff' }}>{t.label} {isActive && '← now'} {today < t.openDate && '🔒'} {isPast && '✓'}</td>
                                    <td style={{ fontSize: 10, color: '#888' }}>{t.openDate} → {t.closeDate}</td>
                                    <td style={{ fontSize: 14, fontWeight: 700 }}>${t.priceEach}</td>
                                    <td style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>-{disc}%</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {activeCal ? (
                            <div style={{ background: '#a855f715', border: '1px solid #a855f733', borderRadius: 6, padding: '6px 10px', marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <p style={{ color: '#a855f7', fontSize: 11, fontWeight: 700 }}>✓ {activeCal.label} — ${activeCal.priceEach}/{t('vend_dash_ticket_lbl')}</p>
                              <p style={{ color: '#666', fontSize: 10 }}>{t('vend_dash_closes')} {activeCal.closeDate}</p>
                            </div>
                          ) : (
                            <div style={{ background: '#ef444415', border: '1px solid #ef444433', borderRadius: 6, padding: '6px 10px', marginTop: 10 }}>
                              <p style={{ color: '#ef4444', fontSize: 11 }}>⚠️ {t('vend_dash_no_window')}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p style={{ color: '#555', fontSize: 12 }}>{t('vend_dash_no_cal')}</p>
                      )}
                    </div>
                  );
                })()}
                {selectedSection && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ color: '#888', fontSize: 11, fontWeight: 700, marginBottom: 10 }}>{t('quantity')}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {[-5, -1].map(d => <button key={d} onClick={() => setBuyQty(Math.max(1, buyQty + d))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #1e1e2e', background: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{d}</button>)}
                        <span style={{ fontSize: 32, fontWeight: 800, minWidth: 60, textAlign: 'center' }}>{buyQty}</span>
                        {[1, 5].map(d => <button key={d} onClick={() => setBuyQty(Math.min(selectedSection.available, buyQty + d))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #1e1e2e', background: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+{d}</button>)}
                      </div>
                    </div>
                    <div style={{ background: '#a855f715', border: '1px solid #a855f733', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div><p style={{ color: '#888', fontSize: 10 }}>{t('vend_dash_bulk_price')}</p><p style={{ fontSize: 13 }}>${bulkPrice} × {buyQty} {t('vend_dash_tickets_lbl')}</p></div>
                      <div style={{ textAlign: 'right' }}><p style={{ color: '#888', fontSize: 10 }}>{t('vend_dash_you_pay')}</p><p style={{ fontSize: 28, fontWeight: 800 }}>${buyTotal.toLocaleString()}</p></div>
                    </div>
                    {buyError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{buyError}</p>}
                    <button onClick={() => setShowBuyConfirm(true)} disabled={!buyWindowOpen || buyQty < 1} style={{ ...btn('#a855f7'), opacity: (!buyWindowOpen || buyQty < 1) ? 0.4 : 1 }}>
                      🛒 {t('vend_dash_buy_btn')} {buyQty} {t('vend_dash_tickets_lbl')} — ${buyTotal.toLocaleString()}
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
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{t('vend_dash_confirm_purch_h')}</h3>
            <div style={{ ...card, textAlign: 'left', maxWidth: 320, margin: '0 auto 20px', padding: 14 }}>
              {([[t('vend_dash_event_label'), selectedEvent?.name],[t('vend_dash_section_label'), selectedSection?.section],[t('vend_dash_qty_label'), `${buyQty} ${t('vend_dash_tickets_lbl')}`],[t('vend_dash_bulk_price'), `$${bulkPrice}`],[t('total'), `$${buyTotal.toLocaleString()}`]] as [string,any][]).map(([k,v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e1e2e', fontSize: 12 }}>
                  <span style={{ color: '#666' }}>{k}</span><span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            {buyError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{buyError}</p>}
            {!buyClientSecret && (
              <button onClick={handleConfirmBuy} disabled={buyLoading}
                style={{ ...btn('#a855f7'), maxWidth: 320, margin: '0 auto', opacity: buyLoading ? 0.6 : 1 }}>
                {buyLoading ? '...' : `💳 Peye $${buyTotal.toLocaleString()}`}
              </button>
            )}
            {buyClientSecret && (
              <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'left' }}>
                <Elements stripe={stripePromise} options={{ clientSecret: buyClientSecret, appearance: { theme: 'night' } }}>
                  <VendorStripeForm
                    onSuccess={handleBuyPaid}
                    onError={msg => setBuyError(msg)}
                  />
                </Elements>
              </div>
            )}
            <button onClick={() => { setShowBuyConfirm(false); setBuyClientSecret(null); }} style={{ color: '#555', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, marginTop: 12 }}>← {t('back')}</button>
          </div>
        )}

        {tab === 'buy' && buySuccess && (
          <div style={{ ...card, borderColor: '#22c55e', textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 56, marginBottom: 12 }}>✅</p>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: '#22c55e', marginBottom: 8 }}>{t('vend_dash_purch_success')}</h3>
            <p style={{ color: '#888', fontSize: 13 }}><strong>{buyQty}</strong> {t('vend_dash_tickets_lbl')} <span style={{ color: selectedSection?.sectionColor }}>{selectedSection?.section}</span> {t('vend_dash_for_label')} <strong>{selectedEvent?.name}</strong></p>
            <button onClick={() => { resetBuy(); setTab('sell'); }} style={{ ...btn('#a855f7'), width: 'auto', padding: '10px 24px', marginTop: 16 }}>🎫 {t('vend_dash_go_sell')}</button>
          </div>
        )}

        {/* INVENTORY */}
        {tab === 'inventory' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{t('vend_dash_inv_title')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {[{label:t('vend_dash_bought'),value:totalStock},{label:t('vend_dash_sold_label'),value:totalSold,color:'#22c55e'},{label:t('vend_dash_remaining'),value:totalRemaining},{label:t('vend_dash_invested'),value:`$${totalInvested}`},{label:t('vend_dash_revenue'),value:`$${totalRevenue}`},{label:t('vend_dash_profit'),value:`$${totalProfit}`,color:'#22c55e'}].map(s => (
                <div key={s.label} style={{ ...card, textAlign: 'center', padding: 12 }}>
                  <p style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: s.color || '#fff' }}>{s.value}</p>
                </div>
              ))}
            </div>
            {owned.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}><p style={{ fontSize: 40, marginBottom: 10 }}>📦</p><p style={{ color: '#888' }}>{t('vend_dash_empty_inv')}</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                        {[{l:t('vend_dash_bought'),v:s.qty},{l:t('vend_dash_sold_label'),v:s.sold,c:'#22c55e'},{l:t('vend_dash_left'),v:rem,c:rem<=5&&rem>0?'#f97316':'#fff'},{l:t('vend_dash_cost'),v:`$${s.priceEach}`},{l:t('vend_dash_invested'),v:`$${s.totalPaid}`}].map(x => (
                          <div key={x.l}><p style={{ color: '#555', fontSize: 9, marginBottom: 2 }}>{x.l}</p><p style={{ fontWeight: 700, fontSize: 13, color: x.c || '#fff' }}>{x.v}</p></div>
                        ))}
                      </div>
                      <div style={{ height: 6, background: '#1e1e2e', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#a855f7', borderRadius: 3 }} />
                      </div>
                      <p style={{ color: '#555', fontSize: 10, textAlign: 'right', marginTop: 4 }}>{pct}% {t('vend_dash_sold_pct')}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => setTab('buy')} style={{ ...btn('transparent'), border: '2px dashed #a855f7', color: '#a855f7', marginTop: 12 }}>🛒 {t('vend_dash_buy_more')}</button>
          </div>
        )}

        {/* SALES */}
        {tab === 'sales' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{t('vend_dash_sales_title')}</h2>
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
                {[{l:t('vend_dash_sales'),v:sales.reduce((a,s)=>a+s.qty,0)},{l:t('vend_dash_revenue'),v:`$${totalRevenue}`},{l:t('vend_dash_cost_label'),v:`$${totalCost}`},{l:t('vend_dash_profit'),v:`$${totalProfit}`,c:'#22c55e'}].map(s => (
                  <div key={s.l}><p style={{ color: '#555', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>{s.l}</p><p style={{ fontSize: 18, fontWeight: 800, color: s.c||'#fff' }}>{s.v}</p></div>
                ))}
              </div>
            </div>
            {sales.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}><p style={{ fontSize: 40, marginBottom: 10 }}>📋</p><p style={{ color: '#888' }}>{t('vend_dash_no_sales')}</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                        <p style={{ color: '#22c55e', fontSize: 10, fontWeight: 700 }}>+${profit} {t('vend_dash_profit_label')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
'use client';
import { useT } from '@/i18n';
import ResellersTab from '@/components/organizer/ResellersTab';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getOrganizerEvents, type EventData } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

interface VendorData {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  city?: string;
  organizerId: string;
  status?: string;
  trusted?: boolean;
}

interface VendorPurchase {
  id: string;
  vendorId: string;
  vendorName: string;
  eventId: string;
  eventName: string;
  section: string;
  qty: number;
  sold: number;
  priceEach: number;
  totalPaid: number;
}

interface RecentSale {
  id: string;
  buyerName: string;
  buyerPhone?: string;
  eventName?: string;
  eventId: string;
  section: string;
  qty?: number;
  price: number;
  soldAt?: any;
  source?: string; // 'online' | 'vendor'
  vendorName?: string;
}

type Tab = 'dashboard' | 'events' | 'resellers' | 'revenue' | 'analytics' | 'scanner' | 'settings' | 'create' | 'staff';

const NAV_ITEMS: { id: Tab; icon: string; label: string; badge?: number }[] = [
  { id: 'dashboard', icon: '📊', label: 'Dachbòd' },
  { id: 'events',    icon: '📅', label: 'Evènman' },
  { id: 'resellers', icon: '🏪', label: 'Revandè' },
  { id: 'revenue',   icon: '💰', label: 'Revni' },
  { id: 'analytics', icon: '📈', label: 'Analytics' },
  { id: 'scanner',   icon: '📱', label: 'Eskanè' },
  { id: 'settings',  icon: '⚙️', label: 'Paramèt' },
];

/* ══════════════════════════════════════════════════════════════════
   ANALYTICS PANEL
   ══════════════════════════════════════════════════════════════════ */

function AnalyticsPanel({ allTickets, events }: { allTickets: any[]; events: EventData[] }) {
  const { t } = useT();
  const [aTab, setATab] = useState<'spenders' | 'loyal' | 'sections' | 'events'>('spenders');

  const validTickets = allTickets.filter(t => t.status !== 'cancelled' && t.status !== 'refunded');

  const byBuyer: Record<string, { name: string; phone: string; total: number; count: number; events: Set<string>; sections: Record<string, number> }> = {};
  validTickets.forEach(t => {
    const key = t.buyerPhone || t.buyerEmail || 'unknown';
    if (!byBuyer[key]) byBuyer[key] = { name: t.buyerName || key, phone: key, total: 0, count: 0, events: new Set(), sections: {} };
    byBuyer[key].total += t.price || 0;
    byBuyer[key].count += 1;
    if (t.eventId) byBuyer[key].events.add(t.eventId);
    const sec = t.section || 'General';
    byBuyer[key].sections[sec] = (byBuyer[key].sections[sec] || 0) + 1;
  });
  const buyers = Object.values(byBuyer).map(b => ({
    ...b,
    eventCount: b.events.size,
    favSection: Object.entries(b.sections).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
  }));
  const topSpenders = [...buyers].sort((a, b) => b.total - a.total).slice(0, 10);
  const topLoyal = [...buyers].sort((a, b) => b.eventCount - a.eventCount || b.count - a.count).slice(0, 10);

  const sectionTotals: Record<string, number> = {};
  validTickets.forEach(t => { const s = t.section || 'General'; sectionTotals[s] = (sectionTotals[s] || 0) + 1; });
  const topSections = Object.entries(sectionTotals).sort((a, b) => b[1] - a[1]);
  const maxSec = topSections[0]?.[1] || 1;

  const revByEvent: Record<string, { name: string; rev: number; count: number }> = {};
  validTickets.forEach(t => {
    const ev = events.find(e => e.id === t.eventId);
    const name = ev?.name || t.eventId || '?';
    if (!revByEvent[t.eventId]) revByEvent[t.eventId] = { name, rev: 0, count: 0 };
    revByEvent[t.eventId].rev += t.price || 0;
    revByEvent[t.eventId].count += 1;
  });
  const revEvents = Object.values(revByEvent).sort((a, b) => b.rev - a.rev);
  const maxRev = revEvents[0]?.rev || 1;

  if (validTickets.length === 0) return (
    <div className="text-center py-20">
      <div className="text-5xl mb-3">📈</div>
      <p className="text-gray-muted text-sm">Pa gen done tikè ankò.</p>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: t('total_buyers').toUpperCase(), val: buyers.length, icon: '👤', color: 'text-white' },
          { label: 'FIDÈL (2+ EVÈN)', val: buyers.filter(b => b.eventCount >= 2).length, icon: '⭐', color: 'text-orange' },
          { label: 'TIKÈ VANN', val: validTickets.length, icon: '🎫', color: 'text-green' },
          { label: 'DEPANS MOY / MOUN', val: '$' + (buyers.length ? Math.round(buyers.reduce((s, b) => s + b.total, 0) / buyers.length) : 0), icon: '💰', color: 'text-cyan' },
        ].map(k => (
          <div key={k.label} className="bg-dark-card border border-border rounded-card p-4">
            <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1">{k.icon} {k.label}</p>
            <p className={`font-heading text-3xl ${k.color}`}>{k.val}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {([['spenders', '💸 Top Depans'], ['loyal', '⭐ Pli Fidèl'], ['sections', '🎯 Seksyon'], ['events', '📅 Evènman']] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setATab(k as typeof aTab)}
            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${aTab === k ? 'bg-orange text-white' : 'bg-dark-card border border-border text-gray-light hover:text-white'}`}>
            {l}
          </button>
        ))}
      </div>

      {aTab === 'spenders' && (
        <div className="bg-dark-card border border-border rounded-card overflow-hidden">
          <div className="p-4 border-b border-border"><p className="text-[10px] uppercase tracking-widest text-orange font-bold">💸 TOP 10 DEPANSÈ</p></div>
          {topSpenders.map((b, i) => (
            <div key={b.phone} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-white/[0.02] transition-all">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-gray-400/20 text-gray-300' : i === 2 ? 'bg-orange/20 text-orange' : 'bg-white/[0.05] text-gray-muted'}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{b.name}</p>
                <p className="text-[10px] text-gray-muted">{b.phone} · {b.count} tikè · {b.eventCount} evèn</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-orange">${b.total.toLocaleString()}</p>
                <p className="text-[9px] text-gray-muted">{b.favSection}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {aTab === 'loyal' && (
        <div className="bg-dark-card border border-border rounded-card overflow-hidden">
          <div className="p-4 border-b border-border"><p className="text-[10px] uppercase tracking-widest text-orange font-bold">⭐ PI FIDÈL — plis evènman</p></div>
          {topLoyal.map((b, i) => (
            <div key={b.phone} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-white/[0.02] transition-all">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-gray-400/20 text-gray-300' : i === 2 ? 'bg-orange/20 text-orange' : 'bg-white/[0.05] text-gray-muted'}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{b.name}</p>
                <p className="text-[10px] text-gray-muted">{b.phone}</p>
              </div>
              <div className="flex gap-2 items-center">
                {[...Array(Math.min(b.eventCount, 5))].map((_, j) => <span key={j} className="text-orange text-xs">⭐</span>)}
                <div className="text-right ml-2">
                  <p className="text-xs font-bold">{b.eventCount} evèn</p>
                  <p className="text-[10px] text-gray-muted">{b.count} tikè · ${b.total}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {aTab === 'sections' && (
        <div className="bg-dark-card border border-border rounded-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">🎯 POPULARITE SEKSYON</p>
          <div className="space-y-3">
            {topSections.map(([sec, cnt]) => (
              <div key={sec}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-bold">{sec}</span>
                  <span className="text-gray-muted">{cnt} tikè ({Math.round(cnt / validTickets.length * 100)}%)</span>
                </div>
                <div className="w-full bg-white/[0.05] rounded-full h-2.5">
                  <div className="bg-orange h-2.5 rounded-full transition-all" style={{ width: `${Math.round(cnt / maxSec * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {aTab === 'events' && (
        <div className="bg-dark-card border border-border rounded-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">📅 {t('revenue_per_event').toUpperCase()}</p>
          <div className="space-y-3">
            {revEvents.map(ev => (
              <div key={ev.name}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-bold truncate flex-1 mr-4">{ev.name}</span>
                  <span className="text-gray-muted">${ev.rev.toLocaleString()} · {ev.count} tikè</span>
                </div>
                <div className="w-full bg-white/[0.05] rounded-full h-2.5">
                  <div className="bg-green h-2.5 rounded-full transition-all" style={{ width: `${Math.round(ev.rev / maxRev * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════ */

export default function OrganizerDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [sideOpen, setSideOpen] = useState(false);

  // Real data
  const [events, setEvents] = useState<EventData[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [vendorPurchases, setVendorPurchases] = useState<VendorPurchase[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [loading, setLoading] = useState(true);

  // Organizer profile from Firestore
  const [orgProfile, setOrgProfile] = useState<{ name: string; bizName: string; initials: string }>({
    name: user?.email || 'Òganizatè',
    bizName: '',
    initials: (user?.email || 'OR').slice(0, 2).toUpperCase(),
  });

  useEffect(() => {
    if (!user?.uid) return;

    const loadAll = async () => {
      try {
        // 1. Events
        const evs = await getOrganizerEvents(user.uid);
        setEvents(evs);

        const eventIds = evs.map(e => e.id!).filter(Boolean);

        // 2. All tickets (analytics + recent sales)
        const tickets: any[] = [];
        if (eventIds.length > 0) {
          await Promise.all(eventIds.map(async (eid) => {
            const snap = await getDocs(collection(db, 'events', eid, 'tickets'));
            snap.docs.forEach(d => tickets.push({ id: d.id, eventId: eid, ...d.data() }));
          }));
          setAllTickets(tickets);

          // Recent sales — sort by soldAt desc, take 10
          const sorted = [...tickets]
            .filter(t => t.soldAt || t.createdAt)
            .sort((a, b) => {
              const aTime = a.soldAt?.seconds || a.createdAt?.seconds || 0;
              const bTime = b.soldAt?.seconds || b.createdAt?.seconds || 0;
              return bTime - aTime;
            })
            .slice(0, 10)
            .map(t => {
              const ev = evs.find(e => e.id === t.eventId);
              const secAgo = Math.floor((Date.now() / 1000) - (t.soldAt?.seconds || t.createdAt?.seconds || 0));
              const timeLabel = secAgo < 60 ? `${secAgo}s` : secAgo < 3600 ? `${Math.floor(secAgo / 60)} min` : secAgo < 86400 ? `${Math.floor(secAgo / 3600)}h` : `${Math.floor(secAgo / 86400)}j`;
              return {
                id: t.id,
                buyerName: t.buyerName || '—',
                buyerPhone: t.buyerPhone,
                eventId: t.eventId,
                eventName: ev?.name || '—',
                section: t.section || 'GA',
                qty: t.qty || 1,
                price: t.price || 0,
                soldAt: t.soldAt || t.createdAt,
                timeLabel,
                source: t.vendorId ? 'vendor' : 'online',
                vendorName: t.vendorName,
              };
            });
          setRecentSales(sorted as any);
        }

        // 3. Vendors assigned to this organizer
        const vSnap = await getDocs(query(
          collection(db, 'vendors'),
          where('organizerId', '==', user.uid)
        ));
        const vList = vSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorData));
        setVendors(vList);

        // 4. Vendor purchases (to calculate owed)
        if (vList.length > 0) {
          const vpSnap = await getDocs(query(
            collection(db, 'vendorPurchases'),
            where('organizerId', '==', user.uid)
          ));
          setVendorPurchases(vpSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPurchase)));
        }

        // 5. Organizer profile
        const orgSnap = await getDocs(query(
          collection(db, 'organizers'),
          where('uid', '==', user.uid)
        ));
        if (!orgSnap.empty) {
          const data = orgSnap.docs[0].data();
          const fullName = data.name || user?.email || 'Òganizatè';
          setOrgProfile({
            name: fullName,
            bizName: data.businessName || data.bizName || '',
            initials: fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
          });
        } else {
          // fallback to user profile collection
          const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
          if (!userSnap.empty) {
            const data = userSnap.docs[0].data();
            const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ') || user?.email || 'Òganizatè';
            setOrgProfile({
              name: fullName,
              bizName: data.businessName || '',
              initials: fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
            });
          }
        }

      } catch (e) {
        console.error('loadAll', e);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [user?.uid]);

  // ── Computed stats ──
  const totalRevenue = allTickets
    .filter(t => t.status !== 'cancelled' && t.status !== 'refunded')
    .reduce((a, t) => a + (t.price || 0), 0);

  const totalSold = allTickets.filter(t => t.status !== 'cancelled' && t.status !== 'refunded').length;

  const activeEvents = events.filter(e => e.status === 'published' || e.status === 'live').length;

  // Vendor owed = tickets sold by vendor * priceEach that haven't been settled
  const vendorOwed = vendorPurchases.reduce((a, vp) => {
    const soldValue = vp.sold * vp.priceEach;
    // Simplified: total owed = totalPaid for unsettled purchases
    // In a full impl you'd check a `settled` flag
    return a + (vp.totalPaid || 0);
  }, 0);

  // Per-vendor stats
  const vendorStats = vendors.map(v => {
    const purchases = vendorPurchases.filter(vp => vp.vendorId === v.id);
    const totalAssigned = purchases.reduce((a, vp) => a + vp.qty, 0);
    const totalVSold = purchases.reduce((a, vp) => a + vp.sold, 0);
    const totalOwed = purchases.reduce((a, vp) => a + (vp.sold * vp.priceEach), 0);
    const eventCount = new Set(purchases.map(vp => vp.eventId)).size;
    return { ...v, totalAssigned, totalVSold, totalOwed, eventCount, purchases };
  });

  const totalVendorOwed = vendorStats.reduce((a, v) => a + v.totalOwed, 0);

  // Revenue split
  const vendorTicketRevenue = allTickets
    .filter(t => t.vendorId && t.status !== 'cancelled')
    .reduce((a, t) => a + (t.price || 0), 0);
  const onlineRevenue = totalRevenue - vendorTicketRevenue;

  return (
    <div className="min-h-screen flex bg-dark">

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[220px] bg-dark-card border-r border-border flex flex-col transition-transform md:translate-x-0 md:static ${sideOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 pb-5 border-b border-border">
          <Link href="/"><img src="/logo.jpg" alt="Anbyans" className="h-10 rounded" /></Link>
        </div>
        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-muted px-3 mb-2">Jeneral</p>
          {NAV_ITEMS.map(n => (
            <button key={n.id}
              onClick={() => {
                if (n.id === 'resellers') { setTab('resellers'); setSideOpen(false); return; }
                if (n.id === 'create') { router.push('/organizer/events/create'); return; }
                if (n.id === 'staff') { router.push('/organizer/scanner'); return; }
                setTab(n.id); setSideOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] mb-0.5 transition-all ${tab === n.id ? 'bg-orange-dim text-orange font-semibold' : 'text-gray-light hover:bg-dark-hover hover:text-white'}`}>
              <span className="text-base w-5 text-center">{n.icon}</span>
              {n.label}
              {n.id === 'events' && events.length > 0 && (
                <span className="ml-auto bg-orange text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{events.length}</span>
              )}
              {n.id === 'resellers' && vendors.length > 0 && (
                <span className="ml-auto bg-orange text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{vendors.length}</span>
              )}
            </button>
          ))}
        </nav>
        {/* Real user profile */}
        <div className="p-4 border-t border-border flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-orange flex items-center justify-center text-sm font-bold flex-shrink-0">
            {orgProfile.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold truncate">{orgProfile.name}</p>
            <p className="text-[9px] text-gray-muted truncate">{orgProfile.bizName || user?.email || ''}</p>
          </div>
          <button onClick={() => router.push('/auth')} className="text-gray-muted hover:text-red text-sm">🚪</button>
        </div>
      </aside>

      {sideOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSideOpen(false)} />}

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* HEADER */}
        <header className="sticky top-0 z-20 bg-dark border-b border-border px-5 flex items-center h-14 gap-3">
          <button onClick={() => setSideOpen(true)} className="md:hidden text-xl">☰</button>
          <h1 className="font-heading text-xl tracking-wide flex-1">
            {tab === 'dashboard' && t('dashboard').toUpperCase()}
            {tab === 'events'    && t('events').toUpperCase()}
            {tab === 'resellers' && 'REVANDÈ'}
            {tab === 'revenue'   && t('revenue').toUpperCase()}
            {tab === 'analytics' && 'ANALYTICS'}
            {tab === 'scanner'   && t('qr_scanner').toUpperCase()}
            {tab === 'settings'  && t('settings').toUpperCase()}
          </h1>


        </header>

        <div className="flex-1 overflow-y-auto p-5">

          {/* ═══ DASHBOARD TAB ═══ */}
          {tab === 'dashboard' && <>

            {/* Stats — real data */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              {[
                { label: t('revenue_total').toUpperCase(),    value: `$${totalRevenue.toLocaleString()}`, sub: `${totalSold} ${t('tickets_sold')}` },
                { label: 'TIKÈ VANN',      value: totalSold.toLocaleString(),          sub: `${activeEvents} evènman aktif` },
                { label: t('active_events').toUpperCase(),  value: activeEvents.toString(),             sub: `${events.length} ${t('total').toLowerCase()}` },
                { label: 'REVANDÈ DWE',    value: `$${totalVendorOwed.toLocaleString()}`, sub: `${vendors.length} revandè`, warn: totalVendorOwed > 0 },
              ].map((s, i) => (
                <div key={i} className="bg-dark-card border border-border rounded-card p-4">
                  <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">{s.label}</p>
                  <p className={`font-heading text-3xl tracking-wide ${s.warn ? 'text-orange' : ''}`}>{s.value}</p>
                  <p className="text-[10px] text-gray-muted mt-1">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <Link href="/organizer/events/create"
                className="bg-dark-card border border-border rounded-card p-4 flex items-center gap-3 hover:border-orange-border hover:bg-dark-hover transition-all">
                <span className="text-2xl">📅</span>
                <div><p className="text-xs font-bold">{t('create_event')}</p><p className="text-[10px] text-gray-light">{t('create_event_desc')}</p></div>
              </Link>
              <Link href="/organizer/vendors"
                className="bg-dark-card border border-border rounded-card p-4 flex items-center gap-3 hover:border-orange-border hover:bg-dark-hover transition-all">
                <span className="text-2xl">🏪</span>
                <div><p className="text-xs font-bold">{t('manage_resellers')}</p><p className="text-[10px] text-gray-light">{t('manage_resellers_desc')}</p></div>
              </Link>
              <Link href="/organizer/scanner"
                className="bg-dark-card border border-border rounded-card p-4 flex items-center gap-3 hover:border-orange-border hover:bg-dark-hover transition-all">
                <span className="text-2xl">📱</span>
                <div><p className="text-xs font-bold">Ouvri Eskanè</p><p className="text-[10px] text-gray-light">Eskane QR tikè nan antre evènman</p></div>
              </Link>
              <button onClick={() => setTab('revenue')}
                className="bg-dark-card border border-border rounded-card p-4 flex items-center gap-3 hover:border-orange-border hover:bg-dark-hover transition-all text-left">
                <span className="text-2xl">📈</span>
                <div><p className="text-xs font-bold">Wè Rapò</p><p className="text-[10px] text-gray-light">Analiz vant, revni, ak pèfòmans revandè</p></div>
              </button>
            </div>

            {/* Events Overview */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-lg tracking-wide">{t('events').toUpperCase()}</h2>
                <button onClick={() => setTab('events')} className="text-[11px] text-orange hover:underline">Wè tout →</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      {['Evènman', 'Dat', 'Estati', 'Vant', 'Tikè', 'Revni'].map(h => (
                        <th key={h} className="text-[10px] text-gray-muted uppercase tracking-widest pb-2.5 pl-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>Chaje...</td></tr>
                    ) : events.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
                        Pa gen evènman — <a href="/organizer/events/create" style={{ color: '#f97316' }}>Kreye premye a</a>
                      </td></tr>
                    ) : events.map(e => {
                      const evTickets = allTickets.filter(t => t.eventId === e.id && t.status !== 'cancelled');
                      const evRevenue = evTickets.reduce((a, t) => a + (t.price || 0), 0);
                      const evVendors = vendors.filter(v => vendorPurchases.some(vp => vp.vendorId === v.id && vp.eventId === e.id)).length;
                      return (
                        <tr key={e.id} className="border-b border-border hover:bg-white/[0.015] cursor-pointer">
                          <td className="py-3 pl-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="mr-1">{(e as EventData & { emoji?: string }).emoji || '🎫'}</span>
                              <span className="text-xs font-semibold">{e.name}</span>
                              {e.isPrivate && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange/20 text-orange border border-orange/30">🔒 PRIVE</span>
                              )}
                              {e.isPrivate && e.privateToken && (
                                <button onClick={ev => { ev.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/e/${e.privateToken}`); }}
                                  className="px-1.5 py-0.5 rounded text-[8px] font-bold border border-border text-gray-light hover:text-white hover:border-white/30 transition-all">
                                  📋
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="text-xs text-gray-light">{e.startDate || (e as any).date || '—'}</td>
                          <td>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              e.status === 'live' ? 'bg-green-dim text-green' :
                              e.status === 'published' ? 'bg-cyan-dim text-cyan' :
                              'bg-white/[0.05] text-gray-muted'
                            }`}>
                              {e.status === 'live' ? '● AN DIRÈK' : e.status === 'published' ? 'PIBLIYE' : e.status === 'draft' ? 'BOUYON' : 'PASE'}
                            </span>
                          </td>
                          <td className="text-xs text-gray-light">{evTickets.length}</td>
                          <td className="text-xs text-gray-light">{evVendors} revandè</td>
                          <td className="text-xs font-bold">${evRevenue.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Sales — real data */}
            <div>
              <h2 className="font-heading text-lg tracking-wide mb-3">DÈNYE VANT</h2>
              {recentSales.length === 0 ? (
                <div className="bg-dark-card border border-border rounded-card p-8 text-center">
                  <p className="text-4xl mb-2">🎫</p>
                  <p className="text-gray-muted text-sm">Pa gen vant ankò.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentSales.map((s: any) => (
                    <div key={s.id} className="bg-dark-card border border-border rounded-card p-3 flex items-center gap-3">
                      <span className="text-[10px] text-gray-muted w-12 flex-shrink-0">{s.timeLabel}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{s.eventName}</p>
                        <p className="text-[10px] text-gray-light">
                          {s.qty}× {s.section} · {s.source === 'vendor' ? `🏪 ${s.vendorName || 'Revandè'}` : '🌐 Online'} · {s.buyerName}
                        </p>
                      </div>
                      <span className="font-heading text-lg text-green">${s.price}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>}

          {/* ═══ EVENTS TAB ═══ */}
          {tab === 'events' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-light">{events.length} evènman</p>
                <Link href="/organizer/events/create"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
                  ➕ Kreye Evènman
                </Link>
              </div>
              {loading ? (
                <div className="text-center py-16 text-gray-muted">Chaje...</div>
              ) : events.length === 0 ? (
                <div className="bg-dark-card border border-border rounded-card p-12 text-center">
                  <p className="text-5xl mb-3">📅</p>
                  <p className="text-gray-muted mb-4">Pa gen evènman ankò.</p>
                  <Link href="/organizer/events/create" className="inline-flex px-5 py-2.5 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
                    ➕ Kreye premye evènman ou
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map(e => {
                    const evTickets = allTickets.filter(t => t.eventId === e.id && t.status !== 'cancelled');
                    const evRevenue = evTickets.reduce((a, t) => a + (t.price || 0), 0);
                    return (
                      <div key={e.id} className="bg-dark-card border border-border rounded-card p-4 hover:border-white/[0.1] transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-[10px] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-3xl flex-shrink-0">
                            {(e as EventData & { emoji?: string }).emoji || '🎫'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold">{e.name}</p>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                e.status === 'live' ? 'bg-green-dim text-green' :
                                e.status === 'published' ? 'bg-cyan-dim text-cyan' :
                                'bg-white/[0.05] text-gray-muted'
                              }`}>
                                {e.status === 'live' ? '● AN DIRÈK' : e.status === 'published' ? 'PIBLIYE' : e.status === 'draft' ? 'BOUYON' : 'PASE'}
                              </span>
                              {e.isPrivate && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange/20 text-orange border border-orange/30">🔒 PRIVE</span>}
                            </div>
                            <p className="text-xs text-gray-light mt-0.5">📅 {e.startDate || (e as any).date || '—'} · 🎫 {evTickets.length} tikè vann</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-heading text-2xl">${evRevenue.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-muted">{evTickets.length} tikè</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ RESELLERS TAB ═══ */}
          {tab === 'resellers' && <ResellersTab />}

          {/* ═══ REVENUE TAB ═══ */}
          {tab === 'revenue' && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                {[
                  { label: t('revenue_total').toUpperCase(),     value: `$${totalRevenue.toLocaleString()}` },
                  { label: 'VANT ONLINE',      value: `$${onlineRevenue.toLocaleString()}`, sub: totalRevenue > 0 ? `${Math.round(onlineRevenue / totalRevenue * 100)}% total` : '—', color: 'text-green' },
                  { label: 'VANT REVANDÈ',     value: `$${vendorTicketRevenue.toLocaleString()}`, sub: totalRevenue > 0 ? `${Math.round(vendorTicketRevenue / totalRevenue * 100)}% total` : '—', color: 'text-orange' },
                  { label: 'REVANDÈ DWE',      value: `$${totalVendorOwed.toLocaleString()}`, color: 'text-orange' },
                ].map((s, i) => (
                  <div key={i} className="bg-dark-card border border-border rounded-card p-4">
                    <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">{s.label}</p>
                    <p className={`font-heading text-3xl ${s.color || ''}`}>{s.value}</p>
                    {s.sub && <p className={`text-[10px] mt-1 ${s.color || 'text-gray-muted'}`}>{s.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Vendor balance table */}
              <div className="bg-dark-card border border-border rounded-card p-5">
                <h3 className="font-heading text-lg tracking-wide mb-3">BALANS REVANDÈ</h3>
                {vendorStats.length === 0 ? (
                  <p className="text-gray-muted text-sm text-center py-6">Pa gen revandè ankò.</p>
                ) : (
                  <div className="space-y-2.5">
                    {vendorStats.map(v => (
                      <div key={v.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <span className="text-base">🏪</span>
                        <p className="text-xs font-semibold flex-1">{v.name}</p>
                        <p className="text-xs text-gray-light">{v.totalVSold} tikè vann</p>
                        {v.totalOwed > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-orange">${v.totalOwed.toLocaleString()}</span>
                            <button className="px-2.5 py-1 rounded-lg bg-orange text-white text-[9px] font-bold hover:bg-orange/80 transition-all">Mande</button>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-green">✓ Regle</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ ANALYTICS TAB ═══ */}
          {tab === 'analytics' && (
            <AnalyticsPanel allTickets={allTickets} events={events} />
          )}

          {/* ═══ SCANNER TAB ═══ */}
          {tab === 'scanner' && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📱</div>
              <h3 className="font-heading text-2xl tracking-wide mb-2">{t('qr_scanner').toUpperCase()}</h3>
              <p className="text-xs text-gray-light mb-6 max-w-sm mx-auto">Pou eskanè tikè, ouvri paj eskanè a oswa itilize kamera aparèy ou.</p>
              <Link href="/organizer/scanner" className="inline-flex px-6 py-3 rounded-lg bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">
                Ouvri Eskanè →
              </Link>
            </div>
          )}

          {/* ═══ SETTINGS TAB ═══ */}
          {tab === 'settings' && (
            <div className="max-w-2xl">
              <h3 className="font-heading text-lg tracking-wide mb-4">{t('account_settings').toUpperCase()}</h3>

              <div className="bg-dark-card border border-border rounded-card p-5 space-y-3.5 mb-5">
                <p className="text-[10px] uppercase tracking-widest text-orange font-bold">Enfòmasyon Biznis</p>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Non Biznis</label>
                  <input defaultValue={orgProfile.bizName} className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Imèl</label>
                    <input defaultValue={user?.email || ''} className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange" /></div>
                  <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Telefòn</label>
                    <input placeholder="+509 ..." className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange" /></div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="bg-dark-card border border-border rounded-card p-5 mb-5">
                <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">Metòd Peman — Resevwa Lajan</p>
                <p className="text-[10px] text-gray-light mb-4">Chwazi kijan ou vle resevwa lajan vant tikè ou yo.</p>

                {[
                  { icon: '📱', name: 'MonCash',       active: true,  fields: ['Nimewo MonCash', 'Non sou kont lan'] },
                  { icon: '💚', name: 'Natcash',        active: false, fields: ['Nimewo Natcash', 'Non sou kont lan'] },
                  { icon: '⚡', name: 'Zelle',          active: false, fields: ['Imèl oswa Telefòn Zelle', 'Non sou kont lan'] },
                  { icon: '🅿️', name: 'PayPal',         active: false, fields: ['Imèl PayPal'] },
                  { icon: '💲', name: 'Cash App',       active: false, fields: ['$cashtag'] },
                ].map(m => (
                  <div key={m.name} className="border border-border rounded-xl p-4 mb-3 hover:border-white/[0.1] transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl">{m.icon}</span>
                      <div className="flex-1"><p className="text-xs font-bold">{m.name}</p></div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${m.active ? 'bg-green-dim text-green' : 'bg-white/[0.05] text-gray-muted'}`}>
                        {m.active ? 'AKTIF' : 'PA AKTIF'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {m.fields.map(f => (
                        <div key={f}><label className="block text-[10px] font-semibold text-gray-muted mb-1">{f}</label>
                          <input placeholder={f} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button className="px-5 py-2.5 rounded-[10px] bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
                Anrejistre Chanjman
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
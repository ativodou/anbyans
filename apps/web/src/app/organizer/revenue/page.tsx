'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { useT } from '@/i18n';
import { getOrganizerEvents, type EventData } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useOrganizerEvent } from '../OrganizerEventContext';

interface VendorData {
  id: string;
  name: string;
  organizerId: string;
}

interface VendorPurchase {
  id: string;
  vendorId: string;
  vendorName: string;
  eventId: string;
  qty: number;
  sold: number;
  priceEach: number;
  totalPaid: number;
}

export default function OrganizerRevenuePage() {
  const { user } = useAuth();
  const { fmt } = useCurrency(user?.uid);
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  const { selectedEvent } = useOrganizerEvent();
  const [viewMode, setViewMode] = useState<'all' | 'selected'>('selected');

  const [events, setEvents] = useState<EventData[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [vendorPurchases, setVendorPurchases] = useState<VendorPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      try {
        const evs = await getOrganizerEvents(user.uid);
        setEvents(evs);
        const tickets: any[] = [];
        await Promise.all(evs.map(async (e) => {
          if (!e.id) return;
          const snap = await getDocs(collection(db, 'events', e.id, 'tickets'));
          snap.docs.forEach(d => tickets.push({ id: d.id, eventId: e.id, ...d.data() }));
        }));
        setAllTickets(tickets);

        const vSnap = await getDocs(query(collection(db, 'vendors'), where('organizerId', '==', user.uid)));
        setVendors(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorData)));

        const vpSnap = await getDocs(query(collection(db, 'vendorPurchases'), where('organizerId', '==', user.uid)));
        setVendorPurchases(vpSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPurchase)));
        // F&B sales — placeholder until staff F&B logging is built
        // const fbSnap = await getDocs(query(collection(db, 'fbSales'), where('organizerId', '==', user.uid)));
        // setFbSales(fbSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('revenue load', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  // ── Filter by view mode ──
  const filteredTickets = viewMode === 'selected' && selectedEvent
    ? allTickets.filter(t => t.eventId === selectedEvent.id)
    : allTickets;

  const filteredVendorPurchases = viewMode === 'selected' && selectedEvent
    ? vendorPurchases.filter(vp => vp.eventId === selectedEvent.id)
    : vendorPurchases;

  const validTickets        = filteredTickets.filter(t => t.status !== 'cancelled' && t.status !== 'refunded');
  const totalRevenue        = validTickets.reduce((a, t) => a + (t.price || 0), 0);
  const vendorTicketRevenue = validTickets.filter(t => t.vendorId).reduce((a, t) => a + (t.price || 0), 0);
  const onlineRevenue       = totalRevenue - vendorTicketRevenue;

  const vendorStats = vendors.map(v => {
    const purchases  = filteredVendorPurchases.filter(vp => vp.vendorId === v.id);
    const totalVSold = purchases.reduce((a, vp) => a + vp.sold, 0);
    const totalOwed  = purchases.reduce((a, vp) => a + vp.sold * vp.priceEach, 0);
    return { ...v, totalVSold, totalOwed };
  }).filter(v => v.totalVSold > 0 || viewMode === 'all');
  const totalVendorOwed = vendorStats.reduce((a, v) => a + v.totalOwed, 0);

  // ── Daily sales chart data (last 14 days) ──
  const dailyData = (() => {
    const days: { label: string; revenue: number; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const dayTickets = validTickets.filter(t => {
        if (!t.purchasedAt?.seconds) return false;
        const td = new Date(t.purchasedAt.seconds * 1000);
        return td.getDate() === d.getDate() && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
      });
      days.push({ label, revenue: dayTickets.reduce((a, t) => a + (t.price || 0), 0), count: dayTickets.length });
    }
    return days;
  })();
  const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1);

  // ── Section breakdown ──
  const sectionMap: Record<string, { count: number; revenue: number; color: string }> = {};
  validTickets.forEach(t => {
    const sec = t.section || 'GA';
    if (!sectionMap[sec]) sectionMap[sec] = { count: 0, revenue: 0, color: t.sectionColor || '#888' };
    sectionMap[sec].count++;
    sectionMap[sec].revenue += t.price || 0;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div>

      {/* ── Toggle ── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-lg tracking-wide">
          {viewMode === 'all'
            ? L('Tout Evènman', 'All Events', 'Tous les événements')
            : selectedEvent?.name || L('Evènman Chwazi', 'Selected Event', 'Événement sélectionné')}
        </h2>
        <div className="flex items-center gap-1 bg-white/[0.04] border border-border rounded-lg p-1">
          <button onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all ${viewMode === 'all' ? 'bg-orange text-white' : 'text-gray-muted hover:text-white'}`}>
            {L('Tout', 'All', 'Tous')}
          </button>
          <button onClick={() => setViewMode('selected')} disabled={!selectedEvent}
            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all ${
              viewMode === 'selected' ? 'bg-orange text-white' :
              !selectedEvent ? 'text-gray-muted/40 cursor-not-allowed' :
              'text-gray-muted hover:text-white'
            }`}>
            {selectedEvent
              ? selectedEvent.name.length > 18 ? selectedEvent.name.slice(0, 18) + '…' : selectedEvent.name
              : L('Chwazi evènman', 'Select event', 'Choisir')}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: L('REVNI TOTAL', 'TOTAL REVENUE', 'REVENU TOTAL'),        value: fmt(totalRevenue).usd, htg: fmt(totalRevenue).htg,           sub: `${validTickets.length} ${L('tikè', 'tickets', 'billets')}` },
          { label: L('VANT ONLINE', 'ONLINE SALES', 'VENTES EN LIGNE'),       value: fmt(onlineRevenue).usd, htg: fmt(onlineRevenue).htg,           sub: totalRevenue > 0 ? `${Math.round(onlineRevenue / totalRevenue * 100)}% total` : '—', color: 'text-green' },
          { label: L('VANT REVANDÈ', 'RESELLER SALES', 'VENTES REVENDEURS'), value: fmt(vendorTicketRevenue).usd, htg: fmt(vendorTicketRevenue).htg,     sub: totalRevenue > 0 ? `${Math.round(vendorTicketRevenue / totalRevenue * 100)}% total` : '—', color: 'text-orange' },
          { label: L('REVANDÈ DWE', 'RESELLERS OWE', 'REVENDEURS DWE'),      value: fmt(totalVendorOwed).usd, htg: fmt(totalVendorOwed).htg,         color: totalVendorOwed > 0 ? 'text-orange' : 'text-green' },
          { label: L('MANJE & BWESON', 'FOOD & DRINKS', 'NOURRITURE & BOISSONS'), value: '$0', sub: L('Poko disponib', 'Coming soon', 'Bientôt disponible'), color: 'text-gray-muted' },
        ].map((s, i) => (
          <div key={i} className="bg-dark-card border border-border rounded-card p-4">
            <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">{s.label}</p>
            <p className={`font-heading text-3xl tracking-wide ${s.color || ''}`}>{s.value}</p>
            {s.sub && <p className={`text-[10px] mt-1 ${s.color || 'text-gray-muted'}`}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Daily Revenue Chart ── */}
      <div className="bg-dark-card border border-border rounded-card p-5 mb-6">
        <h3 className="font-heading text-sm tracking-widest text-gray-muted uppercase mb-4">
          {L('VANT 14 DÈNYE JOU', 'LAST 14 DAYS', '14 DERNIERS JOURS')}
        </h3>
        <div className="flex items-end gap-1 h-28">
          {dailyData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-dark border border-border rounded px-1.5 py-0.5 text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {fmt(d.revenue).usd} · {d.count} {L('tikè', 'tickets', 'billets')}
              </div>
              <div
                className="w-full rounded-t transition-all bg-orange/70 hover:bg-orange"
                style={{ height: `${Math.max((d.revenue / maxRevenue) * 100, d.revenue > 0 ? 4 : 0)}%` }}
              />
              <span className="text-[8px] text-gray-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Section Breakdown ── */}
        <div className="bg-dark-card border border-border rounded-card p-5">
          <h3 className="font-heading text-lg tracking-wide mb-4">{L('PA SEKSYON', 'BY SECTION', 'PAR SECTION')}</h3>
          {Object.keys(sectionMap).length === 0 ? (
            <p className="text-gray-muted text-sm text-center py-6">{L('Pa gen done.', 'No data.', 'Aucune donnée.')}</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(sectionMap).sort((a, b) => b[1].revenue - a[1].revenue).map(([sec, data]) => (
                <div key={sec}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: data.color }} />
                      <span className="text-xs font-bold">{sec}</span>
                      <span className="text-[10px] text-gray-muted">{data.count} {L('tikè', 'tickets', 'billets')}</span>
                    </div>
                    <span className="text-xs font-bold">${fmt(data.revenue).usd}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(data.revenue / totalRevenue) * 100}%`, background: data.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Reseller Balances ── */}
        <div className="bg-dark-card border border-border rounded-card p-5">
          <h3 className="font-heading text-lg tracking-wide mb-4">{L('BALANS REVANDÈ', 'RESELLER BALANCES', 'BALANCES REVENDEURS')}</h3>
          {vendorStats.length === 0 ? (
            <p className="text-gray-muted text-sm text-center py-6">{L('Pa gen revandè ankò.', 'No resellers yet.', "Aucun revendeur pour l'instant.")}</p>
          ) : (
            <div className="space-y-2">
              {vendorStats.map(v => (
                <div key={v.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <span className="text-base">🏪</span>
                  <p className="text-xs font-semibold flex-1">{v.name}</p>
                  <p className="text-xs text-gray-light">{v.totalVSold} {L('tikè', 'tickets', 'billets')}</p>
                  {v.totalOwed > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-orange">${fmt(v.totalOwed).usd} / {fmt(v.totalOwed).htg}</span>
                      <button className="px-2.5 py-1 rounded-lg bg-orange text-white text-[9px] font-bold hover:bg-orange/80 transition-all">
                        {L('Mande', 'Request', 'Demander')}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-green">✓ {L('Regle', 'Settled', 'Réglé')}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
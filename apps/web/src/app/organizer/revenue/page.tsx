'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { PriceDisplay } from '@/hooks/PriceDisplay';
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
  const { t } = useT();

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
    ? allTickets.filter(tk => tk.eventId === selectedEvent.id)
    : allTickets;

  const filteredVendorPurchases = viewMode === 'selected' && selectedEvent
    ? vendorPurchases.filter(vp => vp.eventId === selectedEvent.id)
    : vendorPurchases;

  const validTickets        = filteredTickets.filter(tk => tk.status !== 'cancelled' && tk.status !== 'refunded');
  const totalRevenue        = validTickets.reduce((a, tk) => a + (tk.price || 0), 0);
  const vendorTicketRevenue = validTickets.filter(tk => tk.vendorId).reduce((a, tk) => a + (tk.price || 0), 0);
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
      const dayTickets = validTickets.filter(tk => {
        if (!tk.purchasedAt?.seconds) return false;
        const td = new Date(tk.purchasedAt.seconds * 1000);
        return td.getDate() === d.getDate() && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
      });
      days.push({ label, revenue: dayTickets.reduce((a, tk) => a + (tk.price || 0), 0), count: dayTickets.length });
    }
    return days;
  })();
  const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1);

  // ── Section breakdown ──
  const sectionMap: Record<string, { count: number; revenue: number; color: string }> = {};
  validTickets.forEach(tk => {
    const sec = tk.section || 'GA';
    if (!sectionMap[sec]) sectionMap[sec] = { count: 0, revenue: 0, color: tk.sectionColor || '#888' };
    sectionMap[sec].count++;
    sectionMap[sec].revenue += tk.price || 0;
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
            ? t('rev_all_events')
            : selectedEvent?.name || t('rev_selected_event')}
        </h2>
        <div className="flex items-center gap-1 bg-white/[0.04] border border-border rounded-lg p-1">
          <button onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all ${viewMode === 'all' ? 'bg-orange text-white' : 'text-gray-muted hover:text-white'}`}>
            {t('all')}
          </button>
          <button onClick={() => setViewMode('selected')} disabled={!selectedEvent}
            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all ${
              viewMode === 'selected' ? 'bg-orange text-white' :
              !selectedEvent ? 'text-gray-muted/40 cursor-not-allowed' :
              'text-gray-muted hover:text-white'
            }`}>
            {selectedEvent
              ? selectedEvent.name.length > 18 ? selectedEvent.name.slice(0, 18) + '…' : selectedEvent.name
              : t('rev_select_event')}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: t('rev_total_revenue'),   value: '__PRICE__', priceUsd: totalRevenue,       sub: `${validTickets.length} ${t('rev_ticket_count')}` },
          { label: t('rev_online_sales'),    value: '__PRICE__', priceUsd: onlineRevenue,       sub: totalRevenue > 0 ? `${Math.round(onlineRevenue / totalRevenue * 100)}% total` : '—', color: 'text-green' },
          { label: t('rev_reseller_sales'),  value: '__PRICE__', priceUsd: vendorTicketRevenue, sub: totalRevenue > 0 ? `${Math.round(vendorTicketRevenue / totalRevenue * 100)}% total` : '—', color: 'text-orange' },
          { label: t('rev_resellers_owe'),   value: '__PRICE__', priceUsd: totalVendorOwed,     color: totalVendorOwed > 0 ? 'text-orange' : 'text-green' },
          { label: t('rev_food_bev'),        value: '$0', sub: t('rev_coming_soon'), color: 'text-gray-muted' },
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
          {t('rev_sales_chart')}
        </h3>
        <div className="flex items-end gap-1 h-28">
          {dailyData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-dark border border-border rounded px-1.5 py-0.5 text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <PriceDisplay usd={d.revenue} fmt={fmt} className="text-[10px]" /> · {d.count} {t('rev_ticket_count')}
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
          <h3 className="font-heading text-lg tracking-wide mb-4">{t('rev_by_section')}</h3>
          {Object.keys(sectionMap).length === 0 ? (
            <p className="text-gray-muted text-sm text-center py-6">{t('rev_no_data')}</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(sectionMap).sort((a, b) => b[1].revenue - a[1].revenue).map(([sec, data]) => (
                <div key={sec}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: data.color }} />
                      <span className="text-xs font-bold">{sec}</span>
                      <span className="text-[10px] text-gray-muted">{data.count} {t('rev_ticket_count')}</span>
                    </div>
                    <span className="text-xs font-bold"><PriceDisplay usd={data.revenue} fmt={fmt} className="text-xs" /></span>
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
          <h3 className="font-heading text-lg tracking-wide mb-4">{t('rev_reseller_balance')}</h3>
          {vendorStats.length === 0 ? (
            <p className="text-gray-muted text-sm text-center py-6">{t('rev_no_resellers')}</p>
          ) : (
            <div className="space-y-2">
              {vendorStats.map(v => (
                <div key={v.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <span className="text-base">🏪</span>
                  <p className="text-xs font-semibold flex-1">{v.name}</p>
                  <p className="text-xs text-gray-light">{v.totalVSold} {t('rev_ticket_count')}</p>
                  {v.totalOwed > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold"><PriceDisplay usd={v.totalOwed} fmt={fmt} className="text-xs" /></span>
                      <button className="px-2.5 py-1 rounded-lg bg-orange text-white text-[9px] font-bold hover:bg-orange/80 transition-all">
                        {t('rev_request')}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-green">✓ {t('rev_settled')}</span>
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
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

type ATab = 'spenders' | 'loyal' | 'sections' | 'events' | 'vendors';

export default function OrganizerAnalyticsPage() {
  const { user } = useAuth();
  const { fmt } = useCurrency(user?.uid);
  const { t } = useT();

  const { selectedEvent } = useOrganizerEvent();
  const [viewMode, setViewMode] = useState<'all' | 'selected'>('selected');

  const [events, setEvents] = useState<EventData[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aTab, setATab] = useState<ATab>('spenders');

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      try {
        const evs = await getOrganizerEvents(user.uid);
        setEvents(evs);
        const snap = await getDocs(query(collection(db, 'tickets'), where('organizerId', '==', user.uid)));
        setAllTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('analytics load', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  const filteredTickets = viewMode === 'selected' && selectedEvent
    ? allTickets.filter(tk => tk.eventId === selectedEvent.id)
    : allTickets;
  const validTickets = filteredTickets.filter(tk => tk.status !== 'cancelled' && tk.status !== 'refunded');

  // Buyer stats
  const byBuyer: Record<string, { name: string; phone: string; total: number; count: number; events: Set<string>; sections: Record<string, number> }> = {};
  validTickets.forEach(tk => {
    const key = tk.buyerPhone || tk.buyerEmail || 'unknown';
    if (!byBuyer[key]) byBuyer[key] = { name: tk.buyerName || key, phone: key, total: 0, count: 0, events: new Set(), sections: {} };
    byBuyer[key].total += tk.price || 0;
    byBuyer[key].count += 1;
    if (tk.eventId) byBuyer[key].events.add(tk.eventId);
    const sec = tk.section || 'General';
    byBuyer[key].sections[sec] = (byBuyer[key].sections[sec] || 0) + 1;
  });

  const buyers = Object.values(byBuyer).map(b => ({
    ...b,
    eventCount: b.events.size,
    favSection: Object.entries(b.sections).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
  }));
  const topSpenders = [...buyers].sort((a, b) => b.total - a.total).slice(0, 10);
  const topLoyal    = [...buyers].sort((a, b) => b.eventCount - a.eventCount || b.count - a.count).slice(0, 10);

  // Section stats
  const sectionTotals: Record<string, number> = {};
  validTickets.forEach(tk => { const s = tk.section || 'General'; sectionTotals[s] = (sectionTotals[s] || 0) + 1; });
  const topSections = Object.entries(sectionTotals).sort((a, b) => b[1] - a[1]);
  const maxSec = topSections[0]?.[1] || 1;

  // Revenue by event
  const revByEvent: Record<string, { name: string; rev: number; count: number }> = {};
  validTickets.forEach(tk => {
    const ev = events.find(e => e.id === tk.eventId);
    const name = ev?.name || tk.eventId || '?';
    if (!revByEvent[tk.eventId]) revByEvent[tk.eventId] = { name, rev: 0, count: 0 };
    revByEvent[tk.eventId].rev += tk.price || 0;
    revByEvent[tk.eventId].count += 1;
  });
  const revEvents = Object.values(revByEvent).sort((a, b) => b.rev - a.rev);
  const maxRev = revEvents[0]?.rev || 1;

  const rankStyle = (i: number) =>
    i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
    i === 1 ? 'bg-gray-400/20 text-gray-300' :
    i === 2 ? 'bg-orange/20 text-orange' :
              'bg-white/[0.05] text-gray-muted';

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  if (validTickets.length === 0) return (
    <div className="text-center py-24">
      <div className="text-6xl mb-4">📈</div>
      <p className="text-gray-muted">{t('analytics_empty')}</p>
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: t('analytics_total_buyers'),  value: buyers.length,                                                         icon: '👤', color: 'text-white' },
          { label: t('analytics_loyal_2plus'),   value: buyers.filter(b => b.eventCount >= 2).length,                          icon: '⭐', color: 'text-orange' },
          { label: t('analytics_tickets_sold'),  value: validTickets.length,                                                    icon: '🎫', color: 'text-green' },
          { label: t('analytics_avg_spend_per'), value: '$' + (buyers.length ? (buyers.reduce((s, b) => s + b.total, 0) / buyers.length).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'), icon: '💰', color: 'text-cyan' },
        ].map(k => (
          <div key={k.label} className="bg-dark-card border border-border rounded-card p-4">
            <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1">{k.icon} {k.label}</p>
            <p className={`font-heading text-3xl tracking-wide ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {([
          ['spenders', `💸 ${t('analytics_tab_top_spenders')}`],
          ['loyal',    `⭐ ${t('analytics_tab_loyal')}`],
          ['sections', `🎯 ${t('analytics_tab_sections')}`],
          ['events',   `📅 ${t('analytics_tab_events')}`],
          ['vendors',  `🏪 ${t('analytics_tab_resellers')}`],
        ] as [ATab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setATab(k)}
            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              aTab === k ? 'bg-orange text-white' : 'bg-dark-card border border-border text-gray-light hover:text-white'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Top Spenders */}
      {aTab === 'spenders' && (
        <div className="bg-dark-card border border-border rounded-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <p className="text-[10px] uppercase tracking-widest text-orange font-bold">💸 {t('analytics_top_spenders')}</p>
          </div>
          {topSpenders.map((b, i) => (
            <div key={b.phone} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-white/[0.02] transition-all">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${rankStyle(i)}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{b.name}</p>
                <p className="text-[10px] text-gray-muted">{b.phone} · {b.count} {t('analytics_col_tickets')} · {b.eventCount} {t('analytics_col_events')}</p>
              </div>
              <div className="text-right">
                <p className="font-bold"><PriceDisplay usd={b.total} fmt={fmt} className="text-sm" /></p>
                <p className="text-[9px] text-gray-muted">{b.favSection}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Most Loyal */}
      {aTab === 'loyal' && (
        <div className="bg-dark-card border border-border rounded-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <p className="text-[10px] uppercase tracking-widest text-orange font-bold">⭐ {t('analytics_top_loyal')}</p>
          </div>
          {topLoyal.map((b, i) => (
            <div key={b.phone} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-white/[0.02] transition-all">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${rankStyle(i)}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{b.name}</p>
                <p className="text-[10px] text-gray-muted">{b.phone}</p>
              </div>
              <div className="flex gap-1 items-center">
                {[...Array(Math.min(b.eventCount, 5))].map((_, j) => <span key={j} className="text-orange text-xs">⭐</span>)}
                <div className="text-right ml-2">
                  <p className="text-xs font-bold">{b.eventCount} {t('analytics_col_events')}</p>
                  <p className="text-[10px] text-gray-muted">{b.count} {t('analytics_col_tickets')} · <PriceDisplay usd={b.total} fmt={fmt} className="text-[10px]" /></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sections */}
      {aTab === 'sections' && (
        <div className="bg-dark-card border border-border rounded-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">🎯 {t('analytics_section_popularity')}</p>
          <div className="space-y-4">
            {topSections.map(([sec, cnt]) => (
              <div key={sec}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-bold">{sec}</span>
                  <span className="text-gray-muted">{cnt} {t('analytics_col_tickets')} ({Math.round(cnt / validTickets.length * 100)}%)</span>
                </div>
                <div className="w-full bg-white/[0.05] rounded-full h-2.5">
                  <div className="bg-orange h-2.5 rounded-full transition-all" style={{ width: `${Math.round(cnt / maxSec * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events breakdown */}
      {aTab === 'events' && (
        <div className="space-y-3">
          {revEvents.length === 0 ? (
            <div className="bg-dark-card border border-border rounded-card p-10 text-center">
              <p className="text-gray-muted text-sm">{t('analytics_no_data')}</p>
            </div>
          ) : revEvents.map(ev => {
            const evObj = events.find(e => e.name === ev.name);
            const cap = (evObj?.sections || []).reduce((a: number, s: any) => a + (s.capacity || 0), 0);
            const fillPct = cap > 0 ? Math.round((ev.count / cap) * 100) : null;
            const admitted = allTickets.filter(tk => tk.eventId === evObj?.id && tk.status === 'used').length;
            const attendPct = ev.count > 0 ? Math.round((admitted / ev.count) * 100) : 0;
            const avgPrice = ev.count > 0 ? Math.round(ev.rev / ev.count) : 0;
            const onlineCount = validTickets.filter(tk => tk.eventId === evObj?.id && !tk.vendorId).length;
            const resellerCount = ev.count - onlineCount;
            const onlinePct = ev.count > 0 ? Math.round((onlineCount / ev.count) * 100) : 0;

            return (
              <div key={ev.name} className="bg-dark-card border border-border rounded-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-sm truncate flex-1 mr-4">{ev.name}</p>
                  <p className="flex-shrink-0"><PriceDisplay usd={ev.rev} fmt={fmt} className="text-base" /></p>
                </div>

                {/* Section breakdown */}
                {(() => {
                  const secMap: Record<string, { count: number; rev: number; color: string }> = {};
                  validTickets.filter(tk => tk.eventId === evObj?.id).forEach((tk: any) => {
                    const s = tk.section || 'GA';
                    if (!secMap[s]) secMap[s] = { count: 0, rev: 0, color: tk.sectionColor || '#888' };
                    secMap[s].count++;
                    secMap[s].rev += tk.price || 0;
                  });
                  const secEntries = Object.entries(secMap).sort((a, b) => b[1].rev - a[1].rev);
                  if (secEntries.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {secEntries.map(([sec, data]) => (
                        <div key={sec} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-border">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: data.color }} />
                          <span className="text-[10px] font-bold">{sec}</span>
                          <span className="text-[10px] text-gray-muted">{data.count} {t('analytics_col_tickets')}</span>
                          <span className="text-[10px]"><PriceDisplay usd={data.rev} fmt={fmt} className="text-[10px]" /></span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Revenue per section */}
                {(() => {
                  const secMap: Record<string, { count: number; rev: number; color: string }> = {};
                  validTickets.filter((tk: any) => tk.eventId === evObj?.id).forEach((tk: any) => {
                    const s = tk.section || 'GA';
                    if (!secMap[s]) secMap[s] = { count: 0, rev: 0, color: tk.sectionColor || '#888' };
                    secMap[s].count++;
                    secMap[s].rev += tk.price || 0;
                  });
                  const entries = Object.entries(secMap).sort((a, b) => b[1].rev - a[1].rev);
                  const totalSecRev = entries.reduce((a, [, d]) => a + d.rev, 0);
                  if (entries.length === 0) return null;
                  return (
                    <div className="mb-3">
                      <p className="text-[9px] uppercase tracking-widest text-gray-muted mb-2">{t('analytics_revenue_section')}</p>
                      <div className="space-y-2">
                        {entries.map(([sec, data]) => (
                          <div key={sec}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: data.color }} />
                              <span className="text-[11px] font-bold flex-1">{sec}</span>
                              <span className="text-[10px] text-gray-muted">{data.count} {t('analytics_col_tickets')}</span>
                              <span className="text-[11px]"><PriceDisplay usd={data.rev} fmt={fmt} className="text-[11px]" /></span>
                              <span className="text-[9px] text-gray-muted w-8 text-right">{totalSecRev > 0 ? Math.round((data.rev / totalSecRev) * 100) : 0}%</span>
                            </div>
                            <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${totalSecRev > 0 ? Math.round((data.rev / totalSecRev) * 100) : 0}%`, background: data.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  {/* Tickets sold */}
                  <div className="bg-white/[0.03] rounded-lg p-2.5">
                    <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">🎫 {t('tickets')}</p>
                    <p className="text-sm font-bold">{ev.count}{cap > 0 ? <span className="text-gray-muted font-normal text-[10px]">/{cap}</span> : ''}</p>
                    {fillPct !== null && (
                      <div className="mt-1.5 w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-orange rounded-full" style={{ width: `${fillPct}%` }} />
                      </div>
                    )}
                    {fillPct !== null && <p className="text-[9px] text-orange mt-0.5">{fillPct}% {t('analytics_fill_rate')}</p>}
                  </div>

                  {/* Attendance */}
                  <div className="bg-white/[0.03] rounded-lg p-2.5">
                    <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">🚪 {t('analytics_attended')}</p>
                    <p className="text-sm font-bold text-green">{admitted}<span className="text-gray-muted font-normal text-[10px]">/{ev.count}</span></p>
                    <div className="mt-1.5 w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${attendPct}%` }} />
                    </div>
                    <p className="text-[9px] text-green mt-0.5">{attendPct}% {t('analytics_attend_rate')}</p>
                  </div>

                  {/* Avg price */}
                  <div className="bg-white/[0.03] rounded-lg p-2.5">
                    <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">💰 {t('analytics_avg_ticket')}</p>
                    <p className="font-bold"><PriceDisplay usd={avgPrice} fmt={fmt} className="text-sm" /></p>
                    <p className="text-[9px] text-gray-muted mt-1">{t('analytics_col_avg_price')}</p>
                  </div>

                  {/* Online vs reseller */}
                  <div className="bg-white/[0.03] rounded-lg p-2.5">
                    <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">🌐 {t('analytics_channel')}</p>
                    <p className="text-sm font-bold">{onlinePct}% <span className="text-[10px] text-gray-muted font-normal">online</span></p>
                    <p className="text-[9px] text-gray-muted mt-1">{resellerCount} {t('analytics_col_reseller')}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vendors */}
      {aTab === 'vendors' && (() => {
        const vendorMap: Record<string, { name: string; sections: Record<string, { count: number; rev: number }>; total: number; totalRev: number }> = {};
        validTickets.filter((tk: any) => tk.vendorId).forEach((tk: any) => {
          const vid = tk.vendorId;
          const vname = tk.vendorName || vid;
          if (!vendorMap[vid]) vendorMap[vid] = { name: vname, sections: {}, total: 0, totalRev: 0 };
          const sec = tk.section || 'GA';
          if (!vendorMap[vid].sections[sec]) vendorMap[vid].sections[sec] = { count: 0, rev: 0 };
          vendorMap[vid].sections[sec].count++;
          vendorMap[vid].sections[sec].rev += tk.price || 0;
          vendorMap[vid].total++;
          vendorMap[vid].totalRev += tk.price || 0;
        });
        const entries = Object.entries(vendorMap).sort((a, b) => b[1].totalRev - a[1].totalRev);
        if (entries.length === 0) return (
          <div className="bg-dark-card border border-border rounded-card p-10 text-center">
            <p className="text-4xl mb-2">🏪</p>
            <p className="text-gray-muted text-sm">{t('analytics_no_resellers')}</p>
          </div>
        );
        return (
          <div className="space-y-3">
            {entries.map(([vid, v]) => {
              const secEntries = Object.entries(v.sections).sort((a, b) => b[1].rev - a[1].rev);
              return (
                <div key={vid} className="bg-dark-card border border-border rounded-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏪</span>
                      <span className="font-bold text-sm">{v.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold"><PriceDisplay usd={v.totalRev} fmt={fmt} className="text-base" /></p>
                      <p className="text-[10px] text-gray-muted">{v.total} {t('analytics_col_tickets')}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {secEntries.map(([sec, data]) => (
                      <div key={sec} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold w-12 text-gray-light">{sec}</span>
                        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-orange rounded-full" style={{ width: `${v.total > 0 ? Math.round((data.count / v.total) * 100) : 0}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-muted w-8 text-right">{data.count}</span>
                        <span className="text-[10px] w-24 text-right"><PriceDisplay usd={data.rev} fmt={fmt} className="text-[10px]" /></span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

    </div>
  );
}
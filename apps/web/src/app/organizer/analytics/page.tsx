'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { PriceDisplay } from '@/hooks/PriceDisplay';
import { useT } from '@/i18n';
import { getOrganizerEvents, type EventData } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useOrganizerEvent } from '../OrganizerEventContext';

type ATab = 'spenders' | 'loyal' | 'sections' | 'events' | 'vendors';

export default function OrganizerAnalyticsPage() {
  const { user } = useAuth();
  const { fmt } = useCurrency(user?.uid);
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

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
        const tickets: any[] = [];
        await Promise.all(evs.map(async (e) => {
          if (!e.id) return;
          const snap = await getDocs(collection(db, 'events', e.id, 'tickets'));
          snap.docs.forEach(d => tickets.push({ id: d.id, eventId: e.id, ...d.data() }));
        }));
        setAllTickets(tickets);
      } catch (err) {
        console.error('analytics load', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  const filteredTickets = viewMode === 'selected' && selectedEvent
    ? allTickets.filter(t => t.eventId === selectedEvent.id)
    : allTickets;
  const validTickets = filteredTickets.filter(t => t.status !== 'cancelled' && t.status !== 'refunded');

  // Buyer stats
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
  const topLoyal    = [...buyers].sort((a, b) => b.eventCount - a.eventCount || b.count - a.count).slice(0, 10);

  // Section stats
  const sectionTotals: Record<string, number> = {};
  validTickets.forEach(t => { const s = t.section || 'General'; sectionTotals[s] = (sectionTotals[s] || 0) + 1; });
  const topSections = Object.entries(sectionTotals).sort((a, b) => b[1] - a[1]);
  const maxSec = topSections[0]?.[1] || 1;

  // Revenue by event
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
      <p className="text-gray-muted">{L('Pa gen done tikè ankò.', 'No ticket data yet.', 'Pas encore de données billets.')}</p>
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: L('TOTAL ACHETÈ', 'TOTAL BUYERS', 'TOTAL ACHETEURS'),          value: buyers.length,                                                     icon: '👤', color: 'text-white' },
          { label: L('FIDÈL (2+ EVÈN)', 'LOYAL (2+ EVENTS)', 'FIDÈLES (2+ ÉV.)'), value: buyers.filter(b => b.eventCount >= 2).length,                      icon: '⭐', color: 'text-orange' },
          { label: L('TIKÈ VANN', 'TICKETS SOLD', 'BILLETS VENDUS'),               value: validTickets.length,                                                icon: '🎫', color: 'text-green' },
          { label: L('DEPANS MOY/MOUN', 'AVG SPEND/PERSON', 'DÉP. MOY/PERS.'),    value: '$' + (buyers.length ? Math.round(buyers.reduce((s, b) => s + b.total, 0) / buyers.length) : 0), icon: '💰', color: 'text-cyan' },
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
          ['spenders', `💸 ${L('Top Depansè', 'Top Spenders', 'Top Dépenseurs')}`],
          ['loyal',    `⭐ ${L('Pli Fidèl',   'Most Loyal',   'Plus Fidèles')}`],
          ['sections', `🎯 ${L('Seksyon',     'Sections',     'Sections')}`],
          ['events',   `📅 ${L('Evènman',     'Events',       'Événements')}`],
          ['vendors',  `🏪 ${L('Revandè',     'Resellers',    'Revendeurs')}`],
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
            <p className="text-[10px] uppercase tracking-widest text-orange font-bold">💸 {L('TOP 10 DEPANSÈ', 'TOP 10 SPENDERS', 'TOP 10 DÉPENSEURS')}</p>
          </div>
          {topSpenders.map((b, i) => (
            <div key={b.phone} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-white/[0.02] transition-all">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${rankStyle(i)}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{b.name}</p>
                <p className="text-[10px] text-gray-muted">{b.phone} · {b.count} {L('tikè', 'tickets', 'billets')} · {b.eventCount} {L('evèn', 'events', 'évén.')}</p>
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
            <p className="text-[10px] uppercase tracking-widest text-orange font-bold">⭐ {L('PI FIDÈL — plis evènman', 'MOST LOYAL — most events', 'PLUS FIDÈLES — plus d\'événements')}</p>
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
                  <p className="text-xs font-bold">{b.eventCount} {L('evèn', 'events', 'évén.')}</p>
                  <p className="text-[10px] text-gray-muted">{b.count} {L('tikè', 'tickets', 'billets')} · <PriceDisplay usd={b.total} fmt={fmt} className="text-[10px]" /></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sections */}
      {aTab === 'sections' && (
        <div className="bg-dark-card border border-border rounded-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">🎯 {L('POPULARITE SEKSYON', 'SECTION POPULARITY', 'POPULARITÉ SECTIONS')}</p>
          <div className="space-y-4">
            {topSections.map(([sec, cnt]) => (
              <div key={sec}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-bold">{sec}</span>
                  <span className="text-gray-muted">{cnt} {L('tikè', 'tickets', 'billets')} ({Math.round(cnt / validTickets.length * 100)}%)</span>
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
              <p className="text-gray-muted text-sm">{L('Pa gen done.', 'No data.', 'Aucune donnée.')}</p>
            </div>
          ) : revEvents.map(ev => {
            const evObj = events.find(e => e.name === ev.name);
            const cap = (evObj?.sections || []).reduce((a: number, s: any) => a + (s.capacity || 0), 0);
            const fillPct = cap > 0 ? Math.round((ev.count / cap) * 100) : null;
            const admitted = allTickets.filter(t => t.eventId === evObj?.id && t.status === 'used').length;
            const attendPct = ev.count > 0 ? Math.round((admitted / ev.count) * 100) : 0;
            const avgPrice = ev.count > 0 ? Math.round(ev.rev / ev.count) : 0;
            const onlineCount = validTickets.filter(t => t.eventId === evObj?.id && !t.vendorId).length;
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
                  validTickets.filter(t => t.eventId === evObj?.id).forEach((t: any) => {
                    const s = t.section || 'GA';
                    if (!secMap[s]) secMap[s] = { count: 0, rev: 0, color: t.sectionColor || '#888' };
                    secMap[s].count++;
                    secMap[s].rev += t.price || 0;
                  });
                  const secEntries = Object.entries(secMap).sort((a, b) => b[1].rev - a[1].rev);
                  if (secEntries.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {secEntries.map(([sec, data]) => (
                        <div key={sec} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-border">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: data.color }} />
                          <span className="text-[10px] font-bold">{sec}</span>
                          <span className="text-[10px] text-gray-muted">{data.count} {L('tikè', 'tickets', 'billets')}</span>
                          <span className="text-[10px]"><PriceDisplay usd={data.rev} fmt={fmt} className="text-[10px]" /></span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Revenue per section */}
                {(() => {
                  const secMap: Record<string, { count: number; rev: number; color: string }> = {};
                  validTickets.filter((t: any) => t.eventId === evObj?.id).forEach((t: any) => {
                    const s = t.section || 'GA';
                    if (!secMap[s]) secMap[s] = { count: 0, rev: 0, color: t.sectionColor || '#888' };
                    secMap[s].count++;
                    secMap[s].rev += t.price || 0;
                  });
                  const entries = Object.entries(secMap).sort((a, b) => b[1].rev - a[1].rev);
                  const totalSecRev = entries.reduce((a, [, d]) => a + d.rev, 0);
                  if (entries.length === 0) return null;
                  return (
                    <div className="mb-3">
                      <p className="text-[9px] uppercase tracking-widest text-gray-muted mb-2">{L('Revni pa Seksyon', 'Revenue by Section', 'Revenu par Section')}</p>
                      <div className="space-y-2">
                        {entries.map(([sec, data]) => (
                          <div key={sec}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: data.color }} />
                              <span className="text-[11px] font-bold flex-1">{sec}</span>
                              <span className="text-[10px] text-gray-muted">{data.count} {L('tikè', 'tickets', 'billets')}</span>
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
                    <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">🎫 {L('Tikè', 'Tickets', 'Billets')}</p>
                    <p className="text-sm font-bold">{ev.count}{cap > 0 ? <span className="text-gray-muted font-normal text-[10px]">/{cap}</span> : ''}</p>
                    {fillPct !== null && (
                      <div className="mt-1.5 w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-orange rounded-full" style={{ width: `${fillPct}%` }} />
                      </div>
                    )}
                    {fillPct !== null && <p className="text-[9px] text-orange mt-0.5">{fillPct}% {L('ranpli', 'full', 'rempli')}</p>}
                  </div>

                  {/* Attendance */}
                  <div className="bg-white/[0.03] rounded-lg p-2.5">
                    <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">🚪 {L('Antre', 'Attended', 'Présence')}</p>
                    <p className="text-sm font-bold text-green">{admitted}<span className="text-gray-muted font-normal text-[10px]">/{ev.count}</span></p>
                    <div className="mt-1.5 w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${attendPct}%` }} />
                    </div>
                    <p className="text-[9px] text-green mt-0.5">{attendPct}% {L('prezans', 'show rate', 'présents')}</p>
                  </div>

                  {/* Avg price */}
                  <div className="bg-white/[0.03] rounded-lg p-2.5">
                    <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">💰 {L('Moy/Tikè', 'Avg/Ticket', 'Moy/Billet')}</p>
                    <p className="font-bold"><PriceDisplay usd={avgPrice} fmt={fmt} className="text-sm" /></p>
                    <p className="text-[9px] text-gray-muted mt-1">{L('pri mwayen', 'avg price', 'prix moyen')}</p>
                  </div>

                  {/* Online vs reseller */}
                  <div className="bg-white/[0.03] rounded-lg p-2.5">
                    <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">🌐 {L('Kannal', 'Channel', 'Canal')}</p>
                    <p className="text-sm font-bold">{onlinePct}% <span className="text-[10px] text-gray-muted font-normal">online</span></p>
                    <p className="text-[9px] text-gray-muted mt-1">{resellerCount} {L('revandè', 'reseller', 'revendeur')}</p>
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
        validTickets.filter((t: any) => t.vendorId).forEach((t: any) => {
          const vid = t.vendorId;
          const vname = t.vendorName || vid;
          if (!vendorMap[vid]) vendorMap[vid] = { name: vname, sections: {}, total: 0, totalRev: 0 };
          const sec = t.section || 'GA';
          if (!vendorMap[vid].sections[sec]) vendorMap[vid].sections[sec] = { count: 0, rev: 0 };
          vendorMap[vid].sections[sec].count++;
          vendorMap[vid].sections[sec].rev += t.price || 0;
          vendorMap[vid].total++;
          vendorMap[vid].totalRev += t.price || 0;
        });
        const entries = Object.entries(vendorMap).sort((a, b) => b[1].totalRev - a[1].totalRev);
        if (entries.length === 0) return (
          <div className="bg-dark-card border border-border rounded-card p-10 text-center">
            <p className="text-4xl mb-2">🏪</p>
            <p className="text-gray-muted text-sm">{L('Pa gen vant revandè ankò.', 'No reseller sales yet.', 'Aucune vente revendeur.')}</p>
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
                      <p className="text-[10px] text-gray-muted">{v.total} {L('tikè', 'tickets', 'billets')}</p>
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
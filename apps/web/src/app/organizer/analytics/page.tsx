'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getOrganizerEvents, type EventData } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

type ATab = 'spenders' | 'loyal' | 'sections' | 'events';

export default function OrganizerAnalyticsPage() {
  const { user } = useAuth();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

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

  const validTickets = allTickets.filter(t => t.status !== 'cancelled' && t.status !== 'refunded');

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
                <p className="text-sm font-black text-orange">${b.total.toLocaleString()}</p>
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
                  <p className="text-[10px] text-gray-muted">{b.count} {L('tikè', 'tickets', 'billets')} · ${b.total}</p>
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

      {/* Events revenue */}
      {aTab === 'events' && (
        <div className="bg-dark-card border border-border rounded-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">📅 {L('REVNI PA EVÈNMAN', 'REVENUE BY EVENT', 'REVENU PAR ÉVÉNEMENT')}</p>
          <div className="space-y-4">
            {revEvents.map(ev => (
              <div key={ev.name}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-bold truncate flex-1 mr-4">{ev.name}</span>
                  <span className="text-gray-muted whitespace-nowrap">${ev.rev.toLocaleString()} · {ev.count} {L('tikè', 'tickets', 'billets')}</span>
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
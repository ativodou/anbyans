'use client';

import Link from 'next/link';
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
  status?: string;
}

interface VendorPurchase {
  id: string;
  vendorId: string;
  eventId: string;
  qty: number;
  sold: number;
  priceEach: number;
  totalPaid: number;
}

export default function OrganizerDashboardPage() {
  const { user } = useAuth();
  const { fmt } = useCurrency(user?.uid);
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  const { events: contextEvents, selectedEvent } = useOrganizerEvent();

  const [events, setEvents] = useState<EventData[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [vendorPurchases, setVendorPurchases] = useState<VendorPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  // Toggle: 'all' or 'selected'
  const [viewMode, setViewMode] = useState<'all' | 'selected'>('selected');

  useEffect(() => {
    if (!user?.uid) return;
    const loadAll = async () => {
      try {
        const evs = await getOrganizerEvents(user.uid);
        setEvents(evs);
        const eventIds = evs.map(e => e.id!).filter(Boolean);

        const tickets: any[] = [];
        if (eventIds.length > 0) {
          await Promise.all(eventIds.map(async (eid) => {
            const snap = await getDocs(collection(db, 'events', eid, 'tickets'));
            snap.docs.forEach(d => tickets.push({ id: d.id, eventId: eid, ...d.data() }));
          }));
          setAllTickets(tickets);
        }

        const vSnap = await getDocs(query(collection(db, 'vendors'), where('organizerId', '==', user.uid)));
        setVendors(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorData)));

        const vpSnap = await getDocs(query(collection(db, 'vendorPurchases'), where('organizerId', '==', user.uid)));
        setVendorPurchases(vpSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPurchase)));

      } catch (e) {
        console.error('dashboard load', e);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [user?.uid]);

  // ── Filter tickets by view mode ──
  const filteredTickets = viewMode === 'selected' && selectedEvent
    ? allTickets.filter(t => t.eventId === selectedEvent.id)
    : allTickets;

  const filteredEvents = viewMode === 'selected' && selectedEvent
    ? events.filter(e => e.id === selectedEvent.id)
    : events;

  const validTickets   = filteredTickets.filter(t => t.status !== 'cancelled' && t.status !== 'refunded');
  const totalRevenue   = validTickets.reduce((a, t) => a + (t.price || 0), 0);
  const totalSold      = validTickets.length;
  const admittedCount  = filteredTickets.filter(t => t.status === 'used').length;
  const admittedPct    = totalSold > 0 ? Math.round((admittedCount / totalSold) * 100) : 0;
  const activeEvents   = filteredEvents.filter(e => e.status === 'published' || e.status === 'live').length;

  const vendorStats    = vendors.map(v => ({
    ...v,
    totalOwed: vendorPurchases
      .filter(vp => vp.vendorId === v.id && (viewMode === 'all' || vp.eventId === selectedEvent?.id))
      .reduce((a, vp) => a + vp.sold * vp.priceEach, 0),
  }));
  const totalVendorOwed = vendorStats.reduce((a, v) => a + v.totalOwed, 0);

  // ── Recent Sales ──
  const recentSales = [...filteredTickets]
    .filter(t => t.purchasedAt)
    .sort((a, b) => (b.purchasedAt?.seconds || 0) - (a.purchasedAt?.seconds || 0))
    .slice(0, 10)
    .map(t => {
      const ev = events.find(e => e.id === t.eventId);
      const secAgo = Math.floor(Date.now() / 1000 - (t.purchasedAt?.seconds || 0));
      const timeLabel =
        secAgo < 60    ? `${secAgo}s` :
        secAgo < 3600  ? `${Math.floor(secAgo / 60)} min` :
        secAgo < 86400 ? `${Math.floor(secAgo / 3600)}h` :
                         `${Math.floor(secAgo / 86400)}j`;
      return { ...t, eventName: ev?.name || '—', timeLabel, source: t.vendorId ? 'vendor' : 'online' };
    });

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div>

      {/* ── View Mode Toggle ── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-lg tracking-wide">
          {viewMode === 'all'
            ? L('Tout Evènman', 'All Events', 'Tous les événements')
            : selectedEvent?.name || L('Evènman Chwazi', 'Selected Event', 'Événement sélectionné')}
        </h2>
        <div className="flex items-center gap-1 bg-white/[0.04] border border-border rounded-lg p-1">
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all ${
              viewMode === 'all' ? 'bg-orange text-white' : 'text-gray-muted hover:text-white'
            }`}>
            {L('Tout', 'All', 'Tous')}
          </button>
          <button
            onClick={() => setViewMode('selected')}
            disabled={!selectedEvent}
            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all ${
              viewMode === 'selected' ? 'bg-orange text-white' :
              !selectedEvent ? 'text-gray-muted/40 cursor-not-allowed' :
              'text-gray-muted hover:text-white'
            }`}>
            {selectedEvent
              ? <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                  {selectedEvent.name.length > 18 ? selectedEvent.name.slice(0, 18) + '…' : selectedEvent.name}
                </span>
              : L('Chwazi evènman', 'Select event', 'Choisir')}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: L('REVNI TOTAL', 'TOTAL REVENUE', 'REVENU TOTAL'),        value: fmt(totalRevenue).usd, sub2: fmt(totalRevenue).htg, sub: `${totalSold} ${L('tikè vann', 'tickets sold', 'billets vendus')}` },
          { label: L('TIKÈ VANN', 'TICKETS SOLD', 'BILLETS VENDUS'),         value: totalSold.toLocaleString(),             sub: `${activeEvents} ${L('evènman aktif', 'active events', 'événements actifs')}` },
          { label: L('EVÈNMAN AKTIF', 'ACTIVE EVENTS', 'ÉVÉNEMENTS ACTIFS'), value: activeEvents.toString(),               sub: `${filteredEvents.length} ${L('total', 'total', 'total')}` },
          { label: L('REVANDÈ DWE', 'RESELLERS OWE', 'REVENDEURS DWE'),      value: fmt(totalVendorOwed).usd, sub2: fmt(totalVendorOwed).htg, sub: `${vendors.length} ${L('revandè', 'resellers', 'revendeurs')}`, warn: totalVendorOwed > 0 },
        ].map((s, i) => (
          <div key={i} className="bg-dark-card border border-border rounded-card p-4">
            <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">{s.label}</p>
            <p className={`font-heading text-3xl tracking-wide ${(s as any).warn ? 'text-orange' : ''}`}>{s.value}</p>
            {(s as any).sub2 && <p className="text-[9px] text-gray-muted -mt-1">{(s as any).sub2}</p>}
            <p className="text-[10px] text-gray-muted mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Live Admission Counter ── */}
      {totalSold > 0 && (
        <div className="bg-dark-card border border-border rounded-card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🚪</span>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-muted">
                {L('Antre Evènman', 'Door Admissions', 'Admissions')}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-400 font-bold">{L('AN DIRÈK', 'LIVE', 'EN DIRECT')}</span>
            </div>
          </div>
          <div className="flex items-end gap-3 mb-2">
            <p className="font-heading text-4xl tracking-wide text-green-400">{admittedCount}</p>
            <p className="text-gray-muted text-sm mb-1">/ {totalSold} {L('tikè', 'tickets', 'billets')} • {admittedPct}%</p>
          </div>
          <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${admittedPct}%` }} />
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {[
          { href: selectedEvent ? `/organizer/scanner?event=${selectedEvent.id}` : '/organizer/scanner', icon: '📷', title: L('Eskane Tikè', 'Scan Tickets', 'Scanner Billets'), sub: L('Ouvri eskanè pou admèt moun', 'Open scanner to admit guests', 'Ouvrir le scanner pour admettre') },
          { href: '/organizer/vendors',       icon: '🏪', title: L('Jere Revandè',   'Manage Resellers','Gérer les revendeurs'), sub: L('Asiyen tikè epi swiv vant revandè yo', 'Assign tickets and track reseller sales', 'Assigner billets et suivre les ventes') },
          { href: selectedEvent ? `/organizer/staff?event=${selectedEvent.id}` : '/organizer/staff', icon: '👥', title: L('Jere Staff', 'Manage Staff', 'Gérer le personnel'), sub: L('Eskane tikè ak jere ekip ou', 'Scan tickets and manage your team', 'Scanner billets et gérer votre équipe') },
          { href: '/organizer/revenue',       icon: '📈', title: L('Wè Rapò',        'View Reports',    'Voir les rapports'),    sub: L('Analiz vant, revni, ak pèfòmans', 'Analyze sales, revenue, and performance', 'Analyser ventes et revenus') },
        ].map(a => (
          <Link key={a.href} href={a.href}
            className="bg-dark-card border border-border rounded-card p-4 flex items-center gap-3 hover:border-orange-border hover:bg-dark-hover transition-all">
            <span className="text-2xl">{a.icon}</span>
            <div>
              <p className="text-xs font-bold">{a.title}</p>
              <p className="text-[10px] text-gray-light">{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Events Overview ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg tracking-wide">{L('EVÈNMAN', 'EVENTS', 'ÉVÉNEMENTS')}</h2>
          <Link href="/organizer/events" className="text-[11px] text-orange hover:underline">
            {L('Wè tout', 'See all', 'Voir tout')} →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                {[L('Evènman','Event','Événement'), L('Dat','Date','Date'), L('Estati','Status','Statut'), L('Tikè','Tickets','Billets'), L('Revni','Revenue','Revenu')].map(h => (
                  <th key={h} className="text-[10px] text-gray-muted uppercase tracking-widest pb-2.5 pl-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-muted text-sm">
                  {L('Pa gen evènman —', 'No events —', 'Aucun événement —')}{' '}
                  <Link href="/organizer/events/create" className="text-orange hover:underline">
                    {L('Kreye premye a', 'Create the first one', 'Créer le premier')}
                  </Link>
                </td></tr>
              ) : filteredEvents.slice(0, 5).map(e => {
                const evTickets = validTickets.filter(t => t.eventId === e.id);
                const evRevenue = evTickets.reduce((a, t) => a + (t.price || 0), 0);
                return (
                  <tr key={e.id} className="border-b border-border hover:bg-white/[0.015] cursor-pointer">
                    <td className="py-3 pl-3">
                      <div className="flex items-center gap-2">
                        <span>{(e as any).emoji || '🎫'}</span>
                        <span className="text-xs font-semibold">{e.name}</span>
                        {e.isPrivate && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange/20 text-orange border border-orange/30">🔒</span>}
                      </div>
                    </td>
                    <td className="text-xs text-gray-light pl-3">{e.startDate || (e as any).date || '—'}</td>
                    <td className="pl-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        e.status === 'live'      ? 'bg-green-dim text-green' :
                        e.status === 'published' ? 'bg-cyan-dim text-cyan' :
                        'bg-white/[0.05] text-gray-muted'
                      }`}>
                        {e.status === 'live'      ? `● ${L('AN DIRÈK','LIVE','EN DIRECT')}` :
                         e.status === 'published' ? L('PIBLIYE','PUBLISHED','PUBLIÉ') :
                         e.status === 'draft'     ? L('BOUYON','DRAFT','BROUILLON') :
                                                    L('PASE','PAST','PASSÉ')}
                      </span>
                    </td>
                    <td className="text-xs text-gray-light pl-3">{evTickets.length}</td>
                    <td className="text-xs font-bold pl-3"><div>{fmt(evRevenue).usd}</div><div className="text-[9px] text-gray-muted font-normal">{fmt(evRevenue).htg}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent Sales ── */}
      <div>
        <h2 className="font-heading text-lg tracking-wide mb-3">{L('DÈNYE VANT', 'RECENT SALES', 'VENTES RÉCENTES')}</h2>
        {recentSales.length === 0 ? (
          <div className="bg-dark-card border border-border rounded-card p-8 text-center">
            <p className="text-4xl mb-2">🎫</p>
            <p className="text-gray-muted text-sm">{L("Pa gen vant ankò.", "No sales yet.", "Aucune vente pour l'instant.")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentSales.map((s: any) => (
              <div key={s.id} className="bg-dark-card border border-border rounded-card p-3 flex items-center gap-3">
                <span className="text-[10px] text-gray-muted w-12 flex-shrink-0">{s.timeLabel}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{s.eventName}</p>
                  <p className="text-[10px] text-gray-light">
                    {s.section || 'GA'} · {s.source === 'vendor' ? `🏪 ${s.vendorName || L('Revandè','Reseller','Revendeur')}` : `🌐 ${L('Online','Online','En ligne')}`} · {s.buyerName || '—'}
                  </p>
                </div>
                <span className="font-heading text-lg text-green">{fmt(s.price || 0).usd}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
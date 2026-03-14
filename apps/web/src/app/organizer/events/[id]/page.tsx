'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getOrganizerEvents, type EventData, markEventEnded, markEventPublished, markEventLive, autoUpdateAllEventStatuses } from '@/lib/db';
import FloorPlanViewer from '@/components/FloorPlanViewer';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useOrganizerEvent } from '../../OrganizerEventContext';

export default function OrganizerEventsPage() {
  const { user } = useAuth();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  const { selectedEvent, setSelectedEvent } = useOrganizerEvent();
  const [expandedId, setExpandedId] = useState('');

  const [events, setEvents] = useState<EventData[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'live' | 'ended'>('all');
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      try {
        const evs = await getOrganizerEvents(user.uid);
        // Auto-update statuses based on date/time
        const updated = await autoUpdateAllEventStatuses(evs);
        setEvents(updated);
        const tickets: any[] = [];
        await Promise.all(updated.map(async (e) => {
          if (!e.id) return;
          const snap = await getDocs(collection(db, 'events', e.id, 'tickets'));
          snap.docs.forEach(d => tickets.push({ id: d.id, eventId: e.id, ...d.data() }));
        }));
        setAllTickets(tickets);
      } catch (err) {
        console.error('events load', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  async function handleEndEvent(eventId: string) {
    if (!confirm(L('Mete evènman an fini?', 'Mark this event as ended?', 'Marquer cet événement comme terminé ?'))) return;
    setStatusLoading(eventId);
    try {
      await markEventEnded(eventId);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'ended' } : e));
    } finally { setStatusLoading(null); }
  }

  async function handleGoLive(eventId: string) {
    setStatusLoading(eventId);
    try {
      await markEventLive(eventId);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'live' } : e));
    } finally { setStatusLoading(null); }
  }

  async function handleReopen(eventId: string) {
    setStatusLoading(eventId);
    try {
      await markEventPublished(eventId);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'published' } : e));
    } finally { setStatusLoading(null); }
  }

  const filteredEvents = filter === 'all' ? events : events.filter(e => e.status === filter);

  const totalCapacity = (e: EventData) =>
    (e.sections || []).reduce((a, s) => a + (s.capacity || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-gray-light">{events.length} {L('evènman', 'events', 'événements')}</p>
          <div className="flex items-center gap-1">
            {(['all', 'live', 'published', 'draft', 'ended'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                  filter === f ? 'bg-orange text-white' : 'text-gray-muted hover:text-white'
                }`}>
                {f === 'all'       ? L('Tout', 'All', 'Tous') :
                 f === 'live'      ? L('An Dirèk', 'Live', 'En Direct') :
                 f === 'published' ? L('Pibliye', 'Published', 'Publiés') :
                 f === 'draft'     ? L('Bouyon', 'Draft', 'Brouillon') :
                                    L('Fini', 'Ended', 'Terminés')}
              </button>
            ))}
          </div>
        </div>
        <Link href="/organizer/events/create"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
          ➕ {L('Kreye Evènman', 'Create Event', 'Créer un événement')}
        </Link>
      </div>

      {/* ── Empty ── */}
      {filteredEvents.length === 0 ? (
        <div className="bg-dark-card border border-border rounded-card p-12 text-center">
          <p className="text-5xl mb-3">📅</p>
          <p className="text-gray-muted mb-4">
            {filter === 'all'
              ? L('Pa gen evènman ankò.', 'No events yet.', "Aucun événement pour l'instant.")
              : L('Pa gen evènman nan kategori sa a.', 'No events in this category.', 'Aucun événement dans cette catégorie.')}
          </p>
          {filter === 'all' && (
            <Link href="/organizer/events/create"
              className="inline-flex px-5 py-2.5 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
              ➕ {L('Kreye premye evènman ou', 'Create your first event', 'Créer votre premier événement')}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map(e => {
            const evTickets  = allTickets.filter(t => t.eventId === e.id && t.status !== 'cancelled');
            const evRevenue  = evTickets.reduce((a, t) => a + (t.price || 0), 0);
            const cap        = totalCapacity(e);
            const pct        = cap > 0 ? Math.round((evTickets.length / cap) * 100) : 0;
            const isSelected = !!e.id && expandedId === e.id;

            return (
              <div key={e.id}
                onClick={() => { setExpandedId(expandedId === e.id ? '' : (e.id ?? '')); setSelectedEvent(e); }}
                className={`bg-dark-card border rounded-card p-4 transition-all cursor-pointer ${
                  isSelected ? 'border-orange' : 'border-border hover:border-white/[0.1]'
                }`}>

                <div className="flex items-center gap-3">
                  {/* Emoji / image */}
                  <div className="w-14 h-14 rounded-[10px] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
                    {(e as any).imageUrl
                      ? <img src={(e as any).imageUrl} alt={e.name} className="w-full h-full object-cover" />
                      : (e as any).emoji || '🎫'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold">{e.name}</p>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        e.status === 'live'      ? 'bg-green-dim text-green' :
                        e.status === 'published' ? 'bg-cyan-dim text-cyan' :
                        'bg-white/[0.05] text-gray-muted'
                      }`}>
                        {e.status === 'live'      ? `● ${L('AN DIRÈK', 'LIVE', 'EN DIRECT')}` :
                         e.status === 'published' ? L('PIBLIYE', 'PUBLISHED', 'PUBLIÉ') :
                         e.status === 'draft'     ? L('BOUYON', 'DRAFT', 'BROUILLON') :
                                                    L('PASE', 'PAST', 'PASSÉ')}
                      </span>
                      {e.isPrivate && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange/20 text-orange border border-orange/30">
                          🔒 {L('PRIVE', 'PRIVATE', 'PRIVÉ')}
                        </span>
                      )}
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange text-white">
                          ✓ {L('Chwazi', 'Selected', 'Sélectionné')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-light">
                      📅 {e.startDate || (e as any).date || '—'} · 📍 {e.venue?.name || '—'}{e.venue?.city ? `, ${e.venue.city}` : ''}
                    </p>

                    {/* Ticket progress bar */}
                    {cap > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-orange rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-muted whitespace-nowrap">
                          {evTickets.length}/{cap} ({pct}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Revenue + chevron */}
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                    <p className="font-heading text-2xl">${evRevenue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-muted">{evTickets.length} {L('tikè', 'tickets', 'billets')}</p>
                    <span className={`text-[10px] transition-transform duration-200 ${isSelected ? 'text-orange rotate-180 inline-block' : 'text-gray-muted inline-block'}`}>▼</span>
                  </div>
                </div>

                {/* ── Actions (revealed on click) ── */}
                {isSelected && <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                  <Link href={`/organizer/events/${e.id}/edit`}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">
                    ✏️ {L('Edite', 'Edit', 'Modifier')}
                  </Link>
                  <Link href={`/organizer/staff?event=${e.id}`}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">
                    👥 {L('Staff', 'Staff', 'Personnel')}
                  </Link>
                  <Link href={`/organizer/scanner?event=${e.id}`}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">
                    📷 {L('Eskane', 'Scanner', 'Scanner')}
                  </Link>
                  {e.isPrivate && e.privateToken && (
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/e/${e.privateToken}`)}
                      className="px-3 py-1.5 rounded-lg bg-orange/10 border border-orange/30 text-[10px] font-bold text-orange hover:bg-orange hover:text-white transition-all">
                      📋 {L('Kopye lyen prive', 'Copy private link', 'Copier lien privé')}
                    </button>
                  )}

                  {/* ── Status controls ── */}
                  {e.status === 'published' && e.id && (
                    <button
                      onClick={() => handleGoLive(e.id!)}
                      disabled={statusLoading === e.id}
                      className="px-3 py-1.5 rounded-lg bg-green-dim border border-green/30 text-[10px] font-bold text-green hover:bg-green hover:text-black transition-all disabled:opacity-50">
                      {statusLoading === e.id ? '⏳' : `● ${L('Mete An Dirèk', 'Go Live', 'Mettre en Direct')}`}
                    </button>
                  )}
                  {(e.status === 'published' || e.status === 'live') && e.id && (
                    <button
                      onClick={() => handleEndEvent(e.id!)}
                      disabled={statusLoading === e.id}
                      className="px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-800/40 text-[10px] font-bold text-red-400 hover:bg-red-800/40 transition-all disabled:opacity-50">
                      {statusLoading === e.id ? '⏳' : `■ ${L('Fini Evènman', 'End Event', 'Terminer')}`}
                    </button>
                  )}
                  {e.status === 'ended' && e.id && (
                    <button
                      onClick={() => handleReopen(e.id!)}
                      disabled={statusLoading === e.id}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-white transition-all disabled:opacity-50">
                      {statusLoading === e.id ? '⏳' : `↺ ${L('Relouvri', 'Reopen', 'Rouvrir')}`}
                    </button>
                  )}

                </div>}

                {/* Floor plan — compact view */}
                {isSelected && e.id && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #1e1e2e' }}>
                    <FloorPlanViewer
                      eventId={e.id}
                      sections={(e.sections || []) as any[]}
                      compact={false}
                    />
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
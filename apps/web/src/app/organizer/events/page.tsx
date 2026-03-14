'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getOrganizerEvents, type EventData, markEventEnded, markEventPublished, markEventLive } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import FloorPlanViewer from '@/components/FloorPlanViewer';

export default function OrganizerEventsPage() {
  const { user } = useAuth();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  const [events, setEvents] = useState<EventData[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState('');
  const [statusLoading, setStatusLoading] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      try {
        const evs = await getOrganizerEvents(user.uid);
        setEvents(evs);
        const tickets: any[] = [];
        await Promise.all(evs.map(async (e) => {
          if (!e.id) return;
          const snap = await getDocs(collection(db, 'tickets'));
          snap.docs.forEach(d => { if (d.data().eventId === e.id) tickets.push({ id: d.id, ...d.data() }); });
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

  async function handleGoLive(eventId: string) {
    setStatusLoading(eventId);
    await markEventLive(eventId);
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'live' } : e));
    setStatusLoading('');
  }
  async function handleEndEvent(eventId: string) {
    if (!confirm(L('Fini evènman sa a?', 'End this event?', 'Terminer cet événement?'))) return;
    setStatusLoading(eventId);
    await markEventEnded(eventId);
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'ended' } : e));
    setStatusLoading('');
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-gray-light">{events.length} {L('evènman', 'events', 'événements')}</p>
        <Link href="/organizer/events/create"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
          ➕ {L('Kreye Evènman', 'Create Event', 'Créer un événement')}
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="bg-dark-card border border-border rounded-card p-12 text-center">
          <p className="text-5xl mb-3">📅</p>
          <p className="text-gray-muted mb-4">{L('Pa gen evènman ankò.', 'No events yet.', "Aucun événement pour l'instant.")}</p>
          <Link href="/organizer/events/create"
            className="inline-flex px-5 py-2.5 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
            ➕ {L('Kreye premye evènman ou', 'Create your first event', 'Créer votre premier événement')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(e => {
            const evTickets = allTickets.filter(t => t.eventId === e.id && t.status !== 'cancelled');
            const evRevenue = evTickets.reduce((a: number, t: any) => a + (t.price || 0), 0);
            const cap = (e.sections || []).reduce((a, s) => a + (s.capacity || 0), 0);
            const pct = cap > 0 ? Math.round((evTickets.length / cap) * 100) : 0;
            const isOpen = !!e.id && expandedId === e.id;

            return (
              <div key={e.id}
                onClick={() => setExpandedId(isOpen ? '' : (e.id || ''))}
                className={`bg-dark-card border rounded-card p-4 transition-all cursor-pointer select-none ${
                  isOpen ? 'border-orange' : 'border-border hover:border-white/[0.1]'
                }`}>

                {/* ── Card header ── */}
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-[10px] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-3xl flex-shrink-0">
                    {(e as any).emoji || '🎫'}
                  </div>

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
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange/20 text-orange border border-orange/30">🔒 PRIVATE</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-light">
                      📅 {e.startDate || (e as any).date || '—'} · 🎫 {evTickets.length} {L('tikè vann', 'tickets sold', 'billets vendus')}
                    </p>
                    {cap > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-orange rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-muted">{pct}%</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                    <p className="font-heading text-2xl">${evRevenue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-muted">{evTickets.length} {L('tikè', 'tickets', 'billets')}</p>
                    <span className={`text-[10px] mt-0.5 transition-all duration-200 ${isOpen ? 'text-orange' : 'text-gray-muted'}`}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* ── Expanded content ── */}
                {isOpen && (
                  <div onClick={ev => ev.stopPropagation()}>
                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
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
                    </div>

                    {/* Floor plan if available */}
                    {e.id && (
                      <div className="mt-4">
                        <FloorPlanViewer
                          eventId={e.id}
                          sections={(e.sections || []) as any[]}
                          compact={false}
                        />
                      </div>
                    )}
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

'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getOrganizerEvents, type EventData } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function OrganizerEventsPage() {
  const { user } = useAuth();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  const [events, setEvents] = useState<EventData[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
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
      } catch (err) {
        console.error('events load', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

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
          <p className="text-gray-muted mb-4">{L('Pa gen evènman ankò.', 'No events yet.', 'Aucun événement pour l\'instant.')}</p>
          <Link href="/organizer/events/create"
            className="inline-flex px-5 py-2.5 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
            ➕ {L('Kreye premye evènman ou', 'Create your first event', 'Créer votre premier événement')}
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
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange/20 text-orange border border-orange/30">🔒 {L('PRIVE', 'PRIVATE', 'PRIVÉ')}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-light">
                      📅 {e.startDate || (e as any).date || '—'} · 🎫 {evTickets.length} {L('tikè vann', 'tickets sold', 'billets vendus')}
                    </p>
                    {e.isPrivate && e.privateToken && (
                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/e/${e.privateToken}`)}
                        className="mt-1 px-2 py-0.5 rounded text-[9px] font-bold border border-border text-gray-light hover:text-white hover:border-white/30 transition-all">
                        📋 {L('Kopye lyen prive', 'Copy private link', 'Copier lien privé')}
                      </button>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-heading text-2xl">${evRevenue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-muted">{evTickets.length} {L('tikè', 'tickets', 'billets')}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
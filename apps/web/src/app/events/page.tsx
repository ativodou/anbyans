'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useT } from '@/i18n';
import Link from 'next/link';

interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  date: any;
  venue: string;
  city: string;
  coverImage?: string;
  minPrice: number;
  maxPrice: number;
  sections: any[];
  status: 'live' | 'upcoming' | 'ended';
  organizerName?: string;
  tags?: string[];
}

function EventsInner() {
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [events, setEvents]   = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState(searchParams.get('q') || '');
  const [filter, setFilter]   = useState<'all' | 'live' | 'upcoming'>('all');

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, 'events'));
        const snap = await getDocs(q);
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as PublicEvent));
        // normalize status
        const visible = all.filter(ev => {
          const s = (ev as any).status;
          const notPrivate = !(ev as any).isPrivate;
          return notPrivate && (s === 'live' || s === 'upcoming' || s === 'published');
        });
        setEvents(visible);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = events.filter(ev => {
    const matchSearch = !search ||
      ev.title || (ev as any).name.toLowerCase().includes(search.toLowerCase()) ||
      ev.city?.toLowerCase().includes(search.toLowerCase()) ||
      ev.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === 'all' || ev.status === filter;
    return matchSearch && matchFilter;
  });

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  const dateStr = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('fr-HT', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero search */}
      <div className="bg-gradient-to-b from-orange/10 to-transparent py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-heading text-4xl md:text-5xl text-white mb-2">
            {L('Evènman pou nou, pa nou.', 'Events for us, by us.', 'Événements pour nous, par nous.')}
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            {L('Jwenn evènman Ayisyen nan tout kote', 'Find Haitian events everywhere', 'Trouvez des événements haïtiens partout')}
          </p>
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={L('Rechèche evènman, vil, artis...', 'Search events, city, artist...', 'Rechercher événements, ville...')}
              className="w-full px-5 py-3.5 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white placeholder:text-gray-500 text-sm outline-none focus:border-orange"
            />
            <span className="absolute right-4 top-3.5 text-gray-500">🔍</span>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="max-w-5xl mx-auto px-4 mb-6 flex gap-2">
        {(['all', 'live', 'upcoming'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              filter === f ? 'bg-orange text-white' : 'bg-white/[0.06] text-gray-400 hover:bg-white/[0.1]'
            }`}>
            {f === 'all'      ? L('Tout', 'All', 'Tous') :
             f === 'live'     ? `● ${L('An Dirèk', 'Live Now', 'En Direct')}` :
                                L('Pwochen', 'Upcoming', 'À venir')}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500 self-center">
          {filtered.length} {L('evènman', 'events', 'événements')}
        </span>
      </div>

      {/* Event grid */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.04] h-72 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <p className="text-4xl mb-3">🎭</p>
            <p>{L('Pa gen evènman pou kounye a.', 'No events found.', 'Aucun événement trouvé.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(ev => (
              <Link key={ev.id} href={`/e/${(ev as any).slug && !(ev as any).slug.includes(" ") ? (ev as any).slug : ev.id}`}
                className="group rounded-2xl overflow-hidden border border-white/[0.06] hover:border-orange/40 transition-all bg-white/[0.03] hover:bg-white/[0.06]">
                {/* Cover */}
                <div className="relative h-40 bg-gradient-to-br from-orange/20 to-purple-900/40 overflow-hidden">
                  {ev.coverImage
                    ? <img src={ev.coverImage} alt={ev.title || (ev as any).name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="flex items-center justify-center h-full text-5xl">🎉</div>
                  }
                  {ev.status === 'live' && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                      ● LIVE
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="p-4">
                  <p className="font-heading text-base text-white leading-tight mb-1 line-clamp-2">{ev.title || (ev as any).name}</p>
                  <p className="text-[11px] text-gray-400 mb-0.5">📅 {dateStr((ev as any).startDate ? new Date((ev as any).startDate) : ev.date)}</p>
                  <p className="text-[11px] text-gray-400 mb-3">📍 {(ev as any).venue?.name || ev.venue}{(ev as any).venue?.city || ev.city ? `, ${(ev as any).venue?.city || ev.city}` : ''}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange">
                      {(ev as any).sections ? `$${Math.min(...(ev as any).sections.map((s:any) => s.price))} – $${Math.max(...(ev as any).sections.map((s:any) => s.price))}` : fmt(ev.minPrice)}
                    </span>
                    <span className="text-[10px] font-bold bg-orange/10 text-orange px-3 py-1 rounded-full group-hover:bg-orange group-hover:text-white transition-all">
                      {L('Achte', 'Buy', 'Acheter')} →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  return <Suspense><EventsInner /></Suspense>;
}
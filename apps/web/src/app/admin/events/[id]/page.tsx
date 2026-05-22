'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getEvent, type EventData } from '@/lib/db';

export default function AdminEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') { router.push('/'); return; }

    async function load() {
      const id = Array.isArray(params.id) ? params.id[0] : params.id as string;
      if (!id) { setLoading(false); return; }
      const data = await getEvent(id);
      setEvent(data);
      setLoading(false);
    }
    load();
  }, [params.id, user, authLoading, router]);

  if (authLoading || loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!event) return (
    <div className="min-h-screen bg-dark flex items-center justify-center text-white">
      <div className="text-center">
        <p className="text-gray-muted mb-4">Event not found</p>
        <button onClick={() => router.back()} className="text-orange text-sm">{'← Back'}</button>
      </div>
    </div>
  );

  const { totalCap, totalSold } = event.sections?.reduce(
    (acc, s) => ({ totalCap: acc.totalCap + s.capacity, totalSold: acc.totalSold + (s.sold || 0) }),
    { totalCap: 0, totalSold: 0 }
  ) ?? { totalCap: 0, totalSold: 0 };

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="max-w-2xl mx-auto px-5 py-8">

        <button onClick={() => router.back()} className="text-orange text-sm mb-6 flex items-center gap-1 hover:opacity-80 transition-opacity">
          {'←'} Back to Dashboard
        </button>

        {event.imageUrl ? (
          <div className="rounded-2xl overflow-hidden mb-6 h-64">
            <img src={event.imageUrl} alt={event.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="rounded-2xl h-40 bg-dark-card border border-border flex items-center justify-center mb-6">
            <span className="text-5xl">🎵</span>
          </div>
        )}

        <div className="flex items-start justify-between mb-6">
          <h1 className="text-2xl font-bold flex-1">{event.name}</h1>
          {event.category && (
            <span className="ml-3 text-[11px] bg-dark-card border border-border text-gray-muted px-3 py-1 rounded-full whitespace-nowrap">
              {event.category}
            </span>
          )}
        </div>

        <div className="bg-dark-card border border-border rounded-xl p-4 mb-6 space-y-3">
          <Row label="Status">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${{
              published: 'bg-green/20 text-green',
              cancelled: 'bg-red/20 text-red',
            }[event.status] ?? 'bg-orange/20 text-orange'}`}>{event.status}</span>
          </Row>
          <Row label="Organizer">{event.organizerName || '—'}</Row>
          <Row label="Date">{event.startDate}{event.endDate && event.endDate !== event.startDate ? ` – ${event.endDate}` : ''}</Row>
          {event.startTime && <Row label="Time">{event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}</Row>}
          {event.venue && (
            <Row label="Venue">
              {event.venue.name}
              {event.venue.city ? `, ${event.venue.city}` : ''}
            </Row>
          )}
          {event.isPrivate && <Row label="Visibility"><span className="text-orange text-xs font-bold">PRIVATE</span></Row>}
        </div>

        {event.description && (
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-widest text-gray-muted font-bold mb-2">About</p>
            <p className="text-sm text-gray-light leading-relaxed whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {event.sections && event.sections.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-widest text-gray-muted font-bold mb-3">Tickets</p>
            <div className="space-y-2">
              {event.sections.map((s, i) => {
                const avail = s.capacity - (s.sold || 0);
                return (
                  <div key={i} className="bg-dark-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-[11px] text-gray-muted">{s.sold || 0} sold · {avail} left / {s.capacity}</p>
                    </div>
                    <p className="text-cyan font-bold">${s.price}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-muted mt-3">{totalSold} sold total · {totalCap - totalSold} remaining · {totalCap} capacity</p>
          </div>
        )}

      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-gray-muted w-24 flex-shrink-0">{label}</span>
      <span className="text-sm text-white">{children}</span>
    </div>
  );
}

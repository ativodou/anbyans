'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/i18n';
import { getEvent, type EventData } from '@/lib/db';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale]);

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const id = Array.isArray(params.id) ? params.id[0] : params.id as string;
        if (!id) { setNotFound(true); setLoading(false); return; }
        const data = await getEvent(id);
        if (!data) setNotFound(true);
        else setEvent(data);
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    }
    load();
  }, [params.id]);

  const minPrice = (e: EventData) => !e.sections?.length ? 0 : Math.min(...e.sections.map(s => s.price));
  const totalCap = (e: EventData) => e.sections?.reduce((s, x) => s + x.capacity, 0) ?? 0;
  const totalSold = (e: EventData) => e.sections?.reduce((s, x) => s + (x.sold || 0), 0) ?? 0;

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>\u23f3</div>
        <p style={{ color: '#888' }}>{L('Ap chaje...', 'Loading...', 'Chargement...')}</p>
      </div>
    </div>
  );

  if (notFound || !event) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>\ud83c\udfad</div>
        <h2 style={{ color: '#fff', fontSize: 22, marginBottom: 8 }}>{L('Evenman pa jwenn', 'Event not found', '\u00c9v\u00e9nement introuvable')}</h2>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>{L('Lyen sa a pa valid.', 'This link is not valid.', 'Ce lien est invalide.')}</p>
        <Link href="/events" style={{ color: '#06b6d4', textDecoration: 'none', fontSize: 14 }}>\u2190 {L('Tout Evenman', 'All Events', 'Tous les \u00e9v\u00e9nements')}</Link>
      </div>
    </div>
  );

  const spotsLeft = totalCap(event) - totalSold(event);
  const isSoldOut = totalCap(event) > 0 && spotsLeft <= 0;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e1e2e' }}>
        <Link href="/events" style={{ color: '#06b6d4', textDecoration: 'none', fontSize: 14 }}>\u2190 {L('Tout Evenman', 'All Events', 'Tous les \u00e9v\u00e9nements')}</Link>
        <Link href="/auth" style={{ color: '#06b6d4', textDecoration: 'none', fontSize: 13 }}>{L('Konekte', 'Sign In', 'Connexion')}</Link>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

        {event.imageUrl ? (
          <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 24, height: 280 }}>
            <img src={event.imageUrl} alt={event.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{ borderRadius: 16, height: 200, background: '#12121a', border: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <span style={{ fontSize: 72 }}>\ud83c\udfb5</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: 0, flex: 1 }}>{event.name}</h1>
          {event.category && <span style={{ background: '#0a1a1a', border: '1px solid #1e1e2e', color: '#888', padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, marginLeft: 12, whiteSpace: 'nowrap' }}>{event.category}</span>}
        </div>

        <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>\ud83d\udcc5</span>
              <div>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{event.startDate}</div>
                {event.endDate && event.endDate !== event.startDate && <div style={{ color: '#888', fontSize: 12 }}>\u2192 {event.endDate}</div>}
              </div>
            </div>
            {event.startTime && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>\ud83d\udd50</span>
                <div style={{ color: '#fff', fontSize: 15 }}>{event.startTime}{event.endTime && <span style={{ color: '#888' }}> \u2013 {event.endTime}</span>}</div>
              </div>
            )}
            {event.venue && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 18 }}>\ud83d\udccd</span>
                <div>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{event.venue.name}</div>
                  {event.venue.address && <div style={{ color: '#888', fontSize: 12 }}>{event.venue.address}</div>}
                  {event.venue.city && <div style={{ color: '#888', fontSize: 12 }}>{event.venue.city}</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        {event.description && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{L('Detay', 'About', '\u00c0 propos')}</h2>
            <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{event.description}</p>
          </div>
        )}

        {event.sections && event.sections.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{L('Tik\u00e8', 'Tickets', 'Billets')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {event.sections.map((section, i) => {
                const avail = section.capacity - (section.sold || 0);
                const out = avail <= 0;
                return (
                  <div key={i} style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: out ? 0.6 : 1 }}>
                    <div>
                      <div style={{ color: out ? '#666' : '#fff', fontSize: 15, fontWeight: 700 }}>{section.name}</div>
                      <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{out ? L('Epize', 'Sold out', '\u00c9puis\u00e9') : `${avail} ${L('plas disponib', 'spots left', 'places restantes')}`}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: out ? '#666' : '#06b6d4', fontSize: 18, fontWeight: 800 }}>${section.price}</div>
                      <div style={{ color: '#555', fontSize: 11 }}>{L('pa tik\u00e8', 'per ticket', 'par billet')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {totalCap(event) > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#888', fontSize: 12 }}>{L('Disponibilite', 'Availability', 'Disponibilit\u00e9')}</span>
              <span style={{ color: isSoldOut ? '#ef4444' : '#06b6d4', fontSize: 12, fontWeight: 600 }}>
                {isSoldOut ? L('Epize', 'Sold Out', '\u00c9puis\u00e9') : `${spotsLeft} ${L('plas', 'left', 'restantes')}`}
              </span>
            </div>
            <div style={{ height: 6, background: '#1e1e2e', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (totalSold(event) / totalCap(event)) * 100)}%`, background: isSoldOut ? '#ef4444' : spotsLeft < 20 ? '#f59e0b' : '#06b6d4', borderRadius: 3 }} />
            </div>
          </div>
        )}

        <button
          onClick={() => !isSoldOut && router.push(`/buy?event=${event.id}`)}
          disabled={isSoldOut}
          style={{ width: '100%', padding: '16px 0', borderRadius: 12, border: 'none', cursor: isSoldOut ? 'not-allowed' : 'pointer', background: isSoldOut ? '#1e1e2e' : 'linear-gradient(135deg, #06b6d4, #0891b2)', color: isSoldOut ? '#555' : '#000', fontSize: 17, fontWeight: 800 }}>
          {isSoldOut ? L('Tik\u00e8 Epize', 'Sold Out', 'Billets \u00e9puis\u00e9s') : `\ud83c\udf9f\ufe0f ${L('Achte Tik\u00e8', 'Buy Tickets', 'Acheter des billets')} \u2014 $${minPrice(event)}+`}
        </button>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'center' }}>
          <button onClick={() => { if (navigator.share) navigator.share({ title: event.name, url: window.location.href }); else navigator.clipboard.writeText(window.location.href); }}
            style={{ background: 'transparent', border: '1px solid #1e1e2e', color: '#888', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
            \ud83d\udccb {L('Kopye Lyen', 'Copy Link', 'Copier le lien')}
          </button>
          <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(event.name + '\n' + window.location.href)}`, '_blank')}
            style={{ background: 'transparent', border: '1px solid #25d366', color: '#25d366', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
            \ud83d\udcac WhatsApp
          </button>
        </div>

      </div>
    </div>
  );
}

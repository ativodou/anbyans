'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';
import { getPublishedEvents } from '@/lib/db';
import { fetchHaitianCityEvents, tmEventsToGallery } from '@/lib/ticketmaster';

const FALLBACK_GALLERY = [
  { title: 'Kompa Fest 2026', venue: 'Parc Istorik, Milot', date: '15 Mars', emoji: '🎶', price: 15, live: true, imageUrl: '', source: 'anbyans' as const },
  { title: 'DJ Stéphane Live', venue: 'Karibe Hotel, PV', date: '22 Mars', emoji: '🎧', price: 25, live: false, imageUrl: '', source: 'anbyans' as const },
  { title: 'Rara Lakay 2026', venue: 'Champ de Mars, PaP', date: '5 Avr', emoji: '🥁', price: 10, live: false, imageUrl: '', source: 'anbyans' as const },
  { title: 'Tabou Combo 50 Ans', venue: 'Little Haiti, Miami', date: '12 Avr', emoji: '🎺', price: 45, live: false, imageUrl: '', source: 'anbyans' as const },
  { title: 'Kanaval Jacmel', venue: 'Jacmel, Sidès', date: '8 Avr', emoji: '🎭', price: 5, live: true, imageUrl: '', source: 'anbyans' as const },
  { title: 'Jazz nan Lakou', venue: 'Lakou Trignon, PaP', date: '20 Avr', emoji: '🎷', price: 30, live: false, imageUrl: '', source: 'anbyans' as const },
];

const GENRES = [
  { label: 'Konpa', emoji: '🎶' }, { label: 'Jazz', emoji: '🎷' },
  { label: 'Rara', emoji: '🥁' },  { label: 'DJ', emoji: '🎧' },
  { label: 'Festival', emoji: '🎪' }, { label: 'Kanaval', emoji: '🎭' },
  { label: 'Rasin', emoji: '🪘' },  { label: 'Gospel', emoji: '🙏' },
];

type GalleryItem = {
  title: string; venue: string; date: string; emoji: string;
  price: number; live: boolean; imageUrl?: string;
  source: 'anbyans' | 'ticketmaster';
};

export default function LandingPage() {
  const router = useRouter();
  const { t } = useT();
  const [q, setQ] = useState('');
  const [privateModal, setPrivateModal] = useState(false);
  const [privateCode, setPrivateCode] = useState('');
  const [gallery, setGallery] = useState<GalleryItem[]>(FALLBACK_GALLERY);
  const galleryLoaded = React.useRef(false);

  useEffect(() => {
    async function loadEvents() {
      const combined: GalleryItem[] = [];
      const emojis = ['🎶','🎧','🥁','🎺','🎭','🎷','🎵','🎤','🪘','🎹'];
      try {
        const anbyansEvents = await getPublishedEvents();
        for (let i = 0; i < anbyansEvents.length; i++) {
          const e = anbyansEvents[i];
          combined.push({
            title: e.name,
            venue: `${e.venue?.name || ''}, ${e.venue?.city || ''}`,
            date: e.startDate,
            emoji: emojis[i % emojis.length],
            price: e.sections?.length ? Math.min(...e.sections.map((s: any) => s.price)) : 0,
            live: e.status === 'live',
            imageUrl: e.imageUrl || '',
            source: 'anbyans',
          });
        }
      } catch (err) { console.error('Anbyans events error:', err); }

      if (combined.length < 10) {
        try {
          const tmGallery = tmEventsToGallery(await fetchHaitianCityEvents(4));
          combined.push(...tmGallery);
        } catch (err) { console.error('TM error:', err); }
      }
      if (combined.length > 0 && !galleryLoaded.current) { galleryLoaded.current = true; setGallery(combined); }
    }
    loadEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col">

      {/* MINIMAL NAV — landing only */}
      <nav style={{ position: 'fixed', top: 0, right: 0, zIndex: 50, padding: '12px 16px' }}>
        <LangSwitcher />
      </nav>

      <main className="flex-1">
        {/* HERO */}
        <section className="text-center pt-20 pb-10 px-5">
          <div className="mb-6">
            <img src="/logo.jpg" alt="Anbyans" style={{ height: 56, borderRadius: 8, margin: '0 auto 12px' }} />
          </div>
          <h1 className="font-heading text-5xl sm:text-7xl tracking-wider">
            ANBYANS <span className="bg-gradient-to-r from-cyan to-teal-400 bg-clip-text text-transparent">EVENTS</span>
          </h1>
          <p className="text-gray-light text-sm sm:text-base italic mt-3 mb-8">{t('landing_tagline')}.</p>

          {/* CTA */}
          <div style={{ marginBottom: 32 }}>
            <Link href="/auth" style={{
              display: 'inline-block', padding: '13px 40px', borderRadius: 10,
              border: 'none', background: '#06b6d4', color: '#000',
              fontWeight: 800, fontSize: 15, textDecoration: 'none', letterSpacing: 1,
            }}>
              Antre
            </Link>
          </div>

          {/* Search */}
          <div style={{ maxWidth: 560, margin: '0 auto 16px' }}>
            <div className="flex bg-dark-card border border-border rounded-xl overflow-hidden focus-within:border-cyan transition-colors">
              <div className="flex items-center pl-4 text-gray-muted">🔍</div>
              <input
                type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder={t('browse_search_placeholder')}
                onKeyDown={e => e.key === 'Enter' && router.push(`/events?q=${encodeURIComponent(q)}`)}
                className="flex-1 bg-transparent px-3 py-3.5 text-sm text-white placeholder:text-gray-muted outline-none font-body"
              />
              <button onClick={() => router.push(`/events?q=${encodeURIComponent(q)}`)}
                className="px-5 bg-cyan text-dark font-bold text-sm font-body hover:bg-white transition-colors">
                Chèche
              </button>
            </div>
          </div>

          {/* Genre pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 520, margin: '0 auto' }}>
            {GENRES.map(g => (
              <Link key={g.label} href={`/events?q=${g.label.toLowerCase()}`}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  background: '#12121a', border: '1px solid #1e1e2e', color: '#ccc',
                  textDecoration: 'none', transition: 'all .15s',
                }}>
                {g.emoji} {g.label}
              </Link>
            ))}
          </div>
        </section>

        {/* GALLERY SCROLL */}
        <section className="relative overflow-hidden py-4 mb-8">
          <div className="flex gap-4 px-5 animate-scroll hover:[animation-play-state:paused]">
            {[...(gallery.length >= 8 ? gallery : [...gallery, ...gallery])].map((ev, i) => (
              <Link key={i} href="/events"
                className="flex-shrink-0 w-[200px] bg-dark-card border border-border rounded-card overflow-hidden hover:border-white/[0.12] transition-all group"
                style={{ textDecoration: 'none' }}>
                <div className="h-24 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-4xl relative overflow-hidden">
                  {ev.imageUrl
                    ? <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover" />
                    : ev.emoji}
                  {ev.live && <span className="absolute top-2 left-2 bg-red text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md">● LIVE</span>}
                  {ev.source === 'ticketmaster' && <span className="absolute bottom-1 right-1 bg-black/60 text-[8px] text-gray-400 px-1 rounded">TM</span>}
                </div>
                <div className="p-3">
                  <p className="text-xs font-bold truncate group-hover:text-cyan transition-colors">{ev.title}</p>
                  <p className="text-[10px] text-gray-light mt-0.5 truncate">📍 {ev.venue}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-gray-muted">📅 {ev.date}</span>
                    <span className="font-heading text-base">{ev.price > 0 ? `$${ev.price}` : 'Free'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* PRIVATE EVENT BUTTON */}
        <div style={{ textAlign: 'center', padding: '8px 0 32px' }}>
          <button onClick={() => setPrivateModal(true)}
            style={{
              background: 'transparent', border: '1px solid #2a2a3a',
              color: '#888', fontSize: 13, padding: '8px 20px',
              borderRadius: 20, cursor: 'pointer', transition: 'all .2s',
            }}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.borderColor = '#a855f7';
              (e.target as HTMLButtonElement).style.color = '#a855f7';
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.borderColor = '#2a2a3a';
              (e.target as HTMLButtonElement).style.color = '#888';
            }}>
            🎉 Ou gen yon envitasyon prive?
          </button>
        </div>

        {/* PRIVATE EVENT MODAL */}
        {privateModal && (
          <div onClick={() => setPrivateModal(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100, padding: 20,
            }}>
            <div onClick={e => e.stopPropagation()}
              style={{
                background: '#12121a', border: '1px solid #2a2a3a',
                borderRadius: 16, padding: 32, width: '100%', maxWidth: 400,
              }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
                <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>
                  Fèt Prive
                </h3>
                <p style={{ color: '#666', fontSize: 13, marginTop: 6 }}>
                  Kole lyen oswa kòd envitasyon ou a
                </p>
              </div>

              <input
                type="text"
                value={privateCode}
                onChange={e => setPrivateCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && privateCode.trim()) {
                    const token = privateCode.trim().split('/').pop() || privateCode.trim();
                    window.location.href = `/e/${token}`;
                  }
                }}
                placeholder="anbyans.events/e/abc123  oswa  abc123"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 8,
                  border: '1px solid #a855f7', background: '#0a0a0f',
                  color: '#fff', fontSize: 13, boxSizing: 'border-box',
                  marginBottom: 12, outline: 'none',
                }}
                autoFocus
              />

              <button
                onClick={() => {
                  const token = privateCode.trim().split('/').pop() || privateCode.trim();
                  if (token) window.location.href = `/e/${token}`;
                }}
                disabled={!privateCode.trim()}
                style={{
                  width: '100%', padding: 13, borderRadius: 8, border: 'none',
                  background: privateCode.trim() ? '#a855f7' : '#2a2a3a',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: privateCode.trim() ? 'pointer' : 'not-allowed',
                  transition: 'background .2s',
                }}>
                Antre nan Evenman an →
              </button>

              <button onClick={() => setPrivateModal(false)}
                style={{
                  width: '100%', padding: 10, marginTop: 8, border: 'none',
                  background: 'transparent', color: '#555', fontSize: 13, cursor: 'pointer',
                }}>
                Anile
              </button>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-border bg-dark-card/50">
        <div className="max-w-6xl mx-auto px-5 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-heading text-lg tracking-widest mb-2">ANBYANS</h4>
              <p className="text-xs text-gray-light italic">{t('landing_tagline')}.</p>
              <p className="text-xs text-gray-muted mt-3">{t('landing_subtitle')}</p>
            </div>
            <div>
              <h5 className="text-xs font-bold text-gray-light mb-3 tracking-wide">PLATFÒM</h5>
              <div className="flex flex-col gap-2">
                <Link href="/events" className="text-xs text-gray-muted hover:text-cyan transition-colors">{t('footer_browse')}</Link>
                <Link href="/auth?tab=organizer" className="text-xs text-gray-muted hover:text-orange transition-colors">{t('footer_organizer')}</Link>
                <Link href="/auth?tab=reseller" className="text-xs text-gray-muted hover:text-purple transition-colors">{t('footer_vendor')}</Link>
                <span className="text-xs text-gray-muted">FAQ</span>
              </div>
            </div>
            <div>
              <h5 className="text-xs font-bold text-gray-light mb-3 tracking-wide">LEGAL</h5>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-gray-muted">Terms</span>
                <span className="text-xs text-gray-muted">Privacy</span>
                <span className="text-xs text-gray-muted">Refunds</span>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-5 flex items-center justify-between">
            <p className="text-[10px] text-gray-muted">© 2026 Lavi Miyò LLC. {t('footer_rights')}</p>
            <div className="flex gap-3">
              {['📘','📸','🐦','▶️'].map((ic, i) => (
                <span key={i} className="w-8 h-8 rounded-lg bg-white/[0.03] border border-border flex items-center justify-center text-xs">{ic}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

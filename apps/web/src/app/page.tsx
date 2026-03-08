'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useT } from '@/i18n';
import { getPublishedEvents, type EventData } from '@/lib/db';
import { fetchHaitianCityEvents, tmEventsToGallery } from '@/lib/ticketmaster';

const LangSwitcher = () => null;

const FALLBACK_GALLERY = [
  { title: 'Kompa Fest 2026', venue: 'Parc Istorik, Milot', date: '15 Mars', emoji: '🎶', price: 15, live: true, imageUrl: '', ticketUrl: '', source: 'anbyans' as const },
  { title: 'DJ Stéphane Live', venue: 'Karibe Hotel, PV', date: '22 Mars', emoji: '🎧', price: 25, live: false, imageUrl: '', ticketUrl: '', source: 'anbyans' as const },
  { title: 'Rara Lakay 2026', venue: 'Champ de Mars, PaP', date: '5 Avr', emoji: '🥁', price: 10, live: false, imageUrl: '', ticketUrl: '', source: 'anbyans' as const },
  { title: 'Tabou Combo 50 Ans', venue: 'Little Haiti, Miami', date: '12 Avr', emoji: '🎺', price: 45, live: false, imageUrl: '', ticketUrl: '', source: 'anbyans' as const },
  { title: 'Kanaval Jacmel', venue: 'Jacmel, Sidès', date: '8 Avr', emoji: '🎭', price: 5, live: true, imageUrl: '', ticketUrl: '', source: 'anbyans' as const },
  { title: 'Jazz nan Lakou', venue: 'Lakou Trignon, PaP', date: '20 Avr', emoji: '🎷', price: 30, live: false, imageUrl: '', ticketUrl: '', source: 'anbyans' as const },
];

type I18nKey = Parameters<ReturnType<typeof useT>['t']>[0];

const FAN_KEYS: I18nKey[] = ['fan_feat_1','fan_feat_2','fan_feat_3','fan_feat_4','fan_feat_5','fan_feat_6'];
const ORG_KEYS: I18nKey[] = ['org_feat_1','org_feat_2','org_feat_3','org_feat_4','org_feat_5','org_feat_6'];
const VEND_KEYS: I18nKey[] = ['vend_feat_1','vend_feat_2','vend_feat_3','vend_feat_4','vend_feat_5','vend_feat_6'];

type GalleryItem = {
  title: string;
  venue: string;
  date: string;
  emoji: string;
  price: number;
  live: boolean;
  imageUrl?: string;
  ticketUrl?: string;
  source: 'anbyans' | 'ticketmaster';
};

export default function LandingPage() {
  const router = useRouter();
  const { t } = useT();
  const [q, setQ] = useState('');
  const [gallery, setGallery] = useState<GalleryItem[]>(FALLBACK_GALLERY);

  useEffect(() => {
    async function loadEvents() {
      const combined: GalleryItem[] = [];
      const emojis = ['🎶','🎧','🥁','🎺','🎭','🎷','🎵','🎤','🪘','🎹'];

      // Load Anbyans events from Firestore
      try {
        const anbyansEvents = await getPublishedEvents();
        for (let i = 0; i < anbyansEvents.length; i++) {
          const e = anbyansEvents[i];
          combined.push({
            title: e.name,
            venue: `${e.venue?.name || ''}, ${e.venue?.city || ''}`,
            date: e.startDate,
            emoji: emojis[i % emojis.length],
            price: e.sections?.length ? Math.min(...e.sections.map(s => s.price)) : 0,
            live: e.status === 'live',
            imageUrl: e.imageUrl || '',
            ticketUrl: '',
            source: 'anbyans',
          });
        }
      } catch (err) {
        console.error('Anbyans events error:', err);
      }

     // Only fetch Ticketmaster if fewer than 10 Anbyans events
if (combined.length < 10) {
  try {
    const tmEvents = await fetchHaitianCityEvents(4);
    const tmGallery = tmEventsToGallery(tmEvents);
    combined.push(...tmGallery);
  } catch (err) {
    console.error('Ticketmaster events error:', err);
  }
}

      // Use combined if we got anything, otherwise fallback
      if (combined.length > 0) {
        setGallery(combined);
      }
    }

    loadEvents();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-dark border-b border-border px-5">
        <div className="max-w-6xl mx-auto flex items-center h-14 gap-3">
          <Link href="/"><img src="/logo.jpg" alt="Anbyans" className="h-8 rounded" /></Link>
          <span className="font-heading text-lg tracking-widest hidden sm:inline">ANBYANS</span>
          <div className="flex-1" />
          <LangSwitcher />
        </div>
      </nav>

      <main className="flex-1">
        {/* HERO */}
        <section className="text-center pt-20 pb-16 px-5">
          <h1 className="font-heading text-5xl sm:text-7xl tracking-wider">
            ANBYANS <span className="bg-gradient-to-r from-cyan to-teal-400 bg-clip-text text-transparent">EVENTS</span>
          </h1>
          <p className="text-gray-light text-sm sm:text-base italic mt-3 mb-8">{t('landing_tagline')}.</p>
          <div className="max-w-lg mx-auto flex bg-dark-card border border-border rounded-xl overflow-hidden focus-within:border-cyan transition-colors">
            <div className="flex items-center pl-4 text-gray-muted">🔍</div>
            <input
              type="text" placeholder={t('browse_search_placeholder')} value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && router.push('/events')}
              className="flex-1 bg-transparent px-3 py-3.5 text-sm text-white placeholder:text-gray-muted outline-none font-body"
            />
            <Link href="/events" className="px-5 bg-cyan text-dark font-bold text-sm font-body hover:bg-white transition-colors flex items-center whitespace-nowrap">
              {t('landing_browse')}
            </Link>
          </div>
        </section>

        {/* GALLERY SCROLL */}
        <section className="relative overflow-hidden py-4 mb-12">
          <div className="flex gap-4 px-5 animate-scroll hover:[animation-play-state:paused]">
            {[...(gallery.length >= 8 ? gallery : [...gallery, ...gallery])].map((ev, i) => {
         const CardWrapper = ({ children, ...props }: any) => <Link href="/events" {...props}>{children}</Link>;
              return (
                <CardWrapper key={i} className="flex-shrink-0 w-[200px] bg-dark-card border border-border rounded-card overflow-hidden hover:border-white/[0.12] transition-all group">
                  <div className="h-24 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-4xl relative overflow-hidden">
                    {ev.imageUrl ? (
                      <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover" />
                    ) : (
                      ev.emoji
                    )}
                    {ev.live && <span className="absolute top-2 left-2 bg-red text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md animate-pulse">● LIVE</span>}
                    {ev.source === 'ticketmaster' && (
                      <span className="absolute bottom-1 right-1 bg-black/60 text-[8px] text-gray-400 px-1 rounded">TM</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold truncate group-hover:text-cyan transition-colors">{ev.title}</p>
                    <p className="text-[10px] text-gray-light mt-0.5 truncate">📍 {ev.venue}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-gray-muted">📅 {ev.date}</span>
                      <span className="font-heading text-base">{ev.price > 0 ? `$${ev.price}` : 'Free'}</span>
                    </div>
                  </div>
                </CardWrapper>
              );
            })}
          </div>
        </section>

      </main>
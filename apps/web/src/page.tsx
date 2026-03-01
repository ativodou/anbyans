'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';
import { TranslationKey } from '@/i18n/translations';

const GALLERY = [
  { title: 'Kompa Fest 2026', venue: 'Parc Istorik, Milot', date: '15 Mars', emoji: '🎶', price: 15, live: true },
  { title: 'DJ Stéphane Live', venue: 'Karibe Hotel, PV', date: '22 Mars', emoji: '🎧', price: 25, live: false },
  { title: 'Rara Lakay 2026', venue: 'Champ de Mars, PaP', date: '5 Avr', emoji: '🥁', price: 10, live: false },
  { title: 'Tabou Combo 50 Ans', venue: 'Little Haiti, Miami', date: '12 Avr', emoji: '🎺', price: 45, live: false },
  { title: 'Kanaval Jacmel', venue: 'Jacmel, Sidès', date: '8 Avr', emoji: '🎭', price: 5, live: true },
  { title: 'Jazz nan Lakou', venue: 'Lakou Trignon, PaP', date: '20 Avr', emoji: '🎷', price: 30, live: false },
];

const FAN_KEYS: TranslationKey[] = ['fan_feat_1','fan_feat_2','fan_feat_3','fan_feat_4','fan_feat_5','fan_feat_6'];
const ORG_KEYS: TranslationKey[] = ['org_feat_1','org_feat_2','org_feat_3','org_feat_4','org_feat_5','org_feat_6'];
const VEND_KEYS: TranslationKey[] = ['vend_feat_1','vend_feat_2','vend_feat_3','vend_feat_4','vend_feat_5','vend_feat_6'];

export default function LandingPage() {
  const router = useRouter();
  const { t } = useT();
  const [q, setQ] = useState('');

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
            ANBYANS <span className="bg-gradient-to-r from-cyan to-teal-400 bg-clip-text text-transparent">ENTERTAINMENT</span>
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

        {/* GALLERY */}
        <section className="relative overflow-hidden py-4 mb-12">
          <div className="flex gap-4 px-5 animate-scroll hover:[animation-play-state:paused]">
            {[...GALLERY, ...GALLERY].map((ev, i) => (
              <Link key={i} href="/events" className="flex-shrink-0 w-[200px] bg-dark-card border border-border rounded-card overflow-hidden hover:border-white/[0.12] transition-all group">
                <div className="h-24 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-4xl relative">
                  {ev.emoji}
                  {ev.live && <span className="absolute top-2 left-2 bg-red text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md animate-pulse">● LIVE</span>}
                </div>
                <div className="p-3">
                  <p className="text-xs font-bold truncate group-hover:text-cyan transition-colors">{ev.title}</p>
                  <p className="text-[10px] text-gray-light mt-0.5 truncate">📍 {ev.venue}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-gray-muted">📅 {ev.date}</span>
                    <span className="font-heading text-base">${ev.price}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* THREE COLUMNS */}
        <section className="max-w-4xl mx-auto px-5 pb-16">
          <h2 className="font-heading text-2xl tracking-wider text-center mb-8">{t('landing_how')}?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Fan */}
            <div className="bg-dark-card border border-cyan-border rounded-card p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold border bg-cyan-dim text-cyan border-cyan-border">🎫 {t('landing_fan_badge')}</span>
                <Link href="/auth" className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan text-dark hover:bg-white transition-all">{t('landing_fan_cta')}</Link>
              </div>
              <h3 className="font-heading text-xl tracking-wide mb-3">{t('landing_fan_heading')}</h3>
              <div className="space-y-2.5">{FAN_KEYS.map(k => <p key={k} className="text-xs text-gray-light">{t(k)}</p>)}</div>
            </div>
            {/* Organizer */}
            <div className="bg-dark-card border border-orange-border rounded-card p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold border bg-orange-dim text-orange border-orange-border">🎤 {t('landing_org_badge')}</span>
                <Link href="/organizer/auth" className="px-4 py-2 rounded-lg text-xs font-bold bg-orange text-white hover:bg-orange/80 transition-all">{t('landing_org_cta')}</Link>
              </div>
              <h3 className="font-heading text-xl tracking-wide mb-3">{t('landing_org_heading')}</h3>
              <div className="space-y-2.5">{ORG_KEYS.map(k => <p key={k} className="text-xs text-gray-light">{t(k)}</p>)}</div>
            </div>
            {/* Vendor */}
            <div className="bg-dark-card border border-purple-border rounded-card p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold border bg-purple-dim text-purple border-purple-border">🏪 {t('landing_vend_badge')}</span>
                <Link href="/vendor/auth" className="px-4 py-2 rounded-lg text-xs font-bold bg-purple text-white hover:bg-purple/80 transition-all">{t('landing_vend_cta')}</Link>
              </div>
              <h3 className="font-heading text-xl tracking-wide mb-3">{t('landing_vend_heading')}</h3>
              <div className="space-y-2.5">{VEND_KEYS.map(k => <p key={k} className="text-xs text-gray-light">{t(k)}</p>)}</div>
            </div>
          </div>
        </section>
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
                <Link href="/organizer/auth" className="text-xs text-gray-muted hover:text-orange transition-colors">{t('footer_organizer')}</Link>
                <Link href="/vendor/auth" className="text-xs text-gray-muted hover:text-purple transition-colors">{t('footer_vendor')}</Link>
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
            <p className="text-[10px] text-gray-muted">© 2026 Anbyans Entertainment LLC. {t('footer_rights')}</p>
            <div className="flex gap-3">
              {['📘','📸','🐦','▶️'].map((ic,i) => <span key={i} className="w-8 h-8 rounded-lg bg-white/[0.03] border border-border flex items-center justify-center text-xs">{ic}</span>)}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

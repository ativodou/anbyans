'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';

const MONTHS_HT = ['Jan','Fev','Mas','Avr','Me','Jen','Jiy','Out','Sep','Okt','Nov','Des'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

const EVENTS = [
  { id:1, title:'Kompa Fest 2026', cat:'Mizik', venue:'Parc Istorik', city:'Milot', date:'2026-03-15', time:'20:00', price:15, emoji:'🎶', status:'live', sold:842, cap:1200, featured:true, artists:'T-Vice, Klass, Harmonik' },
  { id:2, title:'DJ Stéphane Live', cat:'Fèt', venue:'Karibe Hotel', city:'Pétion-Ville', date:'2026-03-22', time:'22:00', price:25, emoji:'🎧', status:'soon', sold:305, cap:500, artists:'DJ Stéphane' },
  { id:3, title:'Rara Lakay 2026', cat:'Festival', venue:'Champ de Mars', city:'Pòtoprens', date:'2026-04-05', time:'18:00', price:10, emoji:'🥁', status:'soon', sold:100, cap:2000, artists:'RAM, Boukman Eksperyans' },
  { id:4, title:'Gala Solidarite', cat:'Gala', venue:'Marriott', city:'Pòtoprens', date:'2026-04-12', time:'19:00', price:75, emoji:'✨', status:'soon', sold:45, cap:300, artists:'Emeline Michel' },
  { id:5, title:'Stand-up Kreyòl', cat:'Teyat', venue:'Yanvalou Club', city:'Pétion-Ville', date:'2026-03-28', time:'20:30', price:20, emoji:'😂', status:'soon', sold:180, cap:400, artists:'Tonton Bicha, Jesifra' },
  { id:6, title:'Konferans Tech Ayiti', cat:'Konferans', venue:'Centre de Convention', city:'Tabarre', date:'2026-04-20', time:'09:00', price:0, emoji:'💻', status:'soon', sold:200, cap:500, artists:'' },
  { id:7, title:'Tropical Night', cat:'Fèt', venue:'El Rancho Hotel', city:'Pétion-Ville', date:'2026-04-02', time:'22:00', price:30, emoji:'🌴', status:'soon', sold:0, cap:600, artists:'DJ Michael B, Baky' },
  { id:8, title:'Haitian Heritage Gala', cat:'Gala', venue:'BAM Brooklyn', city:'Brooklyn', date:'2026-05-18', time:'18:00', price:50, emoji:'🎭', status:'soon', sold:120, cap:2100, artists:'Tabou Combo' },
  { id:9, title:'Pool Party Ete', cat:'Fèt', venue:'Royal Oasis Hotel', city:'Pétion-Ville', date:'2026-06-14', time:'14:00', price:15, emoji:'🏊', status:'soon', sold:0, cap:250, artists:'Roody Roodboy' },
  { id:10, title:'Match Espò Solidarite', cat:'Espò', venue:'Stade Sylvio Cator', city:'Pòtoprens', date:'2026-04-26', time:'16:00', price:5, emoji:'⚽', status:'soon', sold:3200, cap:15000, artists:'' },
  { id:11, title:'Nwit Jazz Jacmel', cat:'Mizik', venue:'Lakou Musik', city:'Jacmel', date:'2026-05-10', time:'20:00', price:20, emoji:'🎷', status:'soon', sold:50, cap:350, artists:'BélO, Beethova Obas' },
  { id:12, title:'Kompa vs Zouk', cat:'Mizik', venue:'Miramar Cultural Center', city:'Miami', date:'2026-05-24', time:'21:00', price:35, emoji:'🎵', status:'soon', sold:280, cap:800, artists:'Nu Look, Kassav' },
];

const CATS_I18N = {
  all:       { ht:'Tout', en:'All', fr:'Tous' },
  Mizik:     { ht:'🎵 Mizik', en:'🎵 Music', fr:'🎵 Musique' },
  'Fèt':     { ht:'🎉 Fèt', en:'🎉 Party', fr:'🎉 Fête' },
  Festival:  { ht:'🎪 Festival', en:'🎪 Festival', fr:'🎪 Festival' },
  Teyat:     { ht:'🎭 Teyat', en:'🎭 Theater', fr:'🎭 Théâtre' },
  'Espò':    { ht:'⚽ Espò', en:'⚽ Sports', fr:'⚽ Sports' },
  Konferans: { ht:'🎓 Konferans', en:'🎓 Conference', fr:'🎓 Conférence' },
  Gala:      { ht:'✨ Gala', en:'✨ Gala', fr:'✨ Gala' },
};

const CITIES = ['','Pòtoprens','Pétion-Ville','Jacmel','Milot','Tabarre','Miami','Brooklyn'];

export default function BrowseEventsPage() {
  const { t, locale } = useT();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [city, setCity] = useState('');
  const [price, setPrice] = useState('');

  const months = locale === 'en' ? MONTHS_EN : locale === 'fr' ? MONTHS_FR : MONTHS_HT;

  const filtered = useMemo(() => {
    let list = [...EVENTS];
    if (cat !== 'all') list = list.filter(e => e.cat === cat);
    if (search) { const q = search.toLowerCase(); list = list.filter(e => e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q) || e.city.toLowerCase().includes(q) || e.artists.toLowerCase().includes(q)); }
    if (city) list = list.filter(e => e.city === city);
    if (price === 'free') list = list.filter(e => e.price === 0);
    else if (price === 'under25') list = list.filter(e => e.price > 0 && e.price < 25);
    else if (price === 'under50') list = list.filter(e => e.price < 50);
    else if (price === 'under100') list = list.filter(e => e.price < 100);
    else if (price === 'over100') list = list.filter(e => e.price >= 100);
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return list;
  }, [search, cat, city, price]);

  const liveLabel = { ht:'● AN DIRÈK', en:'● LIVE', fr:'● EN DIRECT' }[locale];
  const upcomingLabel = { ht:'EVÈNMAN AP VINI', en:'UPCOMING EVENTS', fr:'ÉVÉNEMENTS À VENIR' }[locale];
  const allPlaces = { ht:'📍 Tout kote', en:'📍 All locations', fr:'📍 Tous les lieux' }[locale];
  const allPrices = { ht:'💲 Tout pri', en:'💲 All prices', fr:'💲 Tous les prix' }[locale];
  const freeLabel = { ht:'Gratis', en:'Free', fr:'Gratuit' }[locale];
  const noResults = { ht:'Pa gen rezilta', en:'No results', fr:'Aucun résultat' }[locale];
  const tryAgain = { ht:'Eseye chèche ak lòt mo oswa retire filtè yo.', en:'Try different keywords or remove filters.', fr:'Essayez d\'autres mots-clés ou supprimez les filtres.' }[locale];
  const backHome = { ht:'← Retounen Lakay', en:'← Back Home', fr:'← Retour à l\'accueil' }[locale];
  const promoterLabel = { ht:'Promotè', en:'Promoter', fr:'Promoteur' }[locale];
  const remainingLabel = { ht:'rete', en:'left', fr:'restant' }[locale];
  const reserveLabel = { ht:'Rezève', en:'Reserve', fr:'Réserver' }[locale];
  const buyLabel = { ht:'Achte', en:'Buy', fr:'Acheter' }[locale];

  return (
    <div className="min-h-screen flex flex-col">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-dark border-b border-border px-5">
        <div className="max-w-[1200px] mx-auto flex items-center h-14 gap-4">
          <Link href="/"><img src="/logo.jpg" alt="Anbyans" className="h-8 rounded" /></Link>
          <div className="flex-1 max-w-[420px] relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-muted">🔍</span>
            <input type="text" placeholder={t('browse_search_placeholder')} value={search} onChange={e => setSearch(e.target.value)}
              className="w-full py-2 pl-9 pr-3.5 rounded-[10px] bg-white/5 border border-border text-white text-[13px] font-body outline-none focus:border-orange transition-colors placeholder:text-gray-muted" />
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Link href="/organizer/auth" className="text-xs text-gray-light hover:text-white transition-colors hidden sm:inline">{promoterLabel}</Link>
            <LangSwitcher />
            <Link href="/auth" className="px-3.5 py-1.5 rounded-lg border border-orange-border bg-orange-dim text-orange text-xs font-bold hover:bg-orange hover:text-white transition-all">{t('signup')}</Link>
            <Link href="/auth" className="px-3.5 py-1.5 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">{t('login')}</Link>
          </div>
        </div>
      </nav>

      {/* FILTERS */}
      <div className="max-w-[1200px] mx-auto w-full px-5 py-3.5 flex items-center gap-2 overflow-x-auto">
        {Object.entries(CATS_I18N).map(([id, labels]) => (
          <button key={id} onClick={() => setCat(id)}
            className={`px-4 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-all ${cat === id ? 'border-orange bg-orange-dim text-orange' : 'border-border text-gray-light hover:border-white/[0.15] hover:text-white'}`}>
            {labels[locale]}
          </button>
        ))}
        <div className="w-px h-5 bg-border flex-shrink-0" />
        <select value={city} onChange={e => setCity(e.target.value)} className="px-3 py-1.5 pr-7 rounded-full border border-border bg-transparent text-gray-light text-[11px] font-semibold outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%278%27%20height%3D%275%27%20viewBox%3D%270%200%2010%206%27%20fill%3D%27none%27%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%3E%3Cpath%20d%3D%27M1%201l4%204%204-4%27%20stroke%3D%27%239999AD%27%20stroke-width%3D%271.5%27%20stroke-linecap%3D%27round%27/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_10px_center]">
          <option value="" className="bg-dark-card">{allPlaces}</option>
          {CITIES.filter(Boolean).map(c => <option key={c} value={c} className="bg-dark-card">{c}</option>)}
        </select>
        <select value={price} onChange={e => setPrice(e.target.value)} className="px-3 py-1.5 pr-7 rounded-full border border-border bg-transparent text-gray-light text-[11px] font-semibold outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%278%27%20height%3D%275%27%20viewBox%3D%270%200%2010%206%27%20fill%3D%27none%27%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%3E%3Cpath%20d%3D%27M1%201l4%204%204-4%27%20stroke%3D%27%239999AD%27%20stroke-width%3D%271.5%27%20stroke-linecap%3D%27round%27/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_10px_center]">
          <option value="" className="bg-dark-card">{allPrices}</option>
          <option value="free" className="bg-dark-card">{freeLabel}</option>
          <option value="under25" className="bg-dark-card">&lt; $25</option>
          <option value="under50" className="bg-dark-card">&lt; $50</option>
          <option value="under100" className="bg-dark-card">&lt; $100</option>
          <option value="over100" className="bg-dark-card">$100+</option>
        </select>
      </div>

      {/* GRID */}
      <div className="max-w-[1200px] mx-auto w-full px-5 pb-10 flex-1">
        <div className="font-heading text-xl tracking-wide mb-3.5 flex items-center gap-2">
          {upcomingLabel} <span className="text-xs text-gray-muted font-body font-normal tracking-normal">({filtered.length})</span>
        </div>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filtered.map((ev, i) => {
              const d = new Date(ev.date);
              const avail = ev.cap - ev.sold;
              const low = (ev.sold / ev.cap) > 0.85;
              return (
                <Link key={ev.id} href={`/buy?id=${ev.id}`}
                  className={`bg-dark-card border border-border rounded-card overflow-hidden hover:border-white/[0.1] hover:-translate-y-0.5 hover:shadow-2xl transition-all group ${ev.featured && i === 0 ? 'sm:col-span-2 sm:grid sm:grid-cols-2' : ''}`}>
                  <div className={`bg-gradient-to-br from-[#1a1020] to-[#0d1525] flex items-center justify-center relative ${ev.featured && i === 0 ? 'h-48 sm:h-full sm:min-h-[240px]' : 'h-40'}`}>
                    <span className={ev.featured && i === 0 ? 'text-7xl' : 'text-5xl'}>{ev.emoji}</span>
                    <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md border border-white/[0.08] rounded-lg px-2.5 py-1 text-center">
                      <div className="font-heading text-xl leading-none">{d.getDate()}</div>
                      <div className="text-[9px] uppercase tracking-widest text-orange">{months[d.getMonth()]}</div>
                    </div>
                    {ev.status === 'live' && <div className="absolute top-2.5 right-2.5 bg-red text-white text-[9px] font-bold px-2.5 py-1 rounded-full animate-pulse">{liveLabel}</div>}
                  </div>
                  <div className={`p-3.5 flex flex-col ${ev.featured && i === 0 ? 'justify-center sm:p-5' : ''}`}>
                    <div className="text-[9px] uppercase tracking-widest text-cyan font-bold mb-1">{CATS_I18N[ev.cat as keyof typeof CATS_I18N]?.[locale] || ev.cat}</div>
                    <h3 className={`font-bold mb-1.5 leading-tight group-hover:text-cyan transition-colors ${ev.featured && i === 0 ? 'text-xl' : 'text-[15px]'}`}>{ev.title}</h3>
                    <div className="space-y-0.5 mb-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-light"><span className="w-3.5 text-center text-xs">📍</span>{ev.venue}, {ev.city}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-light"><span className="w-3.5 text-center text-xs">🕐</span>{ev.time}{ev.artists && ` · ${ev.artists}`}</div>
                    </div>
                    <div className="flex items-center justify-between pt-2.5 border-t border-border">
                      <div className="font-heading text-xl text-orange">{ev.price === 0 ? freeLabel?.toUpperCase() : <><span className="text-[9px] text-gray-muted font-body font-normal">{t('browse_from').toLowerCase()}</span> ${ev.price}</>}</div>
                      <div className={`text-[10px] ${low ? 'text-red' : 'text-gray-light'}`}>{low ? `⚡ ${avail} ${remainingLabel}!` : `${avail.toLocaleString()} ${t('buy_available')}`}</div>
                      <span className="px-3.5 py-1.5 rounded-lg bg-orange text-white text-[11px] font-bold">{ev.price === 0 ? reserveLabel : buyLabel}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🔍</div>
            <h3 className="text-base font-bold mb-1.5">{noResults}</h3>
            <p className="text-xs text-gray-muted">{tryAgain}</p>
          </div>
        )}
      </div>

      <footer className="border-t border-border py-6 px-5">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <p className="text-[10px] text-gray-muted">© 2026 Anbyans Entertainment LLC</p>
          <Link href="/" className="text-xs text-gray-light hover:text-cyan transition-colors">{backHome}</Link>
        </div>
      </footer>
    </div>
  );
}

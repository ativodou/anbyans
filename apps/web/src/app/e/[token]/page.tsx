'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n';
import { getEventByPrivateToken, type EventData } from '@/lib/db';
import LangSwitcher from '@/components/LangSwitcher';

export default function PrivateEventPage({ params }: { params: { token: string } }) {
  const { locale } = useT();
  const router = useRouter();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale as 'ht' | 'en' | 'fr']);

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getEventByPrivateToken(params.token)
      .then(ev => { if (!ev) setNotFound(true); else setEvent(ev); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.token]);

  const minPrice = event?.sections?.length ? Math.min(...event.sections.map(s => s.price)) : 0;
  const emoji = event?.category === 'Mizik' ? '🎶' : event?.category === 'Fèt' ? '🎧' : event?.category === 'Festival' ? '🥁' : '🎭';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound || !event) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <h1 className="font-heading text-2xl tracking-wide mb-2">{L('Lyen sa a pa valid','This link is not valid','Ce lien n\'est pas valide')}</h1>
      <p className="text-sm text-gray-light mb-6">{L('Lyen prive a ekspire oswa li pa korèk. Kontakte òganizatè a.','The private link has expired or is incorrect. Contact the organizer.','Le lien privé a expiré. Contactez l\'organisateur.')}</p>
      <Link href="/" className="px-5 py-2.5 rounded-[10px] bg-orange text-white text-sm font-bold hover:bg-orange/80 transition-all">{L('Retounen Akèy','Go Home','Retour')}</Link>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 bg-dark border-b border-border px-5">
        <div className="max-w-[760px] mx-auto flex items-center h-[52px] gap-3">
          <Link href="/"><span className="font-heading text-sm tracking-widest">ANBYANS</span></Link>
          <span className="flex-1" />
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange/20 text-orange border border-orange/30">🔒 {L('PRIVE','PRIVATE','PRIVÉ')}</span>
          <LangSwitcher />
        </div>
      </nav>

      <div className="max-w-[760px] mx-auto w-full px-5 py-8 flex-1">
        <div className="bg-dark-card border border-border rounded-2xl overflow-hidden mb-6">
          <div className="h-[180px] bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center relative">
            <span className="text-8xl">{emoji}</span>
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[9px] font-bold bg-orange text-white">🔒 {L('EVENMAN PRIVE','PRIVATE EVENT','ÉVÈNEMENT PRIVÉ')}</div>
            {event.status === 'live' && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red/20 border border-red/30">
                <div className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
                <span className="text-[9px] font-bold text-red">{L('AN DIRÈK','LIVE','EN DIRECT')}</span>
              </div>
            )}
          </div>
          <div className="p-5">
            <div className="text-[9px] uppercase tracking-widest text-cyan font-bold mb-1">{event.category}</div>
            <h1 className="font-heading text-2xl tracking-wide mb-3">{event.name}</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {event.venue?.name && (<div className="flex items-center gap-2 text-sm text-gray-light"><span className="text-lg">📍</span><div><p className="text-white font-semibold text-xs">{event.venue.name}</p>{event.venue.city && <p className="text-[11px] text-gray-muted">{event.venue.city}</p>}</div></div>)}
              {event.startDate && (<div className="flex items-center gap-2 text-sm text-gray-light"><span className="text-lg">📅</span><div><p className="text-white font-semibold text-xs">{event.startDate}</p>{event.startTime && <p className="text-[11px] text-gray-muted">🕐 {event.startTime}</p>}</div></div>)}
            </div>
            {event.description && <p className="text-sm text-gray-light leading-relaxed">{event.description}</p>}
          </div>
        </div>

        {event.sections && event.sections.length > 0 && (
          <div className="mb-6">
            <h2 className="font-heading text-base tracking-wide mb-3 text-gray-light">{L('TIKÈ DISPONIB','AVAILABLE TICKETS','BILLETS DISPONIBLES')}</h2>
            <div className="flex flex-col gap-2">
              {event.sections.map((s, i) => {
                const avail = s.capacity - (s.sold || 0);
                const pct = s.capacity > 0 ? Math.round((s.sold || 0) / s.capacity * 100) : 0;
                return (<div key={i} className="flex items-center gap-3.5 bg-dark-card border border-border rounded-card p-4"><div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} /><div className="flex-1"><p className="font-bold text-sm">{s.name}</p><p className={`text-[11px] mt-0.5 ${pct > 75 ? 'text-red' : 'text-green'}`}>{pct > 75 ? '⚡ ' : ''}{avail} {L('disponib','available','disponible')}</p></div><div className="text-right"><p className="font-heading text-xl" style={{ color: s.color }}>${s.price}</p><p className="text-[9px] text-gray-muted">{L('pa tikè','per ticket','par billet')}</p></div></div>);
              })}
            </div>
          </div>
        )}

        <div className="bg-dark-card border border-border rounded-2xl p-5 text-center">
          <p className="text-sm text-gray-light mb-1">{L('Tikè depi','Tickets from','Billets à partir de')}</p>
          <p className="font-heading text-4xl text-cyan mb-4">${minPrice}</p>
          <button onClick={() => router.push(`/buy?event=${event.id}&token=${params.token}`)} className="w-full py-3.5 rounded-[12px] bg-cyan text-dark font-bold text-base hover:bg-white transition-all">🎫 {L('Achte Tikè','Buy Tickets','Acheter des billets')}</button>
          <p className="text-[10px] text-gray-muted mt-3">🔒 {L('Evenman sa a se envitasyon sèlman. Pa pataje lyen sa a.','This event is invitation only. Please do not share this link.','Cet évènement est sur invitation uniquement. Ne partagez pas ce lien.')}</p>
        </div>
      </div>
    </div>
  );
}

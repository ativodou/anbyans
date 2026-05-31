'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getEvent, getGuestList, type EventData, type Invitation } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface Ticket { id: string; status: string; paymentStatus: string; paymentMethod: string; buyerName: string; price: number; barPreorder?: any[]; barTabBalance?: number; }
interface BarItem { name: string; qty: number; price: number; station: string; }

export default function EventOverviewPage() {
  const { id: eventId } = useParams() as { id: string };
  const { user } = useAuth();
  const { t } = useT();

  const [event, setEvent]     = useState<EventData | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [guests, setGuests]   = useState<Invitation[]>([]);
  const [preorders, setPreorders] = useState<BarItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !user?.uid) return;
    (async () => {
      try {
        const [ev, guestList, tSnap] = await Promise.all([
          getEvent(eventId),
          getGuestList(eventId).catch(() => [] as Invitation[]),
          getDocs(query(collection(db, 'tickets'), where('eventId', '==', eventId))),
        ]);
        setEvent(ev);
        setGuests(guestList);
        const tks = tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
        setTickets(tks);

        // Aggregate bar preorders
        const agg: Record<string, BarItem> = {};
        tks.forEach(tk => {
          (tk.barPreorder || []).forEach((o: BarItem) => {
            if (!agg[o.name]) agg[o.name] = { name: o.name, qty: 0, price: o.price, station: o.station };
            agg[o.name].qty += o.qty;
          });
        });
        setPreorders(Object.values(agg).sort((a, b) => b.qty - a.qty));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [eventId, user?.uid]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  if (!event) return <div className="text-gray-muted p-8">Evènman pa jwenn.</div>;

  const validTickets  = tickets.filter(t => t.status === 'valid' || t.status === 'used');
  const pendingTickets = tickets.filter(t => t.status === 'pending');
  const revenue = validTickets.reduce((s, t) => s + (t.price || 0), 0);
  const capacity = (event.sections || []).reduce((s, sec) => s + (sec.capacity || 0), 0);
  const isFree = event.privateMode === 'free' || validTickets.every(t => t.price === 0);
  const confirmedGuests = guests.filter(g => g.status === 'confirmed').length;
  const totalGuestTickets = guests.filter(g => g.status === 'confirmed').reduce((s, g) => s + (g.ticketCount || 1), 0);
  const barTotal = preorders.reduce((s, o) => s + o.price * o.qty, 0);
  const barTabTotal = validTickets.reduce((s, t) => s + (t.barTabBalance || 0), 0);
  const stations = Array.from(new Set(preorders.map(o => o.station)));

  const card  = 'bg-dark-card border border-border rounded-card';
  const statCard = `${card} p-4 flex flex-col gap-1`;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <Link href="/organizer/events" className="inline-flex items-center gap-1 text-[11px] text-gray-muted hover:text-white mb-3 transition-colors">
        {t('overview_back')}
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl tracking-wide uppercase">{event.name}</h2>
          <p className="text-xs text-gray-muted mt-1">
            {event.startDate || '—'} · {event.isPrivate ? (event.privateMode === 'free' ? t('overview_private_free') : t('overview_private_paid')) : t('overview_public')}
          </p>
        </div>
        <Link href={`/organizer/events/${eventId}/edit`}
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-muted hover:text-white transition-all">
          {t('overview_edit_btn')}
        </Link>
      </div>

      {/* ── Stat row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={statCard}>
          <p className="text-[10px] text-gray-muted uppercase tracking-widest">Tikè Valid</p>
          <p className="font-heading text-3xl text-green">{validTickets.length}</p>
          {capacity > 0 && <p className="text-[10px] text-gray-muted">{Math.round(validTickets.length/capacity*100)}% plas</p>}
        </div>
        {pendingTickets.length > 0 && (
          <div className={statCard}>
            <p className="text-[10px] text-gray-muted uppercase tracking-widest">An Atant</p>
            <p className="font-heading text-3xl text-orange">{pendingTickets.length}</p>
            <Link href={`/organizer/pending-tickets`} className="text-[10px] text-orange hover:underline">Jere →</Link>
          </div>
        )}
        {!isFree && (
          <div className={statCard}>
            <p className="text-[10px] text-gray-muted uppercase tracking-widest">Revni</p>
            <p className="font-heading text-3xl">${revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        )}
        {event.isPrivate && (
          <div className={statCard}>
            <p className="text-[10px] text-gray-muted uppercase tracking-widest">RSVP</p>
            <p className="font-heading text-3xl text-green">{confirmedGuests}<span className="text-lg text-gray-muted">/{guests.length}</span></p>
            {guests.length - confirmedGuests > 0
              ? <p className="text-[10px] text-orange">{guests.length - confirmedGuests} an atant</p>
              : <p className="text-[10px] text-gray-muted">{totalGuestTickets} tikè total</p>}
          </div>
        )}
        {barTotal > 0 && (
          <div className={statCard}>
            <p className="text-[10px] text-gray-muted uppercase tracking-widest">Bar Pre-Orders</p>
            <p className="font-heading text-3xl text-orange">${barTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        )}
      </div>

      {/* ── Guest list (private events) ── */}
      {event.isPrivate && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-muted">Lis Envitasyon</h3>
            <Link href={`/organizer/events/${eventId}/guests`} className="text-[10px] text-orange hover:underline">Jere →</Link>
          </div>
          {guests.length === 0 ? (
            <div className={`${card} p-6 text-center text-gray-muted text-sm`}>Pa gen envite ankò.</div>
          ) : (
            <div className={card}>
              {guests.slice(0, 8).map((g, i) => (
                <div key={g.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                  <div>
                    <p className="text-sm font-semibold">{g.guestName}</p>
                    <p className="text-[11px] text-gray-muted">{[g.guestEmail, g.guestPhone].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(g.allowPlusOnes ?? 0) > 0 && <span className="text-[9px] text-gray-muted">+{g.allowPlusOnes}</span>}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${g.status === 'confirmed' ? 'bg-green-900/30 text-green' : 'bg-white/[0.06] text-gray-muted'}`}>
                      {g.status === 'confirmed' ? `✓ Konfime${(g.ticketCount||1)>1?` ×${g.ticketCount}`:''}` : 'Envite'}
                    </span>
                  </div>
                </div>
              ))}
              {guests.length > 8 && (
                <div className="px-4 py-3 border-t border-border text-center">
                  <Link href={`/organizer/events/${eventId}/guests`} className="text-[10px] text-orange hover:underline">
                    Wè tout {guests.length} envite →
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Bar preorders ── */}
      {preorders.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-muted">Bar Pre-Orders</h3>
            <span className="text-[10px] text-orange font-bold">${barTotal.toFixed(2)} total</span>
          </div>
          <div className={card}>
            {stations.map((station, si) => (
              <div key={station}>
                <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-widest text-gray-muted">{station}</p>
                {preorders.filter(o => o.station === station).map((o, i) => (
                  <div key={o.name} className={`flex items-center justify-between px-4 py-2.5 ${i > 0 || si > 0 ? 'border-t border-border' : ''}`}>
                    <p className="text-sm">{o.name}</p>
                    <div className="flex items-center gap-3">
                      <span className="font-heading text-xl text-orange">×{o.qty}</span>
                      <span className="text-[11px] text-green">${(o.price * o.qty).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {barTabTotal > 0 && (
              <div className="flex justify-between items-center px-4 py-3 border-t border-border">
                <p className="text-[11px] text-gray-muted">Total Bar Credit</p>
                <p className="text-sm font-bold text-orange">${barTabTotal.toFixed(2)}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Tickets by payment method ── */}
      {validTickets.length > 0 && !isFree && (
        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-muted mb-3">Tikè pa Metòd Peman</h3>
          <div className={`${card} divide-y divide-border`}>
            {(['stripe','moncash','natcash','cash','free'] as const).map(m => {
              const cnt = validTickets.filter(t => t.paymentMethod === m).length;
              if (!cnt) return null;
              const labels: Record<string,string> = { stripe:'Stripe 💳', moncash:'MonCash 📱', natcash:'NatCash 💚', cash:'Kach 💵', free:'Gratis 🎊' };
              return (
                <div key={m} className="flex justify-between items-center px-4 py-3">
                  <p className="text-sm">{labels[m]}</p>
                  <p className="font-bold text-sm">{cnt} tikè</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Quick links ── */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-muted mb-3">Lyen Rapid</h3>
        <div className="flex flex-wrap gap-2">
          <Link href={`/organizer/scanner?event=${eventId}`} className="px-4 py-2 rounded-xl bg-white/[0.04] border border-border text-[11px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">📷 Eskane</Link>
          <Link href={`/organizer/staff?event=${eventId}`}  className="px-4 py-2 rounded-xl bg-white/[0.04] border border-border text-[11px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">👥 Staff</Link>
          <Link href="/organizer/pending-tickets"           className="px-4 py-2 rounded-xl bg-white/[0.04] border border-border text-[11px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">⏳ Ann Atant</Link>
          <Link href="/organizer/bar"                       className="px-4 py-2 rounded-xl bg-white/[0.04] border border-border text-[11px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">🍺 Bar POS</Link>
          {event.isPrivate && <Link href={`/organizer/events/${eventId}/guests`} className="px-4 py-2 rounded-xl bg-orange/10 border border-orange/30 text-[11px] font-bold text-orange hover:bg-orange/20 transition-all">🎟 Envite</Link>}
          <Link href={`/organizer/events/${eventId}/budget`} className="px-4 py-2 rounded-xl bg-white/[0.04] border border-border text-[11px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">💰 Bidjè</Link>
        </div>
      </section>

    </div>
  );
}

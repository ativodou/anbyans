'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getUserPhoto, getEvent, type TicketData, type EventData } from '@/lib/db';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface TicketWithEvent extends TicketData {
  event?: EventData;
  barTabBalance?: number;
  barTabSpent?: number;
  barPreorder?: { name: string; qty: number; price: number }[];
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  valid:            { label: '✓ Valid',       color: '#22c55e' },
  pending:          { label: '⏳ An atant',   color: '#f59e0b' },
  pending_transfer: { label: '🔄 Transfè',   color: '#6366f1' },
  used:             { label: '✅ Itilize',    color: '#f97316' },
  cancelled:        { label: '✗ Anile',       color: '#ef4444' },
  refunded:         { label: '↩ Ranbouse',   color: '#ef4444' },
};

export default function FanDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { locale } = useT();
  const L = (ht: string, en: string) => locale === 'en' ? en : ht;

  const [photoURL,  setPhotoURL]  = useState<string | null>(null);
  const [tickets,   setTickets]   = useState<TicketWithEvent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<'upcoming' | 'past'>('upcoming');

  const displayName = (user as any)?.firstName
    ? `${(user as any).firstName} ${(user as any).lastName ?? ''}`.trim()
    : user?.email?.split('@')[0] ?? '';

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/'); return; }
    getUserPhoto(user.uid).then(url => setPhotoURL(url)).catch(() => {});
    loadTickets();
  }, [user?.uid, authLoading]);

  async function loadTickets() {
    if (!user?.email) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'tickets'), where('buyerEmail', '==', user.email))
      );
      const raw: TicketWithEvent[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketWithEvent));

      const cache: Record<string, EventData> = {};
      for (const tk of raw) {
        if (tk.eventId && !cache[tk.eventId]) {
          const ev = await getEvent(tk.eventId);
          if (ev) cache[tk.eventId] = ev;
        }
        tk.event = cache[tk.eventId || ''];
      }

      raw.sort((a, b) => {
        const at = (a.purchasedAt as any)?.seconds ?? 0;
        const bt = (b.purchasedAt as any)?.seconds ?? 0;
        return bt - at;
      });

      setTickets(raw);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const today = new Date().toISOString().split('T')[0];

  const upcoming = tickets.filter(tk =>
    (tk.status === 'valid' || tk.status === 'pending' || tk.status === 'pending_transfer') &&
    (!tk.event?.startDate || tk.event.startDate >= today)
  );

  const past = tickets.filter(tk =>
    tk.status === 'used' ||
    (tk.event?.startDate && tk.event.startDate < today && tk.status !== 'pending')
  );

  const totalBarCredit = tickets.reduce((sum, tk) => {
    return sum + Math.max(0, (tk.barTabBalance ?? 0) - (tk.barTabSpent ?? 0));
  }, 0);

  const attended = tickets.filter(tk => tk.status === 'used').length;

  if (authLoading && !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #06b6d4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const shown = tab === 'upcoming' ? upcoming : past;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* ── Profile card ── */}
        <div style={{
          background: 'linear-gradient(135deg, #12121a 0%, #0f1a24 100%)',
          border: '1px solid #1e1e2e', borderRadius: 20, padding: 20,
          marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center',
        }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: '#06b6d4', display: 'flex', alignItems: 'center',
            justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
            fontSize: 28, fontWeight: 800, color: '#000',
            border: '2px solid #06b6d430',
          }}>
            {photoURL
              ? <img src={photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : displayName.charAt(0).toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 19, color: '#fff', lineHeight: 1.2 }}>{displayName}</div>
            <div style={{ fontSize: 11, color: '#06b6d4', fontWeight: 700, marginTop: 2, marginBottom: 3 }}>Fan</div>
            <div style={{ fontSize: 11, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
          <Link href="/profile" style={{
            padding: '8px 14px', borderRadius: 10, border: '1px solid #1e1e2e',
            color: '#888', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
          }}>
            ✏️ {L('Edite', 'Edit')}
          </Link>
        </div>

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { value: upcoming.length, label: L('TIKÈ AKTIF', 'ACTIVE'), color: '#06b6d4' },
            { value: attended,        label: L('EVÈNMAN', 'ATTENDED'), color: '#22c55e' },
            { value: `$${totalBarCredit.toFixed(0)}`, label: L('BAR KREDI', 'BAR CREDIT'), color: '#f97316' },
          ].map(({ value, label, color }) => (
            <div key={label} style={{
              background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 14,
              padding: '16px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, color: '#444', marginTop: 5, fontWeight: 700, letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, background: '#12121a', borderRadius: 12, padding: 4, border: '1px solid #1e1e2e' }}>
          {(['upcoming', 'past'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '9px 0', borderRadius: 9, border: 'none',
              background: tab === t ? '#06b6d4' : 'transparent',
              color: tab === t ? '#000' : '#555',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
            }}>
              {t === 'upcoming'
                ? `${L('Kap vini', 'Upcoming')} (${upcoming.length})`
                : `${L('Pasé', 'Past')} (${past.length})`}
            </button>
          ))}
        </div>

        {/* ── Ticket list ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 56 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #06b6d4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>{tab === 'upcoming' ? '🎭' : '🕓'}</div>
            <p style={{ color: '#444', fontSize: 14, marginBottom: 24 }}>
              {tab === 'upcoming'
                ? L('Pa gen tikè kap vini.', 'No upcoming tickets.')
                : L('Pa gen istwa tikè.', 'No past tickets yet.')}
            </p>
            {tab === 'upcoming' && (
              <Link href="/events" style={{
                padding: '12px 28px', borderRadius: 12, background: '#06b6d4',
                color: '#000', fontWeight: 700, fontSize: 14, textDecoration: 'none',
              }}>
                {L('Wè Evènman yo', 'Browse Events')}
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shown.map(tk => {
              const meta = STATUS_META[tk.status] ?? { label: tk.status, color: '#555' };
              const barRemaining = Math.max(0, (tk.barTabBalance ?? 0) - (tk.barTabSpent ?? 0));
              const hasBar = (tk.barTabBalance ?? 0) > 0;

              return (
                <Link key={tk.id} href={`/ticket/${tk.ticketCode}`} style={{ textDecoration: 'none', color: '#fff' }}>
                  <div style={{
                    background: '#12121a', border: '1px solid #1e1e2e',
                    borderRadius: 14, overflow: 'hidden',
                    transition: 'border-color .15s',
                  }}>
                    {/* Color stripe */}
                    <div style={{ height: 3, background: tk.sectionColor || '#06b6d4' }} />

                    <div style={{ padding: '14px 16px' }}>
                      {/* Row 1 — event name + status */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tk.event?.name || L('Evènman', 'Event')}
                          </div>
                        </div>
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, flexShrink: 0,
                          background: meta.color + '20', color: meta.color, border: `1px solid ${meta.color}30`,
                        }}>
                          {meta.label}
                        </span>
                      </div>

                      {/* Row 2 — section + seat */}
                      <div style={{ color: '#777', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: tk.sectionColor || '#06b6d4', fontWeight: 700 }}>
                          {tk.sectionName || tk.section}
                        </span>
                        {tk.seat ? ` · ${L('Plas', 'Seat')} ${tk.seat}` : ''}
                      </div>

                      {/* Row 3 — date + venue */}
                      {tk.event?.startDate && (
                        <div style={{ color: '#444', fontSize: 10, marginBottom: hasBar ? 10 : 0 }}>
                          📅 {tk.event.startDate}
                          {tk.event.startTime ? ` · 🕐 ${tk.event.startTime}` : ''}
                          {tk.event.venue?.name ? ` · 📍 ${tk.event.venue.name}` : ''}
                        </div>
                      )}

                      {/* Bar tab row */}
                      {hasBar && (
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', borderRadius: 8,
                          background: '#0a0a0f', border: '1px solid #1a1a2a',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>🍹</span>
                            <span style={{ fontSize: 11, color: '#888' }}>Bar tab</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: barRemaining > 0 ? '#22c55e' : '#444' }}>
                              ${barRemaining.toFixed(2)}
                            </span>
                            <span style={{ fontSize: 10, color: '#333', marginLeft: 4 }}>
                              / ${(tk.barTabBalance ?? 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Preorder items */}
                      {tk.barPreorder && tk.barPreorder.length > 0 && (
                        <div style={{ marginTop: 6, paddingLeft: 12 }}>
                          {tk.barPreorder.map((item, i) => (
                            <div key={i} style={{ fontSize: 10, color: '#555', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{item.qty}× {item.name}</span>
                              <span>${(item.price * item.qty).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Ticket code */}
                      <div style={{ marginTop: 8, fontSize: 10, color: '#2a2a3a', fontFamily: 'monospace', letterSpacing: 1 }}>
                        {tk.ticketCode}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Browse more ── */}
        {!loading && tickets.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link href="/events" style={{
              padding: '11px 28px', borderRadius: 12, border: '1px solid #1e1e2e',
              color: '#888', fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}>
              🎫 {L('Plis Evènman', 'More Events')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useT } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getEvent, initiateTransfer, cancelTransfer, type TicketData, type EventData } from '@/lib/db';

interface TicketWithEvent extends TicketData {
  event?: EventData;
}

export default function MyTicketsPage() {
  const { t } = useT();
  const { user, loading: authLoading } = useAuth();

  const [tickets, setTickets] = useState<TicketWithEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Transfer modal
  const [transferTicket, setTransferTicket] = useState<TicketWithEvent | null>(null);
  const [transferName, setTransferName] = useState('');
  const [transferPhone, setTransferPhone] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferDone, setTransferDone] = useState<{token: string; ticket: TicketWithEvent} | null>(null);
  const [transferError, setTransferError] = useState('');
  const [cancelError, setCancelError] = useState('');

  // Guest lookup
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [guestError, setGuestError] = useState('');

  // Auto-load for logged-in users
  useEffect(() => {
    if (authLoading) return;
    if (!user?.email) return;
    loadByEmail(user.email);
  }, [user, authLoading]);

  async function loadByEmail(email: string) {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'tickets'),
        where('buyerEmail', '==', email)
      );
      const snap = await getDocs(q);
      const raw: TicketWithEvent[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketWithEvent));
      await attachEvents(raw);
      setTickets(raw);
      setSearched(true);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    }
    setLoading(false);
  }

  async function lookupByPhonePin() {
    if (!phone.trim() || !pin.trim()) return;
    setGuestError('');
    setLoading(true);
    try {
      const cleanPhone = phone.trim();
      const q = query(
        collection(db, 'tickets'),
        where('buyerPhone', '==', cleanPhone),
        where('buyerPin', '==', pin.trim())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setGuestError(t('tickets_phone_pin_error'));
        setTickets([]);
      } else {
        const raw: TicketWithEvent[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketWithEvent));
        await attachEvents(raw);
        setTickets(raw);
      }
      setSearched(true);
    } catch (err) {
      console.error('Lookup failed:', err);
      setGuestError(t('tickets_error'));
    }
    setLoading(false);
  }

  async function attachEvents(raw: TicketWithEvent[]) {
    const eventCache: Record<string, EventData> = {};
    for (const tk of raw) {
      if (tk.eventId && !eventCache[tk.eventId]) {
        const ev = await getEvent(tk.eventId);
        if (ev) eventCache[tk.eventId] = ev;
      }
      tk.event = eventCache[tk.eventId || ''];
    }
    raw.sort((a, b) => {
      const aTime = (a.purchasedAt as any)?.seconds || 0;
      const bTime = (b.purchasedAt as any)?.seconds || 0;
      return bTime - aTime;
    });
  }

  // Show guest lookup if not logged in and haven't searched yet
  const showGuestLookup = !authLoading && !user && !searched;
  const showResults = searched || (user && !authLoading);

  const handleTransfer = async () => {
    if (!transferTicket?.id || !transferTicket.eventId) return;
    if (!transferName.trim() || !transferPhone.trim()) return;
    setTransferring(true);
    try {
      const token = await initiateTransfer(
        transferTicket.eventId,
        transferTicket.id,
        transferName.trim(),
        transferPhone.trim(),
      );
      // Send WhatsApp to recipient
      const eventName = transferTicket.event?.name ?? 'evènman nan';
      const acceptUrl = `https://anbyans.events/transfer/${token}`;
      const msg = encodeURIComponent(
        `🎫 ${transferTicket.buyerName} ap transfere yon tikè ba ou pou ${eventName}!

Klike lyen sa pou aksepte tikè a (ekspire nan 24è):
${acceptUrl}`
      );
      window.open(`https://wa.me/${transferPhone.trim().replace(/\D/g,'')}?text=${msg}`, '_blank');
      // Update local state
      setTickets(prev => prev.map(tk =>
        tk.id === transferTicket.id ? { ...tk, status: 'pending_transfer' as any, transferToken: token } : tk
      ));
      setTransferDone({ token, ticket: transferTicket });
      setTransferTicket(null);
      setTransferName('');
      setTransferPhone('');
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Erè. Eseye ankò.');
    }
    setTransferring(false);
  };

  const handleCancelTransfer = async (tk: TicketWithEvent) => {
    if (!tk.id || !tk.eventId || !tk.transferToken) return;
    if (!confirm(t('tickets_cancel_confirm'))) return;
    try {
      await cancelTransfer(tk.eventId, tk.id, tk.transferToken);
      setTickets(prev => prev.map(item =>
        item.id === tk.id ? { ...item, status: 'valid', transferToken: undefined } : item
      ));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Erè.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff' }}>
      {/* Header */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e', padding: '0 16px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', alignItems: 'center', height: 52, gap: 12 }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: 15, letterSpacing: 2, color: '#fff', textDecoration: 'none' }}>ANBYANS</Link>
          <span style={{ flex: 1 }} />
          <Link href="/buy" style={{ padding: '6px 14px', borderRadius: 8, background: '#06b6d4', color: '#000', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
            🎫 {t('tickets_buy_btn')}
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
          🎫 {t('tickets_title')}
        </h1>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>
          {user ? t('tickets_logged_in_desc') : t('tickets_guest_desc')}
        </p>

        {/* Guest lookup form */}
        {showGuestLookup && (
          <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                {t('tickets_phone_label')}
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+50934120000"
                type="tel"
                style={{
                  width: '100%', padding: 14, borderRadius: 8,
                  border: '1px solid #1e1e2e', background: '#0a0a0f',
                  color: '#fff', fontSize: 16, boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                PIN
              </label>
              <input
                value={pin}
                onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && lookupByPhonePin()}
                placeholder="1234"
                type="text"
                inputMode="numeric"
                maxLength={4}
                style={{
                  width: 120, padding: 14, borderRadius: 8,
                  border: '1px solid #1e1e2e', background: '#0a0a0f',
                  color: '#fff', fontSize: 24, fontWeight: 800,
                  fontFamily: 'monospace', letterSpacing: 8,
                  textAlign: 'center', boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={lookupByPhonePin}
              disabled={!phone.trim() || pin.length < 4 || loading}
              style={{
                width: '100%', padding: 14, borderRadius: 8, border: 'none',
                background: phone.trim() && pin.length === 4 ? '#f97316' : '#333',
                color: phone.trim() && pin.length === 4 ? '#000' : '#666',
                fontSize: 14, fontWeight: 700,
                cursor: phone.trim() && pin.length === 4 ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? '...' : t('tickets_view_btn')}
            </button>
            {guestError && (
              <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10, textAlign: 'center' }}>{guestError}</p>
            )}
            <p style={{ color: '#555', fontSize: 10, marginTop: 12, textAlign: 'center' }}>
              {t('tickets_pin_hint')}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 32, height: 32, border: '4px solid #06b6d4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            <p style={{ color: '#888', fontSize: 13, marginTop: 12 }}>{t('tickets_loading')}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Results */}
        {showResults && !loading && tickets.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎭</div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
              {t('tickets_no_tickets')}
            </p>
            <Link href="/buy" style={{ padding: '12px 24px', borderRadius: 10, background: '#06b6d4', color: '#000', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              🎫 {t('tickets_buy_btn')}
            </Link>
          </div>
        )}

        {tickets.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tickets.map(tk => {
              const isValid = tk.status === 'valid';
              const isUsed = tk.status === 'used';
              const isPendingTransfer = tk.status === 'pending_transfer';
              const isPendingApproval = tk.status === 'pending';
              const statusColor = isValid ? '#22c55e' : isUsed ? '#f97316' : isPendingTransfer ? '#6366f1' : isPendingApproval ? '#f59e0b' : '#ef4444';
              const statusLabel = isValid ? t('tickets_status_valid') : isUsed ? t('tickets_status_used') : isPendingTransfer ? t('tickets_status_transfer') : isPendingApproval ? '⏳ An atant' : t('tickets_status_cancelled');

              return (
                <div key={tk.id} style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, overflow: 'hidden' }}>
                  <Link
                    href={`/ticket/${tk.ticketCode}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: 16, textDecoration: 'none', color: '#fff',
                    }}
                  >
                    <div style={{ width: 4, height: 48, borderRadius: 4, background: tk.sectionColor || '#555', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{tk.event?.name || t('tickets_event_label')}</div>
                      <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                        {tk.section} · {t('tickets_seat_label')} {tk.seat}
                      </div>
                      {tk.event && (
                        <div style={{ color: '#555', fontSize: 10, marginTop: 2 }}>
                          📅 {tk.event.startDate} · 🕐 {tk.event.startTime}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800,
                        background: statusColor + '20', color: statusColor,
                      }}>
                        {statusLabel}
                      </span>
                      <div style={{ color: '#333', fontSize: 18, marginTop: 4 }}>→</div>
                    </div>
                  </Link>
                  {/* Transfer / Cancel buttons */}
                  {isValid && (
                    <div style={{ borderTop: '1px solid #1e1e2e', padding: '10px 16px' }}>
                      <button
                        onClick={() => setTransferTicket(tk)}
                        style={{
                          width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid #6366f1',
                          background: 'transparent', color: '#6366f1', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        🔄 {t('tickets_transfer_this')}
                      </button>
                    </div>
                  )}
                  {isPendingTransfer && tk.transferToken && (
                    <div style={{ borderTop: '1px solid #1e1e2e', padding: '10px 16px', display: 'flex', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 11, color: '#f59e0b', alignSelf: 'center' }}>
                        ⏳ {t('tickets_awaiting_accept')}
                      </span>
                      <button
                        onClick={() => handleCancelTransfer(tk)}
                        style={{
                          padding: '6px 12px', borderRadius: 8, border: '1px solid #ef4444',
                          background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Search again for guests */}
            {!user && (
              <button
                onClick={() => { setSearched(false); setTickets([]); setPhone(''); setPin(''); }}
                style={{
                  marginTop: 8, padding: '10px 16px', borderRadius: 8,
                  border: '1px solid #1e1e2e', background: 'transparent',
                  color: '#888', fontSize: 12, cursor: 'pointer',
                }}
              >
                ← {t('tickets_search_other')}
              </button>
            )}
          </div>
        )}
      </div>
      {/* ── Transfer Modal ── */}
      {transferTicket && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 20, width: '100%', maxWidth: 480, padding: 24, position: 'relative' }}>
            <button onClick={() => { setTransferTicket(null); setTransferName(''); setTransferPhone(''); }} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              🔄 {t('tickets_transfer_modal_title')}
            </h3>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
              {transferTicket.event?.name} · {transferTicket.section} · {t('tickets_seat_label')} {transferTicket.seat}
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                {t('tickets_recipient_name')}
              </label>
              <input
                value={transferName}
                onChange={e => setTransferName(e.target.value)}
                placeholder={t('tickets_full_name_ph')}
                style={{
                  width: '100%', padding: 12, borderRadius: 8,
                  border: '1px solid #1e1e2e', background: '#0a0a0f',
                  color: '#fff', fontSize: 15, boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                {t('tickets_recipient_phone')}
              </label>
              <input
                value={transferPhone}
                onChange={e => setTransferPhone(e.target.value)}
                placeholder="+50934120000"
                type="tel"
                style={{
                  width: '100%', padding: 12, borderRadius: 8,
                  border: '1px solid #1e1e2e', background: '#0a0a0f',
                  color: '#fff', fontSize: 15, boxSizing: 'border-box',
                }}
              />
            </div>

            <p style={{ color: '#555', fontSize: 11, marginBottom: 16 }}>
              ⚠️ {t('tickets_transfer_warning')}
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setTransferTicket(null); setTransferName(''); setTransferPhone(''); }}
                style={{
                  flex: 1, padding: 12, borderRadius: 10, border: '1px solid #1e1e2e',
                  background: 'transparent', color: '#888', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {t('back')}
              </button>
              <button
                onClick={handleTransfer}
                disabled={!transferName.trim() || !transferPhone.trim() || transferring}
                style={{
                  flex: 2, padding: 12, borderRadius: 10, border: 'none',
                  background: transferName.trim() && transferPhone.trim() ? '#6366f1' : '#333',
                  color: transferName.trim() && transferPhone.trim() ? '#fff' : '#666',
                  fontSize: 13, fontWeight: 700,
                  cursor: transferName.trim() && transferPhone.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {transferring ? '...' : `🔄 ${t('tickets_send_transfer')}`}
              </button>
            </div>
            {transferError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{transferError}</p>}
            {cancelError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{cancelError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
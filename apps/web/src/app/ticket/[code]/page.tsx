'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/i18n';
import { verifyTicketByCode, type TicketData, type EventData } from '@/lib/db';

export default function TicketPage() {
  const params = useParams();
  const code = (params.code as string) || '';
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale as 'ht' | 'en' | 'fr']);

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [error, setError] = useState('');
  const [qrKey, setQrKey] = useState(0);
  const [qrCountdown, setQrCountdown] = useState(15);

  useEffect(() => {
    if (!code) return;
    (async () => {
      const fullCode = code.toUpperCase().startsWith('ANB-') ? code.toUpperCase() : 'ANB-' + code.toUpperCase();
      const res = await verifyTicketByCode(fullCode);
      if (res.valid && res.ticket) {
        setTicket(res.ticket);
        setEvent(res.event || null);
      } else {
        setError(res.error || 'Not found');
      }
      setLoading(false);
    })();
  }, [code]);

  // Rotating QR
  useEffect(() => {
    if (!ticket || ticket.status !== 'valid') return;
    const ti = setInterval(() => {
      setQrCountdown(p => {
        if (p <= 1) { setQrKey(k => k + 1); return 15; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(ti);
  }, [ticket]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #06b6d4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ color: '#888', fontSize: 13, marginTop: 12 }}>{L('Ap chaje tikè...', 'Loading ticket...', 'Chargement du billet...')}</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>
            {L('TIKÈ PA JWENN', 'TICKET NOT FOUND', 'BILLET NON TROUVÉ')}
          </h1>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
            {L('Kòd sa a pa egziste nan sistèm Anbyans.', 'This code does not exist in the Anbyans system.', 'Ce code n\'existe pas dans le système Anbyans.')}
          </p>
          <Link href="/verify" style={{ padding: '12px 24px', borderRadius: 10, background: '#06b6d4', color: '#000', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            🔍 {L('Verifye yon tikè', 'Verify a ticket', 'Vérifier un billet')}
          </Link>
        </div>
      </div>
    );
  }

  const isUsed = ticket.status === 'used';
  const isCancelled = ticket.status === 'cancelled';
  const isValid = ticket.status === 'valid';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff' }}>
      {/* Header */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e', padding: '0 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', height: 52, gap: 12 }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: 15, letterSpacing: 2, color: '#fff', textDecoration: 'none' }}>ANBYANS</Link>
          <span style={{ flex: 1 }} />
          <span style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800,
            background: isValid ? '#22c55e20' : isUsed ? '#f9731620' : '#ef444420',
            color: isValid ? '#22c55e' : isUsed ? '#f97316' : '#ef4444',
            border: `1px solid ${isValid ? '#22c55e40' : isUsed ? '#f9731640' : '#ef444440'}`,
          }}>
            {isValid ? L('VALID', 'VALID', 'VALIDE') : isUsed ? L('ITILIZE', 'USED', 'UTILISÉ') : L('ANILE', 'CANCELLED', 'ANNULÉ')}
          </span>
        </div>
      </nav>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px 20px' }}>
        {/* Event info */}
        {event && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{event.name}</h1>
            <p style={{ color: '#888', fontSize: 12 }}>📍 {event.venue?.name} · 📅 {event.startDate} · 🕐 {event.startTime}</p>
          </div>
        )}

        {/* Ticket card */}
        <div style={{
          background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16,
          padding: 24, position: 'relative', overflow: 'hidden',
        }}>
          {/* Notch cutouts */}
          <div style={{ position: 'absolute', top: '50%', left: -10, width: 20, height: 20, borderRadius: '50%', background: '#0a0a0f' }} />
          <div style={{ position: 'absolute', top: '50%', right: -10, width: 20, height: 20, borderRadius: '50%', background: '#0a0a0f' }} />

          {/* Section badge */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800,
              color: ticket.sectionColor || '#fff',
              border: `1px solid ${ticket.sectionColor || '#fff'}`,
              background: (ticket.sectionColor || '#fff') + '15',
            }}>
              {ticket.section} — {ticket.seat}
            </span>
          </div>

          {/* QR Code */}
          {isValid ? (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                display: 'inline-grid',
                gridTemplateColumns: 'repeat(13, 1fr)',
                gap: 1, width: 182, height: 182,
                padding: 12, background: '#fff', borderRadius: 12,
              }} key={qrKey}>
                {Array.from({ length: 169 }).map((_, i) => {
                  const edge = i < 13 || i >= 156 || i % 13 === 0 || i % 13 === 12;
                  const corner = (i < 39 && i % 13 < 3) || (i < 39 && i % 13 >= 10) || (i >= 130 && i < 156 && i % 13 < 3);
                  const black = corner || edge || Math.random() > 0.55;
                  return <div key={i} style={{ background: black ? '#000' : '#fff' }} />;
                })}
              </div>
              <p style={{ color: '#888', fontSize: 10, marginTop: 8 }}>
                {L('QR kòd ap chanje chak', 'QR code changes every', 'Le QR code change toutes les')} {qrCountdown}s
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', marginBottom: 16 }}>
              <div style={{ fontSize: 48 }}>{isUsed ? '✅' : '❌'}</div>
              <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
                {isUsed
                  ? L('Tikè sa a deja itilize.', 'This ticket has already been used.', 'Ce billet a déjà été utilisé.')
                  : L('Tikè sa a anile.', 'This ticket has been cancelled.', 'Ce billet a été annulé.')}
              </p>
            </div>
          )}

          {/* Dashed divider */}
          <div style={{ borderTop: '2px dashed #1e1e2e', margin: '16px 0' }} />

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ color: '#555', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {L('Non', 'Name', 'Nom')}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{ticket.buyerName}</div>
            </div>
            <div>
              <div style={{ color: '#555', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {L('Kòd Tikè', 'Ticket Code', 'Code Billet')}
              </div>
              <div style={{ fontWeight: 800, fontSize: 13, marginTop: 2, fontFamily: 'monospace', letterSpacing: 1 }}>{ticket.ticketCode}</div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        {isValid && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <p style={{ color: '#888', fontSize: 12, lineHeight: 1.6 }}>
              {L(
                '📱 Prezante QR kòd sa a nan antre a. Pa fè screenshot — kòd la ap chanje.',
                '📱 Show this QR code at the entrance. Don\'t screenshot — the code rotates.',
                '📱 Présentez ce QR code à l\'entrée. Ne faites pas de capture — le code change.'
              )}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
          <Link href="/events" style={{
            padding: '12px 20px', borderRadius: 10, background: '#06b6d4', color: '#000',
            fontWeight: 700, fontSize: 13, textDecoration: 'none',
          }}>
            🎫 {L('Plis Evènman', 'More Events', 'Plus d\'événements')}
          </Link>
          <Link href="/verify" style={{
            padding: '12px 20px', borderRadius: 10, border: '1px solid #1e1e2e',
            color: '#888', fontWeight: 700, fontSize: 13, textDecoration: 'none',
          }}>
            🔍 {L('Verifye', 'Verify', 'Vérifier')}
          </Link>
        </div>

        {/* Branding */}
        <div style={{ textAlign: 'center', marginTop: 32, color: '#333', fontSize: 10 }}>
          🛡️ {L('Pwoteje pa Anbyans', 'Protected by Anbyans', 'Protégé par Anbyans')}
        </div>
      </div>
    </div>
  );
}

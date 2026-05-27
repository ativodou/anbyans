'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/i18n';
import { verifyTicketByCode, initiateTransfer, requestRefund, type TicketData, type EventData } from '@/lib/db';

function getQrWindow(): number {
  return Math.floor(Date.now() / 15000);
}

export default function TicketPage() {
  const params = useParams();
  const code = (params.code as string) || '';
  const { t } = useT();

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [error, setError] = useState('');
  const [qrWindow, setQrWindow] = useState(getQrWindow());
  const [qrCountdown, setQrCountdown] = useState(15 - Math.floor((Date.now() % 15000) / 1000));
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Transfer modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferName, setTransferName] = useState('');
  const [transferPhone, setTransferPhone] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferDone, setTransferDone] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [showRefund, setShowRefund] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [refundDone, setRefundDone] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (!code) return;
    (async () => {
      const fullCode = code.toUpperCase();
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

  // Rotating QR timer
  useEffect(() => {
    if (!ticket || ticket.status !== 'valid') return;
    const ti = setInterval(() => {
      const nw = getQrWindow();
      if (nw !== qrWindow) setQrWindow(nw);
      setQrCountdown(15 - Math.floor((Date.now() % 15000) / 1000));
    }, 1000);
    return () => clearInterval(ti);
  }, [ticket, qrWindow]);

  const qrData = ticket ? `${ticket.qrData}:${qrWindow}` : '';
  const qrUrl = qrData ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&bgcolor=FFFFFF&color=000000&data=${encodeURIComponent(qrData)}` : '';

  // Static QR for download (no rotation — valid for entry with manual code check)
  const staticQrData = ticket ? ticket.qrData || '' : '';
  const staticQrUrl = staticQrData ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&bgcolor=FFFFFF&color=000000&data=${encodeURIComponent(staticQrData)}` : '';

  const downloadTicket = async () => {
    if (!ticket || !event || !canvasRef.current) return;
    setDownloading(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      const W = 600, H = 900;
      canvas.width = W;
      canvas.height = H;

      // Background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);

      // Border
      ctx.strokeStyle = '#1e1e2e';
      ctx.lineWidth = 2;
      ctx.roundRect(20, 20, W - 40, H - 40, 16);
      ctx.stroke();

      // Header bar
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(20, 20, W - 40, 60);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ANBYANS', W / 2, 58);

      // Event name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.textAlign = 'center';
      const evName = event.name || 'Event';
      ctx.fillText(evName, W / 2, 130);

      // Venue / date / time
      ctx.fillStyle = '#888';
      ctx.font = '14px Arial, sans-serif';
      const info = `📍 ${event.venue?.name || ''} · 📅 ${event.startDate || ''} · 🕐 ${event.startTime || ''}`;
      ctx.fillText(info, W / 2, 158);

      // Section badge
      ctx.fillStyle = ticket.sectionColor || '#f97316';
      ctx.font = 'bold 18px Arial, sans-serif';
      const secText = `${ticket.section} — ${ticket.seat}`;
      const secW = ctx.measureText(secText).width + 32;
      ctx.strokeStyle = ticket.sectionColor || '#f97316';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(W / 2 - secW / 2, 180, secW, 34, 8);
      ctx.stroke();
      ctx.fillText(secText, W / 2, 203);

      // QR code
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = () => reject(new Error('QR load failed'));
        qrImg.src = staticQrUrl;
      });

      // White background for QR
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 120, 240, 240, 240, 12);
      ctx.fill();
      ctx.drawImage(qrImg, W / 2 - 110, 250, 220, 220);

      // Static QR notice
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.fillText(t('ticket_faster_entry'), W / 2, 506);

      // Dashed line
      ctx.setLineDash([8, 4]);
      ctx.strokeStyle = '#1e1e2e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, 530);
      ctx.lineTo(W - 50, 530);
      ctx.stroke();
      ctx.setLineDash([]);

      // Notch circles
      ctx.fillStyle = '#0a0a0f';
      ctx.beginPath();
      ctx.arc(20, 530, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(W - 20, 530, 14, 0, Math.PI * 2);
      ctx.fill();

      // Details grid
      const details = [
        [t('ticket_download_canvas_name'), ticket.buyerName || 'Guest'],
        [t('ticket_canvas_section'), ticket.section || ''],
        [t('ticket_canvas_seat'), ticket.seat || ''],
        [t('ticket_canvas_code'), ticket.ticketCode || ''],
      ];
      let dy = 565;
      details.forEach(([label, val], i) => {
        const x = i % 2 === 0 ? 80 : W / 2 + 30;
        const y = dy + Math.floor(i / 2) * 65;
        ctx.fillStyle = '#555';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, x, y);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillText(val, x, y + 22);
      });

      // Status badge
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✅ TIKÈ VALID', W / 2, 730);

      // Footer
      ctx.fillStyle = '#333';
      ctx.font = '11px Arial, sans-serif';
      ctx.fillText('🛡️ Pwoteje pa Anbyans · anbyans.events/verify', W / 2, 780);

      // Valid status bar
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(20, H - 56, W - 40, 36);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.fillText(t('ticket_show_entrance'), W / 2, H - 33);

      // Download
      const link = document.createElement('a');
      link.download = `anbyans-ticket-${ticket.ticketCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
      setDownloadError(t('buy_error_retry'));
    }
    setDownloading(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #06b6d4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ color: '#888', fontSize: 13, marginTop: 12 }}>{t('ticket_loading')}</p>
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
            {t('ticket_not_found')}
          </h1>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
            {t('ticket_not_found_body')}
          </p>
          <Link href="/verify" style={{ padding: '12px 24px', borderRadius: 10, background: '#06b6d4', color: '#000', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            🔍 {t('ticket_verify_link')}
          </Link>
        </div>
      </div>
    );
  }

  const isUsed = ticket.status === 'used';
  const isValid = ticket.status === 'valid';
  const isPending = ticket.status === 'pending';

  const handleTransfer = async () => {
    if (!ticket?.id || !ticket.eventId) return;
    if (!transferName.trim() || !transferPhone.trim()) return;
    setTransferring(true);
    try {
      const token = await initiateTransfer(
        ticket.eventId, ticket.id, transferName.trim(), transferPhone.trim()
      );
      const acceptUrl = `https://anbyans.events/transfer/${token}`;
      const msg = encodeURIComponent(
        `🎫 ${ticket.buyerName} ap transfere yon tikè ba ou pou ${event?.name ?? 'evènman nan'}!

Klike lyen sa pou aksepte tikè a (ekspire nan 24è):
${acceptUrl}`
      );
      window.open(`https://wa.me/${transferPhone.trim().replace(/\D/g,'')}?text=${msg}`, '_blank');
      setTransferDone(true);
      setShowTransfer(false);
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Erè. Eseye ankò.');
    }
    setTransferring(false);
  };


  async function handleRefund() {
    if (!ticket || !event || !refundReason.trim()) return;
    setRefunding(true);
    try {
      await requestRefund(
        ticket.eventId, event.name, ticket.id!, ticket.ticketCode,
        ticket.buyerName, ticket.buyerPhone, refundReason,
        ticket.price, ticket.section
      );
      setRefundDone(true);
      setShowRefund(false);
    } catch (e) {
      setRefundError(t('ticket_refund_error'));
    }
    setRefunding(false);
  }
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Header */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e', padding: '0 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', height: 52, gap: 12 }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: 15, letterSpacing: 2, color: '#fff', textDecoration: 'none' }}>ANBYANS</Link>
          <span style={{ flex: 1 }} />
          <span style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800,
            background: isValid ? '#22c55e20' : isUsed ? '#f9731620' : isPending ? '#f59e0b20' : '#ef444420',
            color: isValid ? '#22c55e' : isUsed ? '#f97316' : isPending ? '#f59e0b' : '#ef4444',
            border: `1px solid ${isValid ? '#22c55e40' : isUsed ? '#f9731640' : isPending ? '#f59e0b40' : '#ef444440'}`,
          }}>
            {isValid ? t('ticket_status_valid') : isUsed ? t('ticket_status_used') : isPending ? '⏳ An atant' : t('ticket_status_cancelled')}
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
              <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 12 }}>
                <img
                  key={qrWindow}
                  src={qrUrl}
                  alt="QR Code"
                  width={200}
                  height={200}
                  style={{ display: 'block' }}
                />
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', border: '2px solid #06b6d4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: '#06b6d4',
                }}>
                  {qrCountdown}
                </div>
                <p style={{ color: '#888', fontSize: 10 }}>
                  {t('ticket_qr_refreshes')}
                </p>
              </div>
            </div>
          ) : isPending ? (
            <div style={{ textAlign: 'center', padding: '24px 0', marginBottom: 16 }}>
              <div style={{ fontSize: 48 }}>⏳</div>
              <p style={{ color: '#f59e0b', fontSize: 14, fontWeight: 700, marginTop: 8 }}>Peman an atant konfirmasyon</p>
              <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>Òganizatè a ap verifye peman ou an. Tikè a ap aktive lè sa.</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', marginBottom: 16 }}>
              <div style={{ fontSize: 48 }}>{isUsed ? '✅' : '❌'}</div>
              <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
                {isUsed ? t('ticket_already_used') : t('ticket_cancelled')}
              </p>
            </div>
          )}

          {/* Dashed divider */}
          <div style={{ borderTop: '2px dashed #1e1e2e', margin: '16px 0' }} />

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ color: '#555', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {t('name')}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{ticket.buyerName}</div>
            </div>
            <div>
              <div style={{ color: '#555', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {t('ticket_code_label')}
              </div>
              <div style={{ fontWeight: 800, fontSize: 13, marginTop: 2, fontFamily: 'monospace', letterSpacing: 1 }}>{ticket.ticketCode}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
          {isValid && (
            <>
              <button
                onClick={downloadTicket}
                disabled={downloading}
                style={{
                  padding: '12px 20px', borderRadius: 10, background: '#f97316', color: '#000',
                  fontWeight: 700, fontSize: 13, border: 'none', cursor: downloading ? 'wait' : 'pointer',
                }}
              >
                {downloading ? '...' : `📥 ${t('ticket_download')}`}
              </button>
              {downloadError && <p style={{ color: '#ef4444', fontSize: 12, alignSelf: 'center' }}>{downloadError}</p>}
            </>
          )}
          {isValid && !transferDone && (
            <button
              onClick={() => setShowTransfer(true)}
              style={{
                padding: '12px 20px', borderRadius: 10, background: 'transparent',
                color: '#6366f1', fontWeight: 700, fontSize: 13,
                border: '1px solid #6366f1', cursor: 'pointer',
              }}
            >
              🔄 {t('ticket_transfer_btn')}
            </button>
          )}
          {ticket?.status === 'refunded' && refundDone && (
            <span style={{ padding: '12px 20px', color: '#22c55e', fontSize: 13, fontWeight: 700 }}>
              ✅ {t('ticket_refund_sent')}
            </span>
          )}
          {event?.status === 'ended' && ticket?.status === 'used' && !refundDone && (
            <button
              onClick={() => setShowRefund(true)}
              style={{
                padding: '12px 20px', borderRadius: 10, background: 'transparent',
                color: '#ef4444', fontWeight: 700, fontSize: 13,
                border: '1px solid #ef4444', cursor: 'pointer',
              }}
            >
              💸 {t('ticket_refund_btn')}
            </button>
          )}
          {transferDone && (
            <span style={{ padding: '12px 20px', color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>
              ⏳ {t('ticket_awaiting_accept')}
            </span>
          )}
          <Link href="/events" style={{
            padding: '12px 20px', borderRadius: 10, background: '#06b6d4', color: '#000',
            fontWeight: 700, fontSize: 13, textDecoration: 'none',
          }}>
            🎫 {t('ticket_more_events')}
          </Link>
        </div>

        {/* Instructions */}
        {isValid && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <p style={{ color: '#888', fontSize: 12, lineHeight: 1.6 }}>
              {t('ticket_qr_notice')}
            </p>
            <p style={{ color: '#555', fontSize: 10, marginTop: 8 }}>
              {t('ticket_backup_notice')}
            </p>
          </div>
        )}

        {/* Branding */}
        <div style={{ textAlign: 'center', marginTop: 32, color: '#333', fontSize: 10 }}>
          🛡️ {t('ticket_protected')}
        </div>
      </div>

      {/* Refund Modal */}
      {showRefund && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 20, width: '100%', maxWidth: 480, padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>💸 {t('ticket_refund_btn')}</h3>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>{event?.name} · {ticket?.section}</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>{t('ticket_refund_reason_label')}</label>
              <textarea
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                rows={3}
                placeholder={t('ticket_refund_reason_ph')}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 14, boxSizing: 'border-box', resize: 'none' }}
              />
            </div>
            {refundError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{refundError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowRefund(false); setRefundError(''); }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #1e1e2e', background: 'transparent', color: '#888', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {t('back')}
              </button>
              <button onClick={handleRefund} disabled={!refundReason.trim() || refunding}
                style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: refundReason.trim() ? '#ef4444' : '#333', color: refundReason.trim() ? '#fff' : '#666', fontSize: 13, fontWeight: 700, cursor: refundReason.trim() ? 'pointer' : 'not-allowed' }}>
                {refunding ? '...' : `💸 ${t('ticket_refund_btn')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 20, width: '100%', maxWidth: 480, padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              🔄 {t('ticket_transfer_modal_h')}
            </h3>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
              {event?.name} · {ticket?.section} · {t('tickets_seat_label')} {ticket?.seat}
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                {t('tickets_recipient_name')}
              </label>
              <input
                value={transferName}
                onChange={e => setTransferName(e.target.value)}
                placeholder={t('tickets_full_name_ph')}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
                {t('auth_whatsapp')}
              </label>
              <input
                value={transferPhone}
                onChange={e => setTransferPhone(e.target.value)}
                placeholder="+50934120000"
                type="tel"
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>
            <p style={{ color: '#555', fontSize: 11, marginBottom: 16 }}>
              ⚠️ {t('ticket_locked_24h')}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowTransfer(false); setTransferName(''); setTransferPhone(''); }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #1e1e2e', background: 'transparent', color: '#888', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
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
                {transferring ? '...' : `🔄 ${t('ticket_send_transfer')}`}
              </button>
            </div>
            {transferError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{transferError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

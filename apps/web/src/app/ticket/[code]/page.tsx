'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/i18n';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { verifyTicketByCode, initiateTransfer, requestRefund, getBarItems, getBarStations, type TicketData, type EventData } from '@/lib/db';
import { useAuth } from '@/hooks/useAuth';

function getQrWindow(): number {
  return Math.floor(Date.now() / 15000);
}

export default function TicketPage() {
  const params = useParams();
  const code = (params.code as string) || '';
  const { t } = useT();
  const { user } = useAuth();

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

  // Bar top-up
  const [showBarTopup, setShowBarTopup] = useState(false);
  const [topupStep, setTopupStep] = useState<'amount' | 'payment' | 'done'>('amount');
  const [topupAmount, setTopupAmount] = useState(0);
  const [topupCustom, setTopupCustom] = useState('');
  const [topupMenuItems, setTopupMenuItems] = useState<{name:string;price:number;station:string;stationId:string;stationSections:string[];sections:string[]}[]>([]);
  const [topupCart, setTopupCart] = useState<Record<string,number>>({});
  const [topupPayMethod, setTopupPayMethod] = useState<string|null>(null);
  const [topupTxnId, setTopupTxnId] = useState('');
  const [topupProcessing, setTopupProcessing] = useState(false);
  const [topupError, setTopupError] = useState('');
  const [eventPayMethods, setEventPayMethods] = useState<Record<string,{active:boolean;values?:string[]}>>({});
  const [eventExchangeRate, setEventExchangeRate] = useState(130);

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

  const openBarTopup = async () => {
    if (!ticket?.eventId) return;
    try {
      const evSnap = await getDoc(doc(db, 'events', ticket.eventId));
      if (evSnap.exists()) {
        const d = evSnap.data();
        let pm = d.paymentMethods;
        if (!pm) {
          const orgSnap = await getDoc(doc(db, 'organizers', d.organizerId));
          if (orgSnap.exists()) pm = orgSnap.data().paymentMethods;
        }
        setEventPayMethods(pm || { cash: { active: true } });
        setEventExchangeRate(Number(d.exchangeRate) || 130);
      }
      const [items, stations] = await Promise.all([getBarItems(ticket.eventId), getBarStations(ticket.eventId)]);
      const stationMap = new Map(stations.map(s => [s.id!, s]));
      const sectionName = ticket.sectionName || '';
      setTopupMenuItems(items
        .filter(x => stationMap.has(x.stationId))
        .map(x => { const st = stationMap.get(x.stationId)!; return { name: x.name, price: x.price, station: x.stationName, stationId: x.stationId, stationSections: st.sections ?? [], sections: x.sections ?? [] }; })
        .filter(i => {
          if (i.stationSections.length > 0 && !i.stationSections.includes(sectionName)) return false;
          if (i.sections.length > 0 && !i.sections.includes(sectionName)) return false;
          return true;
        }));
    } catch (e) { console.error(e); }
    setTopupStep('amount'); setTopupAmount(0); setTopupCustom(''); setTopupCart({});
    setTopupPayMethod(null); setTopupTxnId(''); setTopupError('');
    setShowBarTopup(true);
  };

  const completeTopup = async () => {
    if (!ticket?.id || topupAmount <= 0 || !topupPayMethod) return;
    setTopupProcessing(true); setTopupError('');
    try {
      const newBalance = (ticket.barTabBalance || 0) + topupAmount;
      await updateDoc(doc(db, 'tickets', ticket.id), { barTabBalance: newBalance, updatedAt: serverTimestamp() });
      setTicket(prev => prev ? { ...prev, barTabBalance: newBalance } : prev);
      setTopupStep('done');
    } catch (e: any) {
      setTopupError(e?.message || 'Erè. Eseye ankò.');
    } finally { setTopupProcessing(false); }
  };

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
          {isValid && (
            <button
              onClick={openBarTopup}
              style={{
                padding: '12px 20px', borderRadius: 10, background: 'transparent',
                color: '#f97316', fontWeight: 700, fontSize: 13,
                border: '1px solid #f97316', cursor: 'pointer',
              }}
            >
              🍺 Bar Credit
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
          <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 20, width: '100%', maxWidth: 480, padding: 24, position: 'relative' }}>
            <button onClick={() => { setShowRefund(false); setRefundError(''); }} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
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

      {/* Bar Top-up Modal */}
      {showBarTopup && (() => {
        const hasMenu = topupMenuItems.length > 0;
        const menuTotal = Object.entries(topupCart).reduce((s, [name, qty]) => s + (topupMenuItems.find(i => i.name === name)?.price ?? 0) * qty, 0);
        const chargeAmount = topupStep === 'payment' ? topupAmount : (hasMenu ? menuTotal : topupAmount);
        const availMethods = Object.entries(eventPayMethods).filter(([,v]) => v.active).map(([k]) => k);
        const MOBILE = ['moncash','natcash'];
        const PAY_LABELS: Record<string,string> = { moncash:'📱 MonCash', natcash:'📱 Natcash', stripe:'💳 Kart', cash:'💵 Cash' };
        return (
          <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', justifyContent:'center', padding:16 }}
            onClick={() => setShowBarTopup(false)}>
            <div style={{ background:'#12121a', border:'1px solid #1e1e2e', borderRadius:20, width:'100%', maxWidth:480, maxHeight:'85vh', overflowY:'auto', padding:24, position:'relative' }}
              onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowBarTopup(false)} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'#666', fontSize:20, cursor:'pointer', lineHeight:1 }}>✕</button>

              {topupStep === 'done' ? (
                <div style={{ textAlign:'center', paddingTop:16 }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>🍺✅</div>
                  <p style={{ fontWeight:800, fontSize:18, marginBottom:8 }}>Bar Credit Ajoute!</p>
                  <p style={{ color:'#888', fontSize:13, marginBottom:4 }}>+${topupAmount.toFixed(2)} ajoute sou tikè ou.</p>
                  <p style={{ color:'#f97316', fontWeight:700, fontSize:15 }}>Balans: ${((ticket?.barTabBalance||0)).toFixed(2)}</p>
                  <button onClick={() => setShowBarTopup(false)} style={{ marginTop:20, padding:'12px 32px', borderRadius:10, background:'#f97316', color:'#000', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>Fèmen</button>
                </div>
              ) : topupStep === 'payment' ? (
                <>
                  <h3 style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>💳 Peman Bar Credit</h3>
                  <p style={{ color:'#888', fontSize:12, marginBottom:20 }}>Total: <span style={{ color:'#f97316', fontWeight:700 }}>${topupAmount.toFixed(2)}</span> · {Math.round(topupAmount * eventExchangeRate).toLocaleString('fr-HT')} HTG</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                    {availMethods.filter(m => m !== 'stripe').map(m => (
                      <button key={m} onClick={() => setTopupPayMethod(m)}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:12, border:`1px solid ${topupPayMethod===m?'#f97316':'#1e1e2e'}`, background:topupPayMethod===m?'rgba(249,115,22,0.1)':'transparent', color:'#fff', cursor:'pointer', textAlign:'left' }}>
                        <span style={{ width:14, height:14, borderRadius:'50%', border:`2px solid ${topupPayMethod===m?'#f97316':'#555'}`, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {topupPayMethod===m && <span style={{ width:7, height:7, borderRadius:'50%', background:'#f97316', display:'block' }} />}
                        </span>
                        <span style={{ fontWeight:700, fontSize:14 }}>{PAY_LABELS[m]||m}</span>
                      </button>
                    ))}
                  </div>
                  {topupPayMethod && MOBILE.includes(topupPayMethod) && (
                    <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:12, padding:16, marginBottom:16 }}>
                      <p style={{ fontSize:12, color:'#888', marginBottom:8 }}>Voye ${topupAmount.toFixed(2)} nan nimewo sa:</p>
                      <p style={{ fontWeight:800, fontSize:20, color:'#f97316', textAlign:'center', marginBottom:12 }}>
                        {eventPayMethods[topupPayMethod]?.values?.[0] || '—'}
                      </p>
                      <label style={{ color:'#888', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:6 }}>ID Tranzaksyon</label>
                      <input value={topupTxnId} onChange={e => setTopupTxnId(e.target.value)} placeholder="ex: TXN123456"
                        style={{ width:'100%', padding:12, borderRadius:8, border:'1px solid #1e1e2e', background:'#0a0a0f', color:'#fff', fontSize:14, boxSizing:'border-box' }} />
                    </div>
                  )}
                  {topupPayMethod === 'cash' && (
                    <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:12, padding:16, marginBottom:16 }}>
                      <p style={{ color:'#888', fontSize:13 }}>💵 Peye cash bay òganizatè a nan evènman an.</p>
                    </div>
                  )}
                  {topupError && <p style={{ color:'#ef4444', fontSize:12, marginBottom:8 }}>{topupError}</p>}
                  <button onClick={completeTopup}
                    disabled={!topupPayMethod || topupProcessing || (!!topupPayMethod && MOBILE.includes(topupPayMethod) && !topupTxnId.trim())}
                    style={{ width:'100%', padding:'14px', borderRadius:12, background: (!topupPayMethod || topupProcessing)?'#333':'#f97316', color:(!topupPayMethod||topupProcessing)?'#666':'#000', fontWeight:800, fontSize:15, border:'none', cursor:topupPayMethod&&!topupProcessing?'pointer':'not-allowed' }}>
                    {topupProcessing ? '...' : `✅ Konfime +$${topupAmount.toFixed(2)}`}
                  </button>
                  <button onClick={() => setTopupStep('amount')} style={{ width:'100%', marginTop:8, padding:'10px', borderRadius:12, background:'transparent', border:'1px solid #1e1e2e', color:'#888', fontWeight:700, fontSize:13, cursor:'pointer' }}>← Tounen</button>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>🍺 Ajoute Bar Credit</h3>
                  <p style={{ color:'#888', fontSize:12, marginBottom:20 }}>
                    Balans aktyèl: <span style={{ color:'#f97316', fontWeight:700 }}>${(ticket?.barTabBalance||0).toFixed(2)}</span>
                  </p>
                  {hasMenu ? (
                    <>
                      {Array.from(new Set(topupMenuItems.map(i => i.station))).map(station => (
                        <div key={station}>
                          {Array.from(new Set(topupMenuItems.map(i=>i.station))).length > 1 && (
                            <p style={{ color:'#555', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginTop:16, marginBottom:8 }}>{station}</p>
                          )}
                          {topupMenuItems.filter(i => i.station === station).map(item => {
                            const qty = topupCart[item.name] ?? 0;
                            return (
                              <div key={item.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #1e1e2e' }}>
                                <div>
                                  <p style={{ fontWeight:600, fontSize:14, color:'#fff' }}>{item.name}</p>
                                  <p style={{ color:'#f97316', fontSize:12, fontWeight:700 }}>${item.price.toFixed(2)}</p>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                  {qty > 0 && (
                                    <button onClick={() => setTopupCart(p => { const n={...p}; if((n[item.name]||0)<=1) delete n[item.name]; else n[item.name]--; return n; })}
                                      style={{ width:32, height:32, borderRadius:'50%', border:'1px solid #333', background:'transparent', color:'#fff', fontSize:18, cursor:'pointer', lineHeight:1 }}>−</button>
                                  )}
                                  {qty > 0 && <span style={{ color:'#fff', fontWeight:700, fontSize:14, width:16, textAlign:'center' }}>{qty}</span>}
                                  <button onClick={() => setTopupCart(p => ({ ...p, [item.name]:(p[item.name]||0)+1 }))}
                                    style={{ width:32, height:32, borderRadius:'50%', border:'1px solid #333', background:'transparent', color:'#fff', fontSize:18, cursor:'pointer', lineHeight:1 }}>+</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      <button onClick={() => { if(menuTotal>0){setTopupAmount(menuTotal);setTopupStep('payment');} }}
                        disabled={menuTotal<=0}
                        style={{ width:'100%', marginTop:20, padding:'14px', borderRadius:12, background:menuTotal>0?'#f97316':'#333', color:menuTotal>0?'#000':'#666', fontWeight:800, fontSize:15, border:'none', cursor:menuTotal>0?'pointer':'not-allowed' }}>
                        {menuTotal>0 ? `Kontinye — $${menuTotal.toFixed(2)} →` : 'Chwazi atik yo'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                        {[20,50,100].map(amt => (
                          <button key={amt} onClick={() => { setTopupAmount(amt); setTopupCustom(''); }}
                            style={{ flex:1, padding:'12px 0', borderRadius:12, fontWeight:700, fontSize:14, border:`1px solid ${topupAmount===amt?'#f97316':'#1e1e2e'}`, background:topupAmount===amt?'rgba(249,115,22,0.15)':'transparent', color:topupAmount===amt?'#f97316':'#888', cursor:'pointer' }}>
                            +${amt}
                          </button>
                        ))}
                      </div>
                      <div style={{ position:'relative', marginBottom:20 }}>
                        <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#888', fontSize:14 }}>$</span>
                        <input type="number" min={1} placeholder="Lòt montan" value={topupCustom}
                          onChange={e => { setTopupCustom(e.target.value); setTopupAmount(Math.max(0,parseInt(e.target.value)||0)); }}
                          style={{ width:'100%', paddingLeft:28, paddingRight:14, paddingTop:12, paddingBottom:12, borderRadius:12, border:'1px solid #1e1e2e', background:'#0a0a0f', color:'#fff', fontSize:14, boxSizing:'border-box' }} />
                      </div>
                      <button onClick={() => { if(topupAmount>0) setTopupStep('payment'); }}
                        disabled={topupAmount<=0}
                        style={{ width:'100%', padding:'14px', borderRadius:12, background:topupAmount>0?'#f97316':'#333', color:topupAmount>0?'#000':'#666', fontWeight:800, fontSize:15, border:'none', cursor:topupAmount>0?'pointer':'not-allowed' }}>
                        {topupAmount>0 ? `Kontinye — $${topupAmount.toFixed(2)} →` : 'Antre yon montan'}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Transfer Modal */}
      {showTransfer && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 20, width: '100%', maxWidth: 480, padding: 24, position: 'relative' }}>
            <button onClick={() => { setShowTransfer(false); setTransferName(''); setTransferPhone(''); }} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
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

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTransferByToken, acceptTransfer, getEvent } from '@/lib/db';
import { auth } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import type { EventData } from '@/lib/db';
import { useT } from '@/i18n';

type Status = 'loading' | 'ready' | 'accepting' | 'done' | 'error';

export default function TransferAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { t } = useT();

  const [status, setStatus] = useState<Status>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [transfer, setTransfer] = useState<{
    transferToName: string;
    transferToPhone: string;
    expiry: Date;
    eventId: string;
  } | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [newPin, setNewPin] = useState('');
  const [ticketCode, setTicketCode] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const transferData = await getTransferByToken(token);
        if (!transferData) throw new Error(t('transfer_err_invalid'));
        if (transferData.status !== 'pending') throw new Error(t('transfer_err_used'));
        if (new Date() > transferData.expiry) throw new Error(t('transfer_err_expired'));

        const ev = await getEvent(transferData.eventId);
        setTransfer(transferData);
        setEvent(ev);
        setStatus('ready');
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : t('error_unknown'));
        setStatus('error');
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAccept = async () => {
    setStatus('accepting');
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      const result = await acceptTransfer(token);
      setNewPin(result.pin);
      setTicketCode(result.ticketCode);
      setStatus('done');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : t('error_unknown'));
      setStatus('error');
    }
  };

  const hoursLeft = transfer
    ? Math.max(0, Math.floor((transfer.expiry.getTime() - Date.now()) / 3600000))
    : 0;

  if (status === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
      <div style={{ width: 40, height: 40, border: '4px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (status === 'error') return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <div style={{ fontSize: 52 }}>❌</div>
      <h1 style={{ fontSize: 20, fontWeight: 800, textAlign: 'center' }}>{t('transfer_invalid_title')}</h1>
      <p style={{ color: '#888', fontSize: 14, textAlign: 'center', maxWidth: 320 }}>{errMsg}</p>
      <button onClick={() => router.push('/')} style={{ padding: '12px 24px', borderRadius: 10, background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
        {t('transfer_go_home')}
      </button>
    </div>
  );

  if (status === 'done') return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <div style={{ fontSize: 52 }}>🎉</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: 'center' }}>{t('transfer_done_title')}</h1>
      <p style={{ color: '#888', fontSize: 14, textAlign: 'center', maxWidth: 320 }}>{t('transfer_done_desc')}</p>

      {/* PIN + code — the recipient MUST see these */}
      <div style={{ background: '#12121a', border: '1px solid #6366f1', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <p style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>📋 Enfòmasyon Tikè Ou</p>
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Kòd Tikè</p>
          <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: 2 }}>{ticketCode}</p>
        </div>
        <div style={{ borderTop: '1px solid #1e1e2e', paddingTop: 16 }}>
          <p style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>🔐 PIN pou wè tikè ou</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {newPin.split('').map((d, i) => (
              <div key={i} style={{ width: 44, height: 52, borderRadius: 10, background: '#6366f115', border: '2px solid #6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#6366f1' }}>
                {d}
              </div>
            ))}
          </div>
          <p style={{ color: '#ef4444', fontSize: 11, marginTop: 12, fontWeight: 600 }}>⚠️ Kenbe PIN sa — ou pral bezwen l pou wè tikè ou.</p>
        </div>
      </div>

      <button
        onClick={() => router.push(`/ticket/${ticketCode}`)}
        style={{ padding: '14px 32px', borderRadius: 12, background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', width: '100%', maxWidth: 340 }}
      >
        🎫 {t('transfer_view_ticket')}
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff' }}>
      {/* Header */}
      <nav style={{ background: '#0a0a0f', borderBottom: '1px solid #1e1e2e', padding: '0 20px' }}>
        <div style={{ maxWidth: 500, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>ANBYANS</span>
        </div>
      </nav>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 56 }}>🎫</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 12 }}>{t('transfer_received_title')}</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
            {t('transfer_received_desc')}
          </p>
        </div>

        {/* Event card */}
        {event && (
          <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            {event.imageUrl && (
              <img src={event.imageUrl} alt={event.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 12 }} />
            )}
            <div style={{ fontWeight: 800, fontSize: 17 }}>{event.name}</div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
              📅 {event.startDate} &nbsp;·&nbsp; 🕐 {event.startTime}
            </div>
            {event.venue?.name && <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>📍 {event.venue.name}</div>}
          </div>
        )}

        {/* Transfer info */}
        <div style={{ background: '#12121a', border: '1px solid #6366f1', borderRadius: 14, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{t('transfer_for')}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{transfer?.transferToName}</div>
              <div style={{ color: '#888', fontSize: 12 }}>{transfer?.transferToPhone}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700 }}>⏳ {hoursLeft} {t('transfer_hours_left')}</div>
            </div>
          </div>
        </div>

        {/* Accept button */}
        <button
          onClick={handleAccept}
          disabled={status === 'accepting'}
          style={{
            width: '100%', padding: 16, borderRadius: 12, border: 'none',
            background: '#6366f1', color: '#fff', fontSize: 16, fontWeight: 800,
            cursor: 'pointer', opacity: status === 'accepting' ? 0.7 : 1,
          }}
        >
          {status === 'accepting' ? t('transfer_accepting') : t('transfer_accept_btn')}
        </button>

        <p style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 14 }}>
          {t('transfer_note')}
        </p>
      </div>
    </div>
  );
}

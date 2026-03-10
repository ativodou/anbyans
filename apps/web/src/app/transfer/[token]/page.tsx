'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTransferByToken, acceptTransfer, getEvent } from '@/lib/db';
import type { EventData } from '@/lib/db';

type Status = 'loading' | 'ready' | 'accepting' | 'done' | 'error';

export default function TransferAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

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

  useEffect(() => {
    const load = async () => {
      try {
        const t = await getTransferByToken(token);
        if (!t) throw new Error('Lyen transfè sa pa valid.');
        if (t.status !== 'pending') throw new Error('Transfè sa deja itilize oswa anile.');
        if (new Date() > t.expiry) throw new Error('Transfè a ekspire. Mande moun nan voye yon lòt.');

        const ev = await getEvent(t.eventId);
        setTransfer(t);
        setEvent(ev);
        setStatus('ready');
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : 'Erè enkoni.');
        setStatus('error');
      }
    };
    load();
  }, [token]);

  const handleAccept = async () => {
    setStatus('accepting');
    try {
      await acceptTransfer(token);
      setStatus('done');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Erè.');
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
      <h1 style={{ fontSize: 20, fontWeight: 800, textAlign: 'center' }}>Transfè pa valid</h1>
      <p style={{ color: '#888', fontSize: 14, textAlign: 'center', maxWidth: 320 }}>{errMsg}</p>
      <button onClick={() => router.push('/')} style={{ padding: '12px 24px', borderRadius: 10, background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
        Retounen Akèy
      </button>
    </div>
  );

  if (status === 'done') return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <div style={{ fontSize: 52 }}>🎉</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: 'center' }}>Tikè ou a prèt!</h1>
      <p style={{ color: '#888', fontSize: 14, textAlign: 'center', maxWidth: 320 }}>
        Transfè a aksepte. Ou ka wè tikè ou a nan paj tikè yo ak nimewo telefòn ou ak PIN ou.
      </p>
      <button
        onClick={() => router.push('/tickets')}
        style={{ padding: '14px 32px', borderRadius: 12, background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' }}
      >
        🎫 Wè Tikè Mwen
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
          <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 12 }}>Ou resevwa yon tikè!</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
            Yon moun ap transfere yon tikè ba ou. Aksepte l anvan li ekspire.
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
              <div style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Pou</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{transfer?.transferToName}</div>
              <div style={{ color: '#888', fontSize: 12 }}>{transfer?.transferToPhone}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700 }}>⏳ {hoursLeft}è ki rete</div>
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
          {status === 'accepting' ? 'Ap aksepte...' : '✅ Aksepte Tikè Sa'}
        </button>

        <p style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 14 }}>
          Lè ou aksepte, tikè a ap anrejistre sou nimewo telefòn ou bay la.
        </p>
      </div>
    </div>
  );
}

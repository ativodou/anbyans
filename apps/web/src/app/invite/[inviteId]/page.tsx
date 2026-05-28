'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getInvitation, getEvent, type Invitation, type EventData } from '@/lib/db';

function fmt(s: string) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('fr-HT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return s; }
}

function fmtTime(s: string) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function InvitePage() {
  const { inviteId } = useParams() as { inviteId: string };
  const router = useRouter();

  const [invite, setInvite]   = useState<Invitation | null>(null);
  const [event, setEvent]     = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!inviteId) return;
    (async () => {
      const inv = await getInvitation(inviteId);
      if (!inv) { setInvalid(true); setLoading(false); return; }
      setInvite(inv);
      const ev = await getEvent(inv.eventId);
      setEvent(ev);
      setLoading(false);
    })();
  }, [inviteId]);

  const handleAccept = () => {
    if (!event?.privateToken) return;
    router.push(`/e/${event.privateToken}?invite=${inviteId}`);
  };

  const downloadCard = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !invite || !event) return;
    const ctx = canvas.getContext('2d')!;
    const W = 800, H = 1100;
    canvas.width = W; canvas.height = H;

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a0a14');
    grad.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Cover image if available
    if (event.imageUrl) {
      try {
        await new Promise<void>((res, rej) => {
          const img = new Image(); img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.globalAlpha = 0.25;
            ctx.drawImage(img, 0, 0, W, H / 2);
            ctx.globalAlpha = 1;
            res();
          };
          img.onerror = () => res();
          img.src = event.imageUrl!;
        });
      } catch {}
    }

    // Gradient overlay
    const overlay = ctx.createLinearGradient(0, H * 0.2, 0, H * 0.55);
    overlay.addColorStop(0, 'rgba(10,10,20,0)');
    overlay.addColorStop(1, 'rgba(10,10,20,1)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H * 0.55);

    // Orange accent top bar
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, 0, W, 6);

    // "You're Invited" label
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 18px sans-serif';
    ctx.letterSpacing = '4px';
    ctx.textAlign = 'center';
    ctx.fillText('✦  OU ENVITE  ✦', W / 2, 60);

    // Guest name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px serif';
    ctx.letterSpacing = '0px';
    ctx.fillText(invite.guestName, W / 2, 420);

    // Divider
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W / 2 - 120, 445); ctx.lineTo(W / 2 + 120, 445); ctx.stroke();

    // Event name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px sans-serif';
    const evName = event.name || '';
    ctx.fillText(evName.length > 30 ? evName.slice(0, 28) + '…' : evName, W / 2, 510);

    // Date & time
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(fmt(event.startDate) + (event.startDate ? '  ·  ' + fmtTime(event.startDate) : ''), W / 2, 570);

    // Venue
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px sans-serif';
    const venueStr = typeof event.venue === 'object' ? (event.venue as any)?.name || '' : String(event.venue || '');
    ctx.fillText(venueStr, W / 2, 620);

    // Bottom note
    ctx.fillStyle = '#666666';
    ctx.font = '14px sans-serif';
    ctx.fillText('Prezante lyen envitasyon ou a nan antre', W / 2, H - 80);
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('anbyans.events', W / 2, H - 50);

    // Download
    const a = document.createElement('a');
    a.download = `invitation-${invite.guestName.replace(/\s+/g, '-')}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  if (invalid || !invite || !event) return (
    <div className="min-h-screen bg-[#0a0a14] flex flex-col items-center justify-center text-white gap-4 text-center p-6">
      <p className="text-5xl">🔒</p>
      <p className="font-bold text-xl">Envitasyon pa valid</p>
      <p className="text-gray-400 text-sm">Lyen sa pa valid oswa li ekspire.</p>
    </div>
  );

  const venueStr = typeof event.venue === 'object' ? (event.venue as any)?.name || '' : String(event.venue || '');
  const isUsed = invite.status === 'confirmed';

  return (
    <div className="min-h-screen bg-[#0a0a14] flex flex-col items-center justify-center p-4">
      <canvas ref={canvasRef} className="hidden" />

      {/* Card */}
      <div className="w-full max-w-sm relative overflow-hidden rounded-3xl shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #12121f 0%, #1a0a2e 100%)', border: '1px solid rgba(249,115,22,0.3)' }}>

        {/* Cover image */}
        {event.imageUrl && (
          <div className="relative h-52 overflow-hidden">
            <img src={event.imageUrl} alt="" className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, #12121f)' }} />
          </div>
        )}

        {/* Orange top stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-orange" />

        <div className="px-8 pt-8 pb-10 text-center">
          {/* Label */}
          <p className="text-orange text-[11px] font-bold tracking-[5px] uppercase mb-6">
            ✦ &nbsp;Ou Envite&nbsp; ✦
          </p>

          {/* Guest name */}
          <h1 className="font-heading text-3xl text-white mb-3 leading-tight">
            {invite.guestName}
          </h1>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-orange/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-orange" />
            <div className="flex-1 h-px bg-orange/30" />
          </div>

          {/* Event name */}
          <h2 className="text-white font-bold text-xl mb-4">{event.name}</h2>

          {/* Date */}
          {event.startDate && (
            <p className="text-orange text-sm font-bold mb-1">
              {fmt(event.startDate)}
            </p>
          )}
          {event.startDate && (
            <p className="text-orange/80 text-sm mb-3">{fmtTime(event.startDate)}</p>
          )}

          {/* Venue */}
          {venueStr && (
            <p className="text-gray-400 text-sm mb-8">📍 {venueStr}</p>
          )}

          {/* Status if already confirmed */}
          {isUsed ? (
            <div className="py-3 rounded-2xl bg-green-900/30 border border-green/30 text-green font-bold text-sm mb-4">
              ✓ Envitasyon konfime
            </div>
          ) : (
            <button onClick={handleAccept}
              className="w-full py-4 rounded-2xl bg-orange text-black font-heading font-bold text-base hover:bg-orange/90 active:scale-95 transition-all mb-4">
              {event.privateMode === 'free' ? '🎊 Konfime Prezans' : '🎟 Achte Tikè'}
            </button>
          )}

          {/* Download card */}
          <button onClick={downloadCard}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
            ⬇ Telechaje kart envitasyon
          </button>
        </div>

        {/* Bottom brand */}
        <div className="border-t border-white/[0.05] py-3 text-center">
          <p className="text-[10px] text-gray-600">anbyans.events</p>
        </div>
      </div>
    </div>
  );
}

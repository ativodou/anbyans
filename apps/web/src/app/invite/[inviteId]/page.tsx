'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getInvitation, getEvent, type Invitation, type EventData } from '@/lib/db';

function fmt(s: string) {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('fr-HT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return s; }
}
function fmtTime(s: string) {
  if (!s) return '';
  try { return new Date(s).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export default function InvitePage() {
  const { inviteId } = useParams() as { inviteId: string };
  const router = useRouter();

  const [invite, setInvite]       = useState<Invitation | null>(null);
  const [event, setEvent]         = useState<EventData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [invalid, setInvalid]     = useState(false);
  const [qty, setQty]             = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone]           = useState(false);
  const [ticketCodes, setTicketCodes] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!inviteId) return;
    (async () => {
      try {
        const inv = await getInvitation(inviteId);
        if (!inv) { setInvalid(true); return; }
        setInvite(inv);
        if (inv.status === 'confirmed') { setDone(true); setTicketCodes(inv.ticketCode ? [inv.ticketCode] : []); }
        const ev = await getEvent(inv.eventId);
        setEvent(ev);
      } catch { setInvalid(true); }
      finally { setLoading(false); }
    })();
  }, [inviteId]);

  const handleAccept = async () => {
    if (!invite || !event) return;
    // Paid private: go to buy page
    if (event.privateMode !== 'free') {
      router.push(`/e/${event.privateToken}?invite=${inviteId}`);
      return;
    }
    // Free private: RSVP via server API (no auth required)
    setConfirming(true);
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId, qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erè');
      setTicketCodes(data.codes);
      setDone(true);
    } catch (e: any) { console.error(e); alert(e.message || 'Erè. Eseye ankò.'); }
    finally { setConfirming(false); }
  };

  const downloadCard = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !invite || !event) return;
    const ctx = canvas.getContext('2d')!;
    const W = 800, H = 1100;
    canvas.width = W; canvas.height = H;
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a0a14'); grad.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    if (event.imageUrl) {
      await new Promise<void>(res => {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => { ctx.globalAlpha = 0.25; ctx.drawImage(img, 0, 0, W, H / 2); ctx.globalAlpha = 1; res(); };
        img.onerror = () => res();
        img.src = event.imageUrl!;
      });
    }
    const ov = ctx.createLinearGradient(0, H * 0.2, 0, H * 0.55);
    ov.addColorStop(0, 'rgba(10,10,20,0)'); ov.addColorStop(1, 'rgba(10,10,20,1)');
    ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H * 0.55);
    ctx.fillStyle = '#f97316'; ctx.fillRect(0, 0, W, 6);
    ctx.fillStyle = '#f97316'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('✦  OU ENVITE  ✦', W / 2, 60);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 52px serif';
    ctx.fillText(invite.guestName, W / 2, 420);
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W/2-120, 445); ctx.lineTo(W/2+120, 445); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 38px sans-serif';
    const n = event.name || '';
    ctx.fillText(n.length > 30 ? n.slice(0,28)+'…' : n, W/2, 510);
    ctx.fillStyle = '#f97316'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText(fmt(event.startDate||'') + (event.startDate ? '  ·  '+fmtTime(event.startDate) : ''), W/2, 570);
    const venueStr = typeof event.venue === 'object' ? (event.venue as any)?.name||'' : String(event.venue||'');
    ctx.fillStyle = '#aaa'; ctx.font = '18px sans-serif'; ctx.fillText(venueStr, W/2, 620);
    ctx.fillStyle = '#666'; ctx.font = '14px sans-serif';
    ctx.fillText('Prezante lyen envitasyon ou a nan antre', W/2, H-80);
    ctx.fillStyle = '#f97316'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText('anbyans.events', W/2, H-50);
    const a = document.createElement('a');
    a.download = `invitation-${invite.guestName.replace(/\s+/g,'-')}.png`;
    a.href = canvas.toDataURL('image/png'); a.click();
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

  const venueStr = typeof event.venue === 'object' ? (event.venue as any)?.name||'' : String(event.venue||'');
  const isFree = event.privateMode === 'free';
  const maxQty = 1 + (invite.allowPlusOnes ?? 0);

  // ── Done / confirmed ──────────────────────────────────────────
  if (done) return (
    <div className="min-h-screen bg-[#0a0a14] flex flex-col items-center justify-center p-4 text-center">
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(160deg,#12121f,#1a0a2e)', border: '1px solid rgba(34,197,94,0.4)' }}>
        <div className="h-1 bg-green-500" />
        <div className="px-8 py-10">
          <p className="text-5xl mb-4">🎉</p>
          <p className="font-heading text-2xl text-white mb-2">Prezans Konfime!</p>
          <p className="text-gray-400 text-sm mb-6">
            {ticketCodes.length > 1 ? `${ticketCodes.length} tikè pou` : 'Tikè pou'} <span className="text-white font-semibold">{invite.guestName}</span>
          </p>
          <div className="space-y-2 mb-6">
            {ticketCodes.map(code => (
              <div key={code} className="px-4 py-2 rounded-xl bg-white/[0.05] border border-border font-mono text-sm text-orange">{code}</div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500">Montre kòd sa nan antre evènman an.</p>
        </div>
        <div className="border-t border-white/[0.05] py-3 text-center">
          <p className="text-[10px] text-gray-600">anbyans.events</p>
        </div>
      </div>
    </div>
  );

  // ── Invitation card ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a14] flex flex-col items-center justify-center p-4">
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-sm relative overflow-hidden rounded-3xl shadow-2xl"
        style={{ background: 'linear-gradient(160deg,#12121f,#1a0a2e)', border: '1px solid rgba(249,115,22,0.3)' }}>

        {event.imageUrl && (
          <div className="relative h-52 overflow-hidden">
            <img src={event.imageUrl} alt="" className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom,transparent 30%,#12121f)' }} />
          </div>
        )}
        <div className="absolute top-0 left-0 right-0 h-1 bg-orange" />

        <div className="px-8 pt-8 pb-10 text-center">
          <p className="text-orange text-[11px] font-bold tracking-[5px] uppercase mb-6">✦ &nbsp;Ou Envite&nbsp; ✦</p>
          <h1 className="font-heading text-3xl text-white mb-3 leading-tight">{invite.guestName}</h1>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-orange/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-orange" />
            <div className="flex-1 h-px bg-orange/30" />
          </div>
          <h2 className="text-white font-bold text-xl mb-4">{event.name}</h2>
          {event.startDate && <p className="text-orange text-sm font-bold mb-1">{fmt(event.startDate)}</p>}
          {event.startDate && <p className="text-orange/80 text-sm mb-3">{fmtTime(event.startDate)}</p>}
          {venueStr && <p className="text-gray-400 text-sm mb-6">📍 {venueStr}</p>}

          {/* Qty selector for free events with plus ones */}
          {isFree && maxQty > 1 && (
            <div className="mb-6">
              <p className="text-[11px] text-gray-400 mb-3 uppercase tracking-widest">Konbyen moun?</p>
              <div className="flex gap-2 justify-center">
                {Array.from({ length: maxQty }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setQty(n)}
                    className={`w-12 h-12 rounded-xl font-bold text-sm transition-all ${qty === n ? 'bg-orange text-black' : 'bg-white/[0.06] text-gray-300 hover:bg-white/10'}`}>
                    {n === 1 ? 'Mwen' : `+${n - 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleAccept} disabled={confirming}
            className="w-full py-4 rounded-2xl bg-orange text-black font-heading font-bold text-base hover:bg-orange/90 active:scale-95 transition-all mb-4 disabled:opacity-60">
            {confirming ? '⏳…' : isFree ? (qty > 1 ? `🎊 Konfime ${qty} Plas` : '🎊 Konfime Prezans') : '🎟 Achte Tikè'}
          </button>

          <button onClick={downloadCard}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
            ⬇ Telechaje kart envitasyon
          </button>
        </div>
        <div className="border-t border-white/[0.05] py-3 text-center">
          <p className="text-[10px] text-gray-600">anbyans.events</p>
        </div>
      </div>
    </div>
  );
}

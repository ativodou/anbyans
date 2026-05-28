'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getEvent, getGuestList, addGuest, removeGuest, type Invitation, type EventData } from '@/lib/db';

const STATUS_COLOR: Record<string, string> = {
  invited:   'bg-white/[0.06] text-gray-muted',
  confirmed: 'bg-green-900/30 text-green',
  declined:  'bg-red-900/30 text-red-400',
};

const STATUS_LABEL: Record<string, string> = {
  invited:   'Envite',
  confirmed: 'Konfime ✓',
  declined:  'Refize',
};

export default function GuestListPage() {
  const { id: eventId } = useParams() as { id: string };
  const { user } = useAuth();

  const [event, setEvent]     = useState<EventData | null>(null);
  const [guests, setGuests]   = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState<string | null>(null);

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [plusOnes, setPlusOnes] = useState<0|1|2>(0);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const [ev, list] = await Promise.all([getEvent(eventId), getGuestList(eventId)]);
        setEvent(ev);
        setGuests(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [eventId]);

  const inviteLink = (inviteId: string) => `${window.location.origin}/invite/${inviteId}`;

  const copyLink = (inviteId: string) => {
    navigator.clipboard.writeText(inviteLink(inviteId));
    setCopied(inviteId);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAdd = async () => {
    if (!name.trim() || !user?.uid) return;
    setSaving(true); setError('');
    try {
      const inv = await addGuest(eventId, user.uid, { name, email, phone, allowPlusOnes: plusOnes });
      setGuests(prev => [inv, ...prev]);
      setName(''); setEmail(''); setPhone(''); setPlusOnes(0);
    } catch (e: any) {
      setError(e?.message || 'Erè. Eseye ankò.');
    } finally { setSaving(false); }
  };

  const handleRemove = async (inviteId: string) => {
    if (!confirm('Retire envitasyon sa?')) return;
    await removeGuest(inviteId);
    setGuests(prev => prev.filter(g => g.id !== inviteId));
  };

  const card = 'bg-dark-card border border-border rounded-card';

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  if (!event?.isPrivate) return (
    <div className="p-8 text-center text-gray-muted">
      <p className="text-3xl mb-3">🔓</p>
      <p className="font-semibold">Evènman sa a pa prive.</p>
      <p className="text-xs mt-1">Aktive mòd prive nan paramèt evènman an pou jere lis envitasyon.</p>
    </div>
  );

  const isFree = event.privateMode === 'free';
  const confirmed = guests.filter(g => g.status === 'confirmed').length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* Header */}
      <div>
        <Link href="/organizer/events" className="inline-flex items-center gap-1 text-[11px] text-gray-muted hover:text-white mb-3 transition-colors">
          ← Retounen
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-heading text-xl tracking-wide uppercase">Lis Envitasyon</h2>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFree ? 'bg-purple-900/30 text-purple-300' : 'bg-orange-dim text-orange'}`}>
            {isFree ? '🎊 Gratis' : '💳 Peye'}
          </span>
        </div>
        <p className="text-xs text-gray-muted">{event.name} · {guests.length} envite · {confirmed} konfime</p>
      </div>

      {/* Add guest form */}
      <div className={`${card} p-4 space-y-3`}>
        <p className="text-sm font-bold">Ajoute yon envite</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Non konplè *"
          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-sm text-white placeholder-gray-muted outline-none focus:border-orange" />
        <div className="flex gap-3">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Imèl (opsyonèl)"
            className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-sm text-white placeholder-gray-muted outline-none focus:border-orange" />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefòn (opsyonèl)"
            className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-sm text-white placeholder-gray-muted outline-none focus:border-orange" />
        </div>
        {isFree && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-border">
            <p className="text-xs text-gray-muted">Pèmèt +1 / +2?</p>
            <div className="flex gap-1">
              {([0,1,2] as const).map(n => (
                <button key={n} type="button" onClick={() => setPlusOnes(n)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${plusOnes === n ? 'bg-orange text-black' : 'bg-white/[0.05] text-gray-muted hover:text-white'}`}>
                  {n === 0 ? 'Non' : `+${n}`}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button onClick={handleAdd} disabled={saving || !name.trim()}
          className="w-full py-2.5 rounded-xl bg-orange text-black font-bold text-sm disabled:opacity-40 hover:bg-orange/90 transition-all">
          {saving ? '…' : '+ Ajoute envite'}
        </button>
      </div>

      {/* Guest list */}
      {guests.length === 0 ? (
        <div className={`${card} p-10 text-center`}>
          <p className="text-3xl mb-2">🎟</p>
          <p className="text-gray-muted text-sm">Pa gen envite ankò. Ajoute premye envite ou a.</p>
        </div>
      ) : (
        <div className={card}>
          {guests.map((g, i) => (
            <div key={g.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[13px] truncate">{g.guestName}</p>
                <p className="text-[11px] text-gray-muted truncate">
                  {[g.guestEmail, g.guestPhone].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>

              {/* Status + plus ones */}
              <div className="flex items-center gap-1 shrink-0">
                {(g.allowPlusOnes ?? 0) > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-gray-muted">+{g.allowPlusOnes}</span>
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[g.status]}`}>
                  {STATUS_LABEL[g.status]}{g.ticketCount && g.ticketCount > 1 ? ` ×${g.ticketCount}` : ''}
                </span>
              </div>

              {/* Send buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {g.guestPhone && (
                  <a href={`https://wa.me/${g.guestPhone.replace(/\D/g,'')}?text=${encodeURIComponent(`Ou envite nan ${event?.name || 'evènman an'}! Klike sou lyen sa pou konfime prezans ou: ${inviteLink(g.id)}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-green hover:underline">📱 WA</a>
                )}
                {g.guestEmail && (
                  <a href={`mailto:${g.guestEmail}?subject=${encodeURIComponent(`Envitasyon — ${event?.name || 'Evènman'}`)}&body=${encodeURIComponent(`Bonjou ${g.guestName},\n\nOu envite nan ${event?.name || 'evènman an'}!\n\nKlike sou lyen sa pou konfime prezans ou:\n${inviteLink(g.id)}\n\nAnbyans`)}`}
                    className="text-[11px] text-cyan hover:underline">✉️ Imèl</a>
                )}
                <button onClick={() => copyLink(g.id)}
                  className="text-[11px] text-orange hover:underline">
                  {copied === g.id ? '✓' : '🔗'}
                </button>
              </div>

              {/* Remove */}
              <button onClick={() => handleRemove(g.id)}
                className="text-gray-muted hover:text-red-400 text-[11px] shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      {guests.length > 0 && (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-border text-[11px] text-gray-muted">
          <p className="font-bold text-gray-light mb-1">Kijan sa mache?</p>
          <p>Klike sou <span className="text-green">📱 WA</span> pou voye lyen nan WhatsApp, <span className="text-cyan">✉️ Imèl</span> pou voye pa imèl, oswa <span className="text-orange">🔗</span> pou kopye lyen an. Chak envite gen pwòp lyen pèsonèl li pou {isFree ? 'konfime prezans li (tikè gratis otomatik)' : 'achte tikè li'}.</p>
        </div>
      )}

    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getEvent, getGuestList, addGuest, removeGuest, getPlatformConfig, addCashActivationRequest, type Invitation, type EventData } from '@/lib/db';
import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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

function ActivateStripeForm({ onSuccess, onError }: { onSuccess: () => void; onError: (m: string) => void }) {
  const stripe = useStripe(); const elements = useElements();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!stripe || !elements) return;
    setBusy(true);
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { onError(error.message || 'Erè peman'); setBusy(false); }
    else onSuccess();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      <button type="submit" disabled={busy || !stripe}
        className="w-full py-3 rounded-xl bg-orange text-black font-bold text-sm disabled:opacity-40">
        {busy ? '⏳…' : t('pos_pay_card')}
      </button>
    </form>
  );
}

export default function GuestListPage() {
  const { id: eventId } = useParams() as { id: string };
  const { user } = useAuth();
  const { t } = useT();

  const [event, setEvent]     = useState<EventData | null>(null);
  const [guests, setGuests]   = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState<string | null>(null);

  // Activation gate
  const [privateFee, setPrivateFee]         = useState(25);
  const [showModal, setShowModal]           = useState(false);
  const [activating, setActivating]         = useState(false);
  const [activateSecret, setActivateSecret] = useState<string | null>(null);
  const [activateError, setActivateError]   = useState('');
  const [pendingAction, setPendingAction]   = useState<(() => void) | null>(null);
  const [cashSent, setCashSent]             = useState(false);
  const [cashBusy, setCashBusy]             = useState(false);
  const [cashPending, setCashPending]       = useState(false);

  // Form
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [plusOnes, setPlusOnes] = useState<0|1|2>(0);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const [ev, list, cfg] = await Promise.all([
          getEvent(eventId),
          getGuestList(eventId),
          getPlatformConfig(),
        ]);
        setEvent(ev);
        setGuests(list);
        setPrivateFee(cfg.privateFee);
        getDocs(query(collection(db, 'cashActivationRequests'), where('eventId', '==', eventId), where('status', '==', 'pending')))
          .then(snap => { if (!snap.empty) setCashPending(true); })
          .catch(() => {});
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [eventId]);

  // Gate: if not activated, show payment modal instead of running the action
  const gate = (action: () => void) => {
    if (event?.privateActivated) { action(); return; }
    if (cashPending) return; // already waiting for admin approval
    setPendingAction(() => action);
    setShowModal(true);
  };

  const handleActivate = async () => {
    if (!event) return;
    setActivating(true); setActivateError('');
    try {
      const res = await fetch('/api/payment/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: privateFee, currency: 'usd', eventName: `Private Activation — ${event.name}`, seats: 1 }),
      });
      const { clientSecret } = await res.json();
      setActivateSecret(clientSecret);
    } catch { setActivateError('Erè. Eseye ankò.'); }
    finally { setActivating(false); }
  };

  const handleCashRequest = async () => {
    if (!event || !user) return;
    setCashBusy(true); setActivateError('');
    try {
      await addCashActivationRequest({
        eventId,
        eventName: event.name,
        organizerId: user.uid,
        organizerName: `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || user.email || '',
        amount: privateFee,
      });
      setCashSent(true);
      setCashPending(true);
    } catch { setActivateError('Erè. Eseye ankò.'); }
    finally { setCashBusy(false); }
  };

  const handleActivateSuccess = async () => {
    if (!eventId) return;
    await updateDoc(doc(db, 'events', eventId), { privateActivated: true, privateActivatedAt: new Date().toISOString() });
    setEvent(prev => prev ? { ...prev, privateActivated: true } as EventData : prev);
    setActivateSecret(null);
    setShowModal(false);
    if (pendingAction) { pendingAction(); setPendingAction(null); }
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

  const inviteLink = (inviteId: string) => `${window.location.origin}/invite/${inviteId}`;

  const markSent = (inviteId: string) => {
    updateDoc(doc(db, 'invitations', inviteId), { sentAt: new Date().toISOString() }).catch(() => {});
    setGuests(prev => prev.map(g => g.id === inviteId ? { ...g, sentAt: new Date().toISOString() } as any : g));
  };

  const copyLink = (inviteId: string) => {
    const url = inviteLink(inviteId);
    if (navigator.clipboard) { navigator.clipboard.writeText(url).catch(() => fallbackCopy(url)); }
    else { fallbackCopy(url); }
    setCopied(inviteId);
    setTimeout(() => setCopied(null), 2000);
    markSent(inviteId);
  };
  const fallbackCopy = (text: string) => {
    const ta = document.createElement('textarea'); ta.value = text;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
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
      <p className="font-semibold">{t('guests_not_private')}</p>
      <p className="text-xs mt-1">{t('guests_not_private_hint')}</p>
    </div>
  );

  const isFree = event.privateMode === 'free';
  const confirmed = guests.filter(g => g.status === 'confirmed').length;

  return (
    <>
      <div className="space-y-6 max-w-2xl mx-auto">

        {/* Header */}
        <div>
          <Link href="/organizer/events" className="inline-flex items-center gap-1 text-[11px] text-gray-muted hover:text-white mb-3 transition-colors">
            {t('guests_back')}
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-heading text-xl tracking-wide uppercase">{t('guests_title')}</h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFree ? 'bg-purple-900/30 text-purple-300' : 'bg-orange-dim text-orange'}`}>
              {isFree ? t('guests_badge_free') : t('guests_badge_paid')}
            </span>
            {event.privateActivated && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/30 text-green">{t('guests_badge_activated')}</span>}
          {!event.privateActivated && cashPending && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400">{t('guests_badge_cash_pending')}</span>}
          </div>
          <p className="text-xs text-gray-muted">{event.name} · {guests.length} envite · {confirmed} konfime</p>
        </div>

        {/* Add guest form */}
        <div className={`${card} p-4 space-y-3`}>
          <p className="text-sm font-bold">{t('guests_add_title')}</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('guests_name_ph')}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-sm text-white placeholder-gray-muted outline-none focus:border-orange" />
          <div className="flex gap-3">
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t('guests_email_ph')}
              className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-sm text-white placeholder-gray-muted outline-none focus:border-orange" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('guests_phone_ph')}
              className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-sm text-white placeholder-gray-muted outline-none focus:border-orange" />
          </div>
          {isFree && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-border">
              <p className="text-xs text-gray-muted">{t('guests_plusones_label')}</p>
              <div className="flex gap-1">
                {([0,1,2] as const).map(n => (
                  <button key={n} type="button" onClick={() => setPlusOnes(n)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${plusOnes === n ? 'bg-orange text-black' : 'bg-white/[0.05] text-gray-muted hover:text-white'}`}>
                    {n === 0 ? t('guests_plusones_no') : `+${n}`}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={handleAdd} disabled={saving || !name.trim()}
            className="w-full py-2.5 rounded-xl bg-orange text-black font-bold text-sm disabled:opacity-40 hover:bg-orange/90 transition-all">
            {saving ? '…' : t('guests_add_btn')}
          </button>
        </div>

        {/* Guest list */}
        {guests.length === 0 ? (
          <div className={`${card} p-10 text-center`}>
            <p className="text-3xl mb-2">🎟</p>
            <p className="text-gray-muted text-sm">{t('guests_empty')}</p>
          </div>
        ) : (
          <div className={card}>
            {guests.map((g, i) => (
              <div key={g.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[13px] truncate">{g.guestName}</p>
                  <p className="text-[11px] text-gray-muted truncate">
                    {[g.guestEmail, g.guestPhone].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {(g.allowPlusOnes ?? 0) > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-gray-muted">+{g.allowPlusOnes}</span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[g.status]}`}>
                    {STATUS_LABEL[g.status]}{g.ticketCount && g.ticketCount > 1 ? ` ×${g.ticketCount}` : ''}
                  </span>
                </div>

                {/* Send buttons — gated */}
                <div className="flex items-center gap-1 shrink-0">
                  {(g as any).sentAt && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-900/20 text-green">✓ Voye</span>
                  )}
                  {g.guestPhone && (
                    <button onClick={() => gate(() => { window.open(`https://wa.me/${g.guestPhone!.replace(/\D/g,'')}?text=${encodeURIComponent(`Ou envite nan ${event?.name || 'evènman an'}! Klike sou lyen sa pou konfime prezans ou: ${inviteLink(g.id)}`)}`, '_blank'); markSent(g.id); })}
                      className="text-[11px] text-green hover:underline">📱 WA</button>
                  )}
                  {g.guestEmail && (
                    <button onClick={() => gate(() => { window.open(`mailto:${g.guestEmail}?subject=${encodeURIComponent(`Envitasyon — ${event?.name || 'Evènman'}`)}&body=${encodeURIComponent(`Bonjou ${g.guestName},\n\nOu envite nan ${event?.name || 'evènman an'}!\n\nKlike sou lyen sa pou konfime prezans ou:\n${inviteLink(g.id)}\n\nAnbyans`)}`, '_self'); markSent(g.id); })}
                      className="text-[11px] text-cyan hover:underline">✉️ Imèl</button>
                  )}
                  <button onClick={() => gate(() => copyLink(g.id))}
                    className="text-[11px] text-orange hover:underline">
                    {copied === g.id ? '✓' : '🔗'}
                  </button>
                </div>

                <button onClick={() => handleRemove(g.id)}
                  className="text-gray-muted hover:text-red-400 text-[11px] shrink-0">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        {guests.length > 0 && (
          <div className="p-4 rounded-xl bg-white/[0.02] border border-border text-[11px] text-gray-muted">
            <p className="font-bold text-gray-light mb-1">{t('guests_how_title')}</p>
            <p>Klike sou <span className="text-green">📱 WA</span>, <span className="text-cyan">✉️ Imèl</span>, oswa <span className="text-orange">🔗</span> {t('guests_how_full')} {isFree ? t('guests_how_desc_free') : t('guests_how_desc_paid')}.</p>
          </div>
        )}

      </div>

      {/* Activation modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => { if (!activateSecret) { setShowModal(false); setPendingAction(null); } }}>
          <div className="bg-dark-card border border-border rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-base">{t('guests_activate_title')}</h3>
              {!activateSecret && <button onClick={() => { setShowModal(false); setPendingAction(null); }} className="text-gray-muted hover:text-white text-xl">✕</button>}
            </div>
            <p className="text-sm text-gray-muted mb-4">Peman inisyal <span className="text-white font-bold">${privateFee}</span> {t('guests_activate_desc')}</p>
            {activateError && <p className="text-red-400 text-xs mb-3">{activateError}</p>}

            {cashSent ? (
              <div className="text-center py-4">
                <p className="text-3xl mb-2">💵</p>
                <p className="text-sm font-bold text-white mb-1">{t('pos_cash_sent_title')}</p>
                <p className="text-xs text-gray-muted">{t('pos_cash_sent_desc')}</p>
                <button onClick={() => { setShowModal(false); setCashSent(false); setPendingAction(null); }}
                  className="mt-4 w-full py-2.5 rounded-xl bg-white/[0.06] text-white text-sm font-bold hover:bg-white/10 transition-all">
                  {t('pos_close_btn')}
                </button>
              </div>
            ) : !activateSecret ? (
              <div className="space-y-2">
                <button onClick={handleActivate} disabled={activating}
                  className="w-full py-3 rounded-xl bg-orange text-black font-bold text-sm disabled:opacity-40 hover:bg-orange/90 transition-all">
                  {activating ? '⏳…' : t('guests_pay_card_btn')}
                </button>
                <button onClick={handleCashRequest} disabled={cashBusy}
                  className="w-full py-3 rounded-xl bg-white/[0.06] border border-border text-white font-bold text-sm disabled:opacity-40 hover:bg-white/10 transition-all">
                  {cashBusy ? '⏳…' : t('guests_pay_cash_btn')}
                </button>
              </div>
            ) : (
              <Elements stripe={stripePromise} options={{ clientSecret: activateSecret, appearance: { theme: 'night' } }}>
                <ActivateStripeForm onSuccess={handleActivateSuccess} onError={setActivateError} />
              </Elements>
            )}
          </div>
        </div>
      )}
    </>
  );
}

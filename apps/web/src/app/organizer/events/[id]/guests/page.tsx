'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getEvent, getGuestList, addGuest, removeGuest, getPlatformConfig, addCashActivationRequest, type Invitation, type EventData } from '@/lib/db';
import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
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

interface GiftItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  link?: string;
  qty: number;
}

interface GiftClaim {
  id: string;
  eventId: string;
  itemId: string;
  guestName: string;
  inviteId: string;
  claimedAt: string;
}

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

function GiftRegistryTab({ eventId }: { eventId: string }) {
  const card = 'bg-dark-card border border-border rounded-card';
  const [giftItems, setGiftItems] = useState<GiftItem[]>([]);
  const [giftClaims, setGiftClaims] = useState<GiftClaim[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(true);
  const [savingGift, setSavingGift] = useState(false);
  const [giftError, setGiftError] = useState('');

  const [gName, setGName] = useState('');
  const [gDesc, setGDesc] = useState('');
  const [gPrice, setGPrice] = useState('');
  const [gLink, setGLink] = useState('');
  const [gQty, setGQty] = useState('1');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eName, setEName] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [ePrice, setEPrice] = useState('');
  const [eLink, setELink] = useState('');
  const [eQty, setEQty] = useState('1');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [evSnap, claimsSnap] = await Promise.all([
          getDocs(query(collection(db, 'events'), where('__name__', '==', eventId))),
          getDocs(query(collection(db, 'giftClaims'), where('eventId', '==', eventId))),
        ]);
        if (!evSnap.empty) {
          const data = evSnap.docs[0].data();
          setGiftItems((data.giftItems || []) as GiftItem[]);
        }
        const claims: GiftClaim[] = claimsSnap.docs.map(d => ({ id: d.id, ...d.data() } as GiftClaim));
        setGiftClaims(claims);
      } catch (e) { console.error(e); }
      finally { setLoadingGifts(false); }
    })();
  }, [eventId]);

  const handleAddGift = async () => {
    if (!gName.trim()) return;
    setSavingGift(true); setGiftError('');
    try {
      const newItem: GiftItem = {
        id: Math.random().toString(36).slice(2, 8),
        name: gName.trim(),
        description: gDesc.trim() || undefined,
        price: gPrice ? parseFloat(gPrice) : undefined,
        link: gLink.trim() || undefined,
        qty: parseInt(gQty) || 1,
      };
      const updated = [...giftItems, newItem];
      await updateDoc(doc(db, 'events', eventId), { giftItems: updated });
      setGiftItems(updated);
      setGName(''); setGDesc(''); setGPrice(''); setGLink(''); setGQty('1');
    } catch (e: any) {
      setGiftError(e?.message || 'Erè. Eseye ankò.');
    } finally { setSavingGift(false); }
  };

  const handleDeleteGift = async (itemId: string) => {
    if (!confirm('Efase kado sa?')) return;
    const updated = giftItems.filter(i => i.id !== itemId);
    await updateDoc(doc(db, 'events', eventId), { giftItems: updated });
    setGiftItems(updated);
  };

  const startEdit = (item: GiftItem) => {
    setEditingId(item.id);
    setEName(item.name);
    setEDesc(item.description || '');
    setEPrice(item.price != null ? String(item.price) : '');
    setELink(item.link || '');
    setEQty(String(item.qty));
  };

  const handleSaveEdit = async () => {
    if (!editingId || !eName.trim()) return;
    setSavingEdit(true);
    const updated = giftItems.map(i => i.id === editingId ? {
      ...i,
      name: eName.trim(),
      description: eDesc.trim() || undefined,
      price: ePrice ? parseFloat(ePrice) : undefined,
      link: eLink.trim() || undefined,
      qty: parseInt(eQty) || 1,
    } : i);
    await updateDoc(doc(db, 'events', eventId), { giftItems: updated });
    setGiftItems(updated);
    setEditingId(null);
    setSavingEdit(false);
  };

  if (loadingGifts) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Add gift form */}
      <div className={`${card} p-4 space-y-3`}>
        <p className="text-sm font-bold">Ajoute yon Kado</p>
        <input value={gName} onChange={e => setGName(e.target.value)} placeholder="Non kado (obligatwa)"
          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-sm text-white placeholder-gray-muted outline-none focus:border-orange" />
        <input value={gDesc} onChange={e => setGDesc(e.target.value)} placeholder="Deskripsyon (opsyonèl)"
          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-sm text-white placeholder-gray-muted outline-none focus:border-orange" />
        <div className="flex gap-3">
          <input value={gPrice} onChange={e => setGPrice(e.target.value)} placeholder="Pri $ (opsyonèl)" type="number" min="0" step="0.01"
            className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-sm text-white placeholder-gray-muted outline-none focus:border-orange" />
          <input value={gQty} onChange={e => setGQty(e.target.value)} placeholder="Kantite" type="number" min="1"
            className="w-24 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-sm text-white placeholder-gray-muted outline-none focus:border-orange" />
        </div>
        <input value={gLink} onChange={e => setGLink(e.target.value)} placeholder="Lyen Amazon/boutik (opsyonèl)"
          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-sm text-white placeholder-gray-muted outline-none focus:border-orange" />
        {giftError && <p className="text-red-400 text-xs">{giftError}</p>}
        <button onClick={handleAddGift} disabled={savingGift || !gName.trim()}
          className="w-full py-2.5 rounded-xl bg-orange text-black font-bold text-sm disabled:opacity-40 hover:bg-orange/90 transition-all">
          {savingGift ? '…' : '+ Ajoute Kado'}
        </button>
      </div>

      {/* Gift list */}
      {giftItems.length === 0 ? (
        <div className={`${card} p-10 text-center`}>
          <p className="text-3xl mb-2">🎁</p>
          <p className="text-gray-muted text-sm">Pa gen kado nan lis la ankò.</p>
        </div>
      ) : (
        <div className={card}>
          {giftItems.map((item, i) => {
            const itemClaims = giftClaims.filter(c => c.itemId === item.id);
            const remaining = item.qty - itemClaims.length;
            const isEditing = editingId === item.id;
            return (
              <div key={item.id} className={`px-4 py-4 ${i > 0 ? 'border-t border-border' : ''}`}>
                {isEditing ? (
                  <div className="space-y-2">
                    <input value={eName} onChange={e => setEName(e.target.value)} placeholder="Non kado"
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-orange text-sm text-white outline-none" />
                    <input value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder="Deskripsyon"
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-border text-sm text-white outline-none focus:border-orange" />
                    <div className="flex gap-2">
                      <input value={ePrice} onChange={e => setEPrice(e.target.value)} placeholder="Pri $" type="number" min="0"
                        className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-border text-sm text-white outline-none focus:border-orange" />
                      <input value={eQty} onChange={e => setEQty(e.target.value)} placeholder="Qty" type="number" min="1"
                        className="w-20 px-3 py-2 rounded-lg bg-white/[0.05] border border-border text-sm text-white outline-none focus:border-orange" />
                    </div>
                    <input value={eLink} onChange={e => setELink(e.target.value)} placeholder="Lyen boutik"
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-border text-sm text-white outline-none focus:border-orange" />
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} disabled={savingEdit || !eName.trim()}
                        className="flex-1 py-2 rounded-lg bg-orange text-black text-xs font-bold disabled:opacity-40">
                        {savingEdit ? '…' : '✓ Anrejistre'}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-4 py-2 rounded-lg bg-white/[0.06] text-gray-muted text-xs font-bold hover:text-white">
                        Anile
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[13px]">{item.name}</p>
                      {item.description && <p className="text-[11px] text-gray-muted mt-0.5">{item.description}</p>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {item.price != null && <span className="text-[12px] text-orange font-bold">${item.price}</span>}
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-cyan hover:underline">🛒 Achte</a>
                        )}
                        <span className={`text-[11px] font-bold ${remaining > 0 ? 'text-green' : 'text-gray-muted'}`}>
                          {remaining} / {item.qty} disponib
                        </span>
                      </div>
                      {itemClaims.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {itemClaims.map(c => (
                            <p key={c.id} className="text-[10px] text-gray-muted">✓ {c.guestName}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(item)}
                        className="text-gray-muted hover:text-orange text-[11px]">✎</button>
                      <button onClick={() => handleDeleteGift(item.id)}
                        className="text-gray-muted hover:text-red-400 text-[11px]">✕</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
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
  const [activeTab, setActiveTab] = useState<'guests' | 'gifts'>('guests');

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

  const isPrivateEvent = event?.isPrivate ||
    (event as any)?.eventType === 'free_private' ||
    (event as any)?.eventType === 'paid_private';

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

        {/* Tabs */}
        {isPrivateEvent && (
          <div className="flex gap-1 p-1 bg-white/[0.03] border border-border rounded-xl">
            <button
              onClick={() => setActiveTab('guests')}
              className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-all ${activeTab === 'guests' ? 'bg-orange text-black' : 'text-gray-muted hover:text-white'}`}>
              👥 Envite
            </button>
            <button
              onClick={() => setActiveTab('gifts')}
              className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-all ${activeTab === 'gifts' ? 'bg-orange text-black' : 'text-gray-muted hover:text-white'}`}>
              🎁 Lis Kado
            </button>
          </div>
        )}

        {/* Gift tab */}
        {activeTab === 'gifts' && isPrivateEvent && (
          <GiftRegistryTab eventId={eventId} />
        )}

        {/* Guest tab content */}
        {activeTab === 'guests' && (
          <>
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
          </>
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

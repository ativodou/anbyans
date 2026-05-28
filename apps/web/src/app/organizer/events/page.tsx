'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { type EventData, markEventEnded, markEventPublished, markEventLive, getPlatformConfig } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import FloorPlanViewer from '@/components/FloorPlanViewer';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useOrganizerEvent } from '../OrganizerEventContext';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function OrganizerEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useT();
  const { setSelectedEvent } = useOrganizerEvent();

  const [events, setEvents] = useState<EventData[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState('');
  const [statusLoading, setStatusLoading] = useState('');
  const [posFee, setPosFee] = useState(50);
  const [posModal, setPosModal] = useState<string | null>(null);
  const [posClientSecret, setPosClientSecret] = useState<string | null>(null);
  const [posLoading, setPosLoading] = useState(false);
  const [posError, setPosError] = useState('');

  useEffect(() => {
    getPlatformConfig().then(cfg => setPosFee(cfg.posFee));
  }, []);

  useEffect(() => {
    if (authLoading || !user?.uid) return;
    const q = query(collection(db, 'events'), where('organizerId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as EventData)));
      setLoading(false);
    }, (err) => { console.error('events', err); setLoading(false); });
    getDocs(query(collection(db, 'tickets'), where('organizerId', '==', user.uid)))
      .then(s => setAllTickets(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
    return unsub;
  }, [user?.uid, authLoading]);

  async function handleGoLive(eventId: string) {
    setStatusLoading(eventId);
    await markEventLive(eventId);
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'live' } : e));
    setStatusLoading('');
  }
  async function handlePosActivate(eventId: string) {
    setPosLoading(true); setPosError(''); setPosClientSecret(null);
    try {
      const res = await fetch('/api/payment/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: posFee, currency: 'usd', eventName: 'POS Activation', seats: 1 }),
      });
      const data = await res.json();
      if (data.error) { setPosError(data.error); return; }
      setPosClientSecret(data.clientSecret);
    } catch (e: any) {
      setPosError(e.message || 'Erè.');
    } finally { setPosLoading(false); }
  }

  async function handlePosPaymentSuccess(eventId: string) {
    const barCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await updateDoc(doc(db, 'events', eventId), { posActivated: true, posActivatedAt: new Date().toISOString(), barCode });
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, posActivated: true, barCode } as any : e));
    setPosModal(null); setPosClientSecret(null);
  }

  async function handleEndEvent(eventId: string) {
    if (!confirm(t('event_end_confirm'))) return;
    setStatusLoading(eventId);
    await markEventEnded(eventId);
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'ended' } : e));
    setStatusLoading('');
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-gray-light">{events.length} {t('event_count')}</p>
        <Link href="/organizer/events/create"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
          ➕ {t('org_create_event_btn')}
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="bg-dark-card border border-border rounded-card p-12 text-center">
          <p className="text-5xl mb-3">📅</p>
          <p className="text-gray-muted mb-4">{t('event_no_events')}</p>
          <Link href="/organizer/events/create"
            className="inline-flex px-5 py-2.5 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
            ➕ {t('org_create_first_event')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(e => {
            const evTickets = allTickets.filter(t => t.eventId === e.id && t.status !== 'cancelled');
            const evRevenue = evTickets.reduce((a: number, t: any) => a + (t.price || 0), 0);
            const isFreeEvent = (e.sections || []).length > 0 && (e.sections || []).every(s => !s.price);
            const cap = (e.sections || []).reduce((a, s) => a + (s.capacity || 0), 0);
            const pct = cap > 0 ? Math.round((evTickets.length / cap) * 100) : 0;
            const isOpen = !!e.id && expandedId === e.id;

            return (
              <div key={e.id}
                onClick={() => setExpandedId(isOpen ? '' : (e.id || ''))}
                className={`bg-dark-card border rounded-card p-4 transition-all cursor-pointer select-none ${
                  isOpen ? 'border-orange' : 'border-border hover:border-white/[0.1]'
                }`}>

                {/* ── Card header ── */}
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-[10px] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-3xl flex-shrink-0">
                    {(e as any).emoji || '🎫'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold">{e.name}</p>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        e.status === 'live'      ? 'bg-green-dim text-green' :
                        e.status === 'published' ? 'bg-cyan-dim text-cyan' :
                        'bg-white/[0.05] text-gray-muted'
                      }`}>
                        {e.status === 'live'      ? `● ${t('status_live')}` :
                         e.status === 'published' ? t('status_published') :
                         e.status === 'draft'     ? t('status_draft') :
                                                     t('status_ended')}
                      </span>
                      {e.isPrivate && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange/20 text-orange border border-orange/30">🔒 PRIVATE</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-light">
                      📅 {e.startDate || (e as any).date || '—'} · 🎫 {evTickets.length} {t('org_stat_tickets_sold')}
                    </p>
                    {cap > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-orange rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-muted">{pct}%</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                    {isFreeEvent
                      ? <p className="font-heading text-2xl text-green">GRATIS</p>
                      : <p className="font-heading text-2xl">${evRevenue.toLocaleString()}</p>}
                    <p className="text-[10px] text-gray-muted">{evTickets.length} {t('rev_ticket_count')}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {e.id && (
                        <Link href={`/organizer/events/${e.id}/edit`}
                          onClick={ev => ev.stopPropagation()}
                          className="text-[10px] text-gray-muted hover:text-orange transition-colors">
                          ✏️
                        </Link>
                      )}
                      <span className={`text-[10px] transition-all duration-200 ${isOpen ? 'text-orange' : 'text-gray-muted'}`}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Expanded content ── */}
                {isOpen && (
                  <div onClick={ev => ev.stopPropagation()}>
                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                      <Link href={`/organizer/events/${e.id}/edit`}
                        onClick={ev => ev.stopPropagation()}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">
                        ✏️ {t('event_action_edit')}
                      </Link>
                      <Link href={`/organizer/staff?event=${e.id}`}
                        onClick={ev => ev.stopPropagation()}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">
                        👥 {t('org_nav_staff')}
                      </Link>
                      <Link href={`/organizer/scanner?event=${e.id}`}
                        onClick={ev => ev.stopPropagation()}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">
                        📷 {t('event_action_scanner')}
                      </Link>
                      {e.isPrivate && e.privateToken && (
                        <>
                          <Link href={`/organizer/events/${e.id}/guests`}
                            onClick={ev => ev.stopPropagation()}
                            className="px-3 py-1.5 rounded-lg bg-orange/10 border border-orange/30 text-[10px] font-bold text-orange hover:bg-orange hover:text-white transition-all">
                            🎟 Envite
                          </Link>
                          <button
                            onClick={ev => { ev.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/e/${e.privateToken}`); }}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all">
                            📋 {t('event_copy_private_link')}
                          </button>
                        </>
                      )}
                      {e.id && (
                        (e as any).posActivated
                          ? <Link href="/organizer/bar" onClick={ev => { ev.stopPropagation(); setSelectedEvent(e); }}
                              className="px-3 py-1.5 rounded-lg bg-purple/10 border border-purple/30 text-[10px] font-bold text-purple hover:bg-purple/20 transition-all">
                              🍽️ POS Active → Menu
                            </Link>
                          : <button onClick={ev => { ev.stopPropagation(); setPosModal(e.id!); setPosClientSecret(null); setPosError(''); }}
                              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-purple hover:border-purple/30 transition-all">
                              🍽️ Activate POS — ${posFee}
                            </button>
                      )}
                      {e.status === 'published' && e.id && (
                        <button
                          onClick={ev => { ev.stopPropagation(); handleGoLive(e.id!); }}
                          disabled={statusLoading === e.id}
                          className="px-3 py-1.5 rounded-lg bg-green-dim border border-green/30 text-[10px] font-bold text-green hover:bg-green hover:text-black transition-all disabled:opacity-50">
                          {statusLoading === e.id ? '⏳' : `● ${t('status_live')}`}
                        </button>
                      )}
                      {(e.status === 'published' || e.status === 'live') && e.id && (
                        <button
                          onClick={ev => { ev.stopPropagation(); handleEndEvent(e.id!); }}
                          disabled={statusLoading === e.id}
                          className="px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-800/40 text-[10px] font-bold text-red-400 hover:bg-red-800/40 transition-all disabled:opacity-50">
                          {statusLoading === e.id ? '⏳' : `■ ${t('event_action_end')}`}
                        </button>
                      )}
                    </div>

                    {/* Floor plan if available */}
                    {e.id && (
                      <div className="mt-4">
                        <FloorPlanViewer
                          eventId={e.id}
                          sections={(e.sections || []) as any[]}
                          compact={false}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── POS Activation Modal ── */}
      {posModal && (
        <div onClick={() => { setPosModal(null); setPosClientSecret(null); }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()}
            className="bg-dark-card border border-border rounded-2xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <p className="text-4xl mb-3">🍽️</p>
              <h3 className="font-heading text-xl text-white mb-1">Activate POS</h3>
              <p className="text-xs text-gray-muted">One-time fee of <span className="text-white font-bold">${posFee}</span> — unlocks bar & sales tracking for this event</p>
            </div>
            {posError && <p className="text-red-400 text-xs mb-3 text-center">{posError}</p>}
            {!posClientSecret && (
              <button onClick={() => handlePosActivate(posModal)} disabled={posLoading}
                className={`w-full py-3 rounded-xl font-bold text-sm ${posLoading ? 'bg-white/[0.04] text-gray-muted cursor-not-allowed' : 'bg-purple text-white hover:bg-purple/80'} transition-all`}>
                {posLoading ? '...' : `💳 Pay $${posFee} & Activate`}
              </button>
            )}
            {posClientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret: posClientSecret, appearance: { theme: 'night' } }}>
                <PosStripeForm
                  onSuccess={() => handlePosPaymentSuccess(posModal)}
                  onError={msg => setPosError(msg)}
                />
              </Elements>
            )}
            <button onClick={() => { setPosModal(null); setPosClientSecret(null); }}
              className="w-full mt-3 text-xs text-gray-muted hover:text-white transition-colors bg-transparent border-none cursor-pointer py-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PosStripeForm({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  async function handlePay() {
    if (!stripe || !elements) return;
    setConfirming(true);
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { onError(error.message || 'Payment failed.'); setConfirming(false); return; }
    if (paymentIntent?.status === 'succeeded') onSuccess();
    setConfirming(false);
  }
  return (
    <div>
      <PaymentElement />
      <button onClick={handlePay} disabled={confirming || !stripe}
        className={`w-full mt-4 py-3 rounded-xl font-bold text-sm ${confirming ? 'bg-white/[0.04] text-gray-muted cursor-not-allowed' : 'bg-purple text-white hover:bg-purple/80'} transition-all`}>
        {confirming ? '...' : 'Confirm Payment'}
      </button>
    </div>
  );
}

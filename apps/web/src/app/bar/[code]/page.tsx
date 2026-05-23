'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  getBarStations, getBarItems, getBarStaffNames, placeBarOrder,
  type BarStation, type BarItem, type BarPaymentMethod, type EventData,
} from '@/lib/db';

const PAYMENT_METHODS: { key: BarPaymentMethod; label: string }[] = [
  { key: 'cash',    label: '💵 Cash' },
  { key: 'card',    label: '💳 Card' },
  { key: 'moncash', label: '📱 MonCash' },
  { key: 'natcash', label: '📱 Natcash' },
  { key: 'zelle',   label: '⚡ Zelle' },
  { key: 'paypal',  label: '🅿️ PayPal' },
];

interface CartItem { item: BarItem; qty: number; }

type Step = 'identity' | 'pos' | 'confirm' | 'done';

export default function StaffPosPage() {
  const { code } = useParams<{ code: string }>();

  const [event, setEvent]       = useState<EventData | null>(null);
  const [stations, setStations] = useState<BarStation[]>([]);
  const [allItems, setAllItems] = useState<BarItem[]>([]);
  const [staffNames, setStaffNames] = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Identity
  const [staffName, setStaffName]     = useState('');
  const [customName, setCustomName]   = useState('');
  const [stationId, setStationId]     = useState('');

  // POS
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [payMethod, setPayMethod]     = useState<BarPaymentMethod>('cash');

  // Flow
  const [step, setStep]               = useState<Step>('identity');
  const [submitting, setSubmitting]   = useState(false);
  const [orderNum, setOrderNum]       = useState<number | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    fetch(`/api/bar/${code}`)
      .then(r => r.json())
      .then(async ev => {
        if (cancelled) return;
        if (!ev?.id) { setNotFound(true); setLoading(false); return; }
        setEvent(ev as EventData);
        try {
          const [st, it, names] = await Promise.all([
            getBarStations(ev.id),
            getBarItems(ev.id),
            getBarStaffNames(ev.id),
          ]);
          if (cancelled) return;
          setStations(st);
          setAllItems(it);
          setStaffNames(names);
          if (st.length > 0) setStationId(st[0].id!);
        } catch {}
        if (!cancelled) setLoading(false);
      })
      .catch(() => { if (!cancelled) { setNotFound(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [code]);

  const selectedStation = stations.find(s => s.id === stationId);
  const stationItems = allItems.filter(i => i.stationId === stationId);
  const cartTotal = cart.reduce((a, c) => a + c.qty * c.item.price, 0);
  const activeStaff = staffName === '__custom__' ? customName : staffName;

  function addToCart(item: BarItem) {
    const remaining = item.stock - item.sold - (cart.find(c => c.item.id === item.id)?.qty ?? 0);
    if (item.stock > 0 && remaining <= 0) return;
    setCart(prev => {
      const ex = prev.find(c => c.item.id === item.id);
      if (ex) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { item, qty: 1 }];
    });
  }

  function removeFromCart(itemId: string) {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === itemId);
      if (!ex) return prev;
      if (ex.qty === 1) return prev.filter(c => c.item.id !== itemId);
      return prev.map(c => c.item.id === itemId ? { ...c, qty: c.qty - 1 } : c);
    });
  }

  async function handleSubmit() {
    if (!event?.id || !activeStaff || !selectedStation || cart.length === 0) return;
    setSubmitting(true);
    try {
      const { orderNum: num } = await placeBarOrder({
        eventId: event.id,
        organizerId: (event as any).organizerId,
        stationId: selectedStation.id!,
        stationName: selectedStation.name,
        staffName: activeStaff,
        items: cart.map(c => ({ itemId: c.item.id!, name: c.item.name, qty: c.qty, price: c.item.price })),
        total: cartTotal,
        paymentMethod: payMethod,
        status: 'pending',
      });
      // Update local sold counts so stock shows correctly for next order
      setAllItems(prev => prev.map(item => {
        const ordered = cart.find(c => c.item.id === item.id);
        return ordered ? { ...item, sold: item.sold + ordered.qty } : item;
      }));
      setOrderNum(num);
      setStep('done');
      setCart([]);
    } finally { setSubmitting(false); }
  }

  const inp = 'w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm outline-none focus:border-orange placeholder:text-gray-500';

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-center p-6">
      <p className="text-4xl mb-3">❌</p>
      <p className="text-white font-bold">Invalid code.</p>
      <p className="text-gray-500 text-sm mt-1">Check the link and try again.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f] border-b border-white/[0.07] px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-sm">{event?.name}</p>
          {step !== 'identity' && (
            <p className="text-[10px] text-gray-500">{activeStaff} · {selectedStation?.name}</p>
          )}
        </div>
        {step === 'pos' && cart.length > 0 && (
          <button onClick={() => setStep('confirm')}
            className="px-4 py-2 rounded-xl bg-orange text-white text-xs font-bold">
            Checkout ({cart.reduce((a, c) => a + c.qty, 0)}) — ${cartTotal.toFixed(2)}
          </button>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 py-5">

        {/* ── IDENTITY STEP ── */}
        {step === 'identity' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Who are you?</h2>

            {staffNames.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {staffNames.map(name => (
                  <button key={name} onClick={() => setStaffName(name)}
                    className={`py-3 rounded-xl border text-sm font-bold transition-all ${staffName === name ? 'border-orange bg-orange/10 text-orange' : 'border-white/[0.1] text-gray-300 hover:border-white/30'}`}>
                    {name}
                  </button>
                ))}
                <button onClick={() => setStaffName('__custom__')}
                  className={`py-3 rounded-xl border text-sm font-bold transition-all ${staffName === '__custom__' ? 'border-orange bg-orange/10 text-orange' : 'border-white/[0.1] text-gray-400 hover:border-white/30'}`}>
                  Other…
                </button>
              </div>
            )}

            {(staffName === '__custom__' || staffNames.length === 0) && (
              <input value={customName} onChange={e => setCustomName(e.target.value)}
                placeholder="Enter your name" className={inp} autoFocus />
            )}

            {stations.length > 1 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Station</p>
                <div className="grid grid-cols-2 gap-2">
                  {stations.map(s => (
                    <button key={s.id} onClick={() => setStationId(s.id!)}
                      className={`py-3 rounded-xl border text-sm font-bold transition-all ${stationId === s.id ? 'border-orange bg-orange/10 text-orange' : 'border-white/[0.1] text-gray-300 hover:border-white/30'}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => activeStaff.trim() && stationId && setStep('pos')}
              disabled={!activeStaff.trim() || !stationId}
              className="w-full py-3.5 rounded-xl bg-orange text-white font-bold text-sm disabled:opacity-40 transition-all">
              Start →
            </button>
          </div>
        )}

        {/* ── POS STEP ── */}
        {step === 'pos' && (
          <div>
            {stationItems.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-gray-500 text-sm">No items for this station.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {stationItems.map(item => {
                    const inCart = cart.find(c => c.item.id === item.id)?.qty ?? 0;
                    const remaining = item.stock > 0 ? item.stock - item.sold - inCart : Infinity;
                    const outOfStock = item.stock > 0 && remaining <= 0;
                    return (
                      <button key={item.id} onClick={() => addToCart(item)} disabled={outOfStock}
                        className={`relative p-4 rounded-2xl border text-left transition-all active:scale-95 ${outOfStock ? 'border-white/[0.05] opacity-40 cursor-not-allowed' : inCart > 0 ? 'border-orange bg-orange/10' : 'border-white/[0.1] hover:border-white/30'}`}>
                        {inCart > 0 && (
                          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-orange text-white text-xs font-bold flex items-center justify-center">{inCart}</span>
                        )}
                        <p className="font-bold text-sm mb-1 pr-6">{item.name}</p>
                        <p className="text-orange font-bold text-lg">${item.price.toFixed(2)}</p>
                        {item.stock > 0 && (
                          <p className={`text-[10px] mt-1 ${remaining <= 5 ? 'text-orange' : 'text-gray-500'}`}>
                            {remaining <= 0 ? 'Epwize' : `${remaining} rete`}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {cart.length > 0 && (
                  <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a0a0f] border-t border-white/[0.07]">
                    <button onClick={() => setStep('confirm')}
                      className="w-full py-4 rounded-2xl bg-orange text-white font-bold text-base">
                      Checkout — ${cartTotal.toFixed(2)}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CONFIRM STEP ── */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Review Order</h2>

            <div className="bg-white/[0.04] border border-white/[0.1] rounded-2xl p-4 space-y-2">
              {cart.map(c => (
                <div key={c.item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeFromCart(c.item.id!)}
                      className="w-6 h-6 rounded-full border border-white/20 text-gray-400 hover:text-red-400 text-xs transition-colors">−</button>
                    <span className="text-sm">{c.qty}× {c.item.name}</span>
                  </div>
                  <span className="text-sm font-bold">${(c.qty * c.item.price).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-white/[0.1] pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-xl">${cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Payment Method</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button key={m.key} onClick={() => setPayMethod(m.key)}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${payMethod === m.key ? 'border-orange bg-orange/10 text-orange' : 'border-white/[0.1] text-gray-300 hover:border-white/30'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold text-base disabled:opacity-50 transition-all">
              {submitting ? '...' : '✓ Place Order'}
            </button>

            <button onClick={() => setStep('pos')} className="w-full text-sm text-gray-500 hover:text-white transition-colors py-2">
              ← Back
            </button>
          </div>
        )}

        {/* ── DONE STEP ── */}
        {step === 'done' && (
          <div className="text-center py-12 space-y-4">
            <p className="text-6xl">✅</p>
            <div>
              <p className="text-gray-500 text-sm">Order Number</p>
              <p className="font-heading text-5xl text-orange">#{orderNum}</p>
            </div>
            <p className="text-gray-400 text-sm">Order sent to {selectedStation?.name}</p>
            <button onClick={() => setStep('pos')}
              className="w-full py-4 rounded-2xl bg-orange text-white font-bold text-base">
              New Order
            </button>
            <button onClick={() => { setStep('identity'); setStaffName(''); setCustomName(''); }}
              className="w-full text-sm text-gray-500 hover:text-white transition-colors py-2">
              Change Staff / Station
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

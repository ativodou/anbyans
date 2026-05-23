'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  getBarStations, subscribeBarOrders, updateBarOrderStatus,
  type BarStation, type BarOrder, type EventData,
} from '@/lib/db';

export default function VendorDisplayPage() {
  const { code } = useParams<{ code: string }>();

  const [event, setEvent]       = useState<EventData | null>(null);
  const [stations, setStations] = useState<BarStation[]>([]);
  const [stationId, setStationId] = useState<string>('');
  const [orders, setOrders]     = useState<BarOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [delivering, setDelivering] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    fetch(`/api/bar/${code}`)
      .then(r => r.json())
      .then(async ev => {
        if (cancelled) return;
        if (!ev?.id) { setNotFound(true); setLoading(false); return; }
        setEvent(ev as EventData);
        const st = await getBarStations(ev.id).catch(() => []);
        if (cancelled) return;
        setStations(st);
        if (!stationId && st.length > 0) setStationId(st[0].id!);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setNotFound(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [code]);

  // Subscribe to orders for selected station
  useEffect(() => {
    if (!event?.id) return;
    unsubRef.current?.();
    unsubRef.current = subscribeBarOrders(event.id, stationId || null, setOrders);
    return () => { unsubRef.current?.(); };
  }, [event?.id, stationId]);


  async function handleDeliver(orderId: string) {
    setDelivering(orderId);
    try {
      await updateBarOrderStatus(orderId, 'delivered');
    } finally { setDelivering(null); }
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const recentDelivered = orders.filter(o => o.status === 'delivered').slice(0, 5);

  if (loading) return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-orange border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center text-center p-6">
      <p className="text-5xl mb-3">❌</p>
      <p className="text-white font-bold text-lg">Kòd la pa valid.</p>
    </div>
  );

  const selectedStation = stations.find(s => s.id === stationId);

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans flex flex-col">

      {/* Header */}
      <div className="bg-[#0a0a0f] border-b border-white/[0.07] px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-lg font-bold">{event?.name}</p>
          <p className="text-sm text-orange font-bold">{selectedStation?.name ?? 'Tout Estasyon'}</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingOrders.length > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-orange text-white text-sm font-bold animate-pulse">
              {pendingOrders.length} order{pendingOrders.length > 1 ? 's' : ''}
            </span>
          )}
          {/* Station selector */}
          {stations.length > 1 && (
            <select value={stationId} onChange={e => setStationId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white text-sm outline-none">
              <option value="" className="bg-[#0a0a0f]">All</option>
              {stations.map(s => <option key={s.id} value={s.id} className="bg-[#0a0a0f]">{s.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Order grid */}
      <div className="flex-1 p-4">
        {pendingOrders.length === 0 && recentDelivered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-5xl mb-3">✅</p>
            <p className="text-gray-500 text-sm">No pending orders.</p>
          </div>
        ) : (
          <div>
            {/* Pending orders - large cards */}
            {pendingOrders.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {pendingOrders.map(order => (
                  <div key={order.id}
                    className="bg-[#0d0d15] border-2 border-orange/60 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-4xl text-orange">#{order.orderNum}</span>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">{order.staffName}</p>
                        <p className="text-xs font-bold text-gray-300">{order.stationName}</p>
                      </div>
                    </div>

                    <div className="space-y-1.5 flex-1">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-orange/20 text-orange text-sm font-bold flex items-center justify-center flex-shrink-0">
                            {item.qty}
                          </span>
                          <span className="text-base font-semibold">{item.name}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.07]">
                      <span className="text-sm text-gray-400">${order.total.toFixed(2)}</span>
                      <button
                        onClick={() => handleDeliver(order.id!)}
                        disabled={delivering === order.id}
                        className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm disabled:opacity-50 transition-all active:scale-95">
                        {delivering === order.id ? '...' : '✓ Delivered'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent delivered - small */}
            {recentDelivered.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">Recently Delivered</p>
                <div className="flex flex-wrap gap-2">
                  {recentDelivered.map(order => (
                    <div key={order.id}
                      className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl opacity-50">
                      <span className="text-sm text-gray-500">#{order.orderNum}</span>
                      <span className="text-xs text-gray-600">{order.items.map(i => `${i.qty}×${i.name}`).join(', ')}</span>
                      <span className="text-xs text-green-700 font-bold">✓</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

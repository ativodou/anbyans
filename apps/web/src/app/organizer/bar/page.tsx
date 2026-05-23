'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizerEvent } from '../OrganizerEventContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import {
  getBarStations, saveBarStation, deleteBarStation,
  getBarItems, saveBarItem, deleteBarItem, updateBarItemStock,
  subscribeBarOrders, updateBarOrderStatus, getAssignedStaff,
  type BarStation, type BarItem, type BarOrder, type BarOrderStatus, type AssignedStaffMember,
} from '@/lib/db';

type Tab = 'setup' | 'live' | 'inventory' | 'stats';

const PAY_LABELS: Record<string, string> = {
  cash: '💵 Cash', card: '💳 Card', moncash: '📱 MonCash',
  natcash: '📱 Natcash', zelle: '⚡ Zelle', paypal: '🅿️ PayPal',
};

export default function OrganizerBarPage() {
  const { user } = useAuth();
  const { selectedEvent } = useOrganizerEvent();
  const [tab, setTab] = useState<Tab>('setup');

  const eventId = selectedEvent?.id ?? '';
  const organizerId = user?.uid ?? '';
  const barCode = (selectedEvent as any)?.barCode as string | undefined;
  const posActivated = !!(selectedEvent as any)?.posActivated;

  // ── Setup state ──
  const [stations, setStations] = useState<BarStation[]>([]);
  const [items, setItems] = useState<BarItem[]>([]);
  const [assignedStaff, setAssignedStaff] = useState<AssignedStaffMember[]>([]);
  const [newStation, setNewStation] = useState('');
  const [newItem, setNewItem] = useState({ name: '', price: '', stock: '', stationId: '' });
  const [editStock, setEditStock] = useState<Record<string, string>>({});
  const [savingStation, setSavingStation] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [stationError, setStationError] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);

  // ── Live state ──
  const [orders, setOrders] = useState<BarOrder[]>([]);
  const [liveStation, setLiveStation] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // ── Load setup data ──
  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      getBarStations(eventId),
      getBarItems(eventId),
      getAssignedStaff(eventId),
    ]).then(([st, it, staff]) => {
      setStations(st);
      setItems(it);
      setAssignedStaff(staff);
      if (st.length > 0 && !newItem.stationId) setNewItem(p => ({ ...p, stationId: st[0].id! }));
    });
  }, [eventId]);

  // ── Live orders subscription ──
  useEffect(() => {
    if (tab !== 'live' && tab !== 'stats' || !eventId) return;
    unsubRef.current?.();
    unsubRef.current = subscribeBarOrders(eventId, liveStation, setOrders);
    return () => { unsubRef.current?.(); };
  }, [tab, eventId, liveStation]);

  // ── Generate barCode for events activated before this update ──
  async function handleGenerateCode() {
    if (!eventId) return;
    setGeneratingCode(true);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await updateDoc(doc(db, 'events', eventId), { barCode: code });
    window.location.reload();
  }

  // ── Handlers ──
  async function handleAddStation() {
    if (!newStation.trim() || !eventId) {
      if (!eventId) setStationError('Pa gen evènman chwazi. Chwazi yon evènman anvan.');
      return;
    }
    setSavingStation(true);
    setStationError('');
    try {
      const id = await saveBarStation({ eventId, organizerId, name: newStation.trim() });
      const station = { id, eventId, organizerId, name: newStation.trim() };
      setStations(prev => [...prev, station]);
      if (!newItem.stationId) setNewItem(p => ({ ...p, stationId: id }));
      setNewStation('');
    } catch (e: any) {
      setStationError(e?.message ?? 'Erè: Nou pa ka sovgade estasyon an.');
    }
    setSavingStation(false);
  }

  async function handleDeleteStation(id: string) {
    await deleteBarStation(id);
    setStations(prev => prev.filter(s => s.id !== id));
  }

  async function handleAddItem() {
    const { name, price, stock, stationId } = newItem;
    if (!name.trim() || !price || !stationId || !eventId) return;
    setSavingItem(true);
    const station = stations.find(s => s.id === stationId);
    const id = await saveBarItem({
      eventId, organizerId, stationId, stationName: station?.name ?? '',
      name: name.trim(), price: parseFloat(price), stock: parseInt(stock) || 0, sold: 0,
    });
    setItems(prev => [...prev, {
      id, eventId, organizerId, stationId, stationName: station?.name ?? '',
      name: name.trim(), price: parseFloat(price), stock: parseInt(stock) || 0, sold: 0,
    }]);
    setNewItem(p => ({ ...p, name: '', price: '', stock: '' }));
    setSavingItem(false);
  }

  async function handleDeleteItem(id: string) {
    await deleteBarItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function handleSaveStock(itemId: string) {
    const val = parseInt(editStock[itemId]);
    if (isNaN(val)) return;
    await updateBarItemStock(itemId, val);
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, stock: val } : i));
    setEditStock(p => { const n = { ...p }; delete n[itemId]; return n; });
  }

  async function handleMarkDelivered(orderId: string) {
    await updateBarOrderStatus(orderId, 'delivered');
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o));
  }

  // ── Stats computations ──
  const completedOrders = orders.filter(o => o.status === 'delivered');
  const totalRevenue = completedOrders.reduce((a, o) => a + o.total, 0);
  const byStation = stations.map(s => ({
    name: s.name,
    revenue: completedOrders.filter(o => o.stationId === s.id).reduce((a, o) => a + o.total, 0),
    count: completedOrders.filter(o => o.stationId === s.id).length,
  }));
  const byPayment = Object.entries(PAY_LABELS).map(([key, label]) => ({
    label, revenue: completedOrders.filter(o => o.paymentMethod === key).reduce((a, o) => a + o.total, 0),
    count: completedOrders.filter(o => o.paymentMethod === key).length,
  })).filter(p => p.count > 0);
  const byStaff = Array.from(new Set(completedOrders.map(o => o.staffName))).map(name => ({
    name, revenue: completedOrders.filter(o => o.staffName === name).reduce((a, o) => a + o.total, 0),
    count: completedOrders.filter(o => o.staffName === name).length,
  })).sort((a, b) => b.revenue - a.revenue);

  const card = 'bg-dark-card border border-border rounded-xl';
  const inp = 'px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted';

  if (!selectedEvent) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl mb-3">📅</p>
      <p className="text-gray-muted text-sm">Chwazi yon evènman nan antet la.</p>
    </div>
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const staffUrl = barCode ? `${origin}/bar/${barCode}` : null;
  const displayUrl = barCode ? `${origin}/bar/${barCode}/display` : null;

  const pendingOrders = orders.filter(o => o.status === 'pending');

  return (
    <div className="max-w-3xl mx-auto">

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {([
          ['setup', '⚙️', 'Setup'],
          ['live',  '🔴', `Live${pendingOrders.length ? ` (${pendingOrders.length})` : ''}`],
          ['inventory', '📦', 'Inventè'],
          ['stats', '📊', 'Stats'],
        ] as const).map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id as Tab)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${tab === id ? 'border-orange text-orange' : 'border-transparent text-gray-muted hover:text-white'}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── SETUP TAB ── */}
      {tab === 'setup' && (
        <div className="space-y-5">

          {/* Share URLs */}
          <div className={`${card} p-4 space-y-3`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted">Lyen Pataj</p>
            {!posActivated ? (
              <div className="bg-orange/10 border border-orange/30 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">🔒</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Aktive POS pou jwenn lyen yo</p>
                  <p className="text-xs text-gray-muted mt-0.5">Ale nan <strong className="text-white">Evènman</strong> epi klike <strong className="text-white">Activate POS</strong> pou jenere lyen Staff + Vendor.</p>
                </div>
              </div>
            ) : !barCode ? (
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-muted flex-1">Pa gen kòd. Jenere youn.</p>
                <button onClick={handleGenerateCode} disabled={generatingCode}
                  className="px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 disabled:opacity-50 transition-all">
                  {generatingCode ? '...' : 'Jenere Kòd'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: '📱 Staff POS', url: staffUrl! },
                  { label: '🖥️ Vendor Display', url: displayUrl! },
                ].map(({ label, url }) => (
                  <div key={label} className="flex items-center gap-2 bg-white/[0.03] border border-border rounded-lg px-3 py-2">
                    <span className="text-[10px] font-bold text-gray-muted w-28 flex-shrink-0">{label}</span>
                    <span className="text-xs text-white font-mono flex-1 truncate">{url}</span>
                    <button onClick={() => navigator.clipboard.writeText(url)}
                      className="text-[10px] text-orange hover:underline flex-shrink-0">Kopye</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stations */}
          <div className={`${card} p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted mb-3">Estasyon Vandè</p>
            <div className="flex gap-2 mb-3">
              <input value={newStation} onChange={e => setNewStation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStation()}
                placeholder="Ex: Bar, Manje, Merch" className={`${inp} flex-1`} />
              <button onClick={handleAddStation} disabled={savingStation || !newStation.trim()}
                className="px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold disabled:opacity-40 hover:bg-orange/80 transition-all">
                {savingStation ? '...' : '➕'}
              </button>
            </div>
            {stationError && <p className="text-xs text-red-400 mb-2">{stationError}</p>}
            {stations.length === 0
              ? <p className="text-xs text-gray-muted">Pa gen estasyon ankò.</p>
              : <div className="flex flex-wrap gap-2">
                  {stations.map(s => (
                    <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-border rounded-lg">
                      <span className="text-xs font-bold">{s.name}</span>
                      <button onClick={() => handleDeleteStation(s.id!)} className="text-gray-muted hover:text-red-400 text-xs transition-colors">✕</button>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Menu items */}
          <div className={`${card} p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted mb-3">Atik Meni</p>
            {stations.length === 0
              ? <p className="text-xs text-gray-muted">Ajoute yon estasyon anvan.</p>
              : <>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <select value={newItem.stationId} onChange={e => setNewItem(p => ({ ...p, stationId: e.target.value }))}
                      className={`${inp} col-span-1`}>
                      {stations.map(s => <option key={s.id} value={s.id} className="bg-dark-card">{s.name}</option>)}
                    </select>
                    <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                      placeholder="Non *" className={`${inp} col-span-1`} />
                    <input value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))}
                      placeholder="Pri $" type="number" min="0" step="0.25" className={inp} />
                    <input value={newItem.stock} onChange={e => setNewItem(p => ({ ...p, stock: e.target.value }))}
                      placeholder="Stock" type="number" min="0" className={inp} />
                  </div>
                  <button onClick={handleAddItem} disabled={savingItem || !newItem.name.trim() || !newItem.price}
                    className="px-5 py-2 rounded-lg bg-orange text-white text-xs font-bold disabled:opacity-40 hover:bg-orange/80 transition-all">
                    {savingItem ? '...' : '➕ Ajoute Atik'}
                  </button>
                  {items.length > 0 && (
                    <div className="mt-4 space-y-1">
                      {stations.map(st => {
                        const stItems = items.filter(i => i.stationId === st.id);
                        if (!stItems.length) return null;
                        return (
                          <div key={st.id}>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-muted mt-3 mb-1">{st.name}</p>
                            {stItems.map(item => (
                              <div key={item.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                                <span className="text-xs font-bold flex-1">{item.name}</span>
                                <span className="text-xs text-orange font-bold">${item.price.toFixed(2)}</span>
                                <span className="text-[10px] text-gray-muted">Stock: {item.stock}</span>
                                <button onClick={() => handleDeleteItem(item.id!)} className="text-gray-muted hover:text-red-400 text-xs transition-colors">✕</button>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
            }
          </div>

          {/* Staff list */}
          <div className={`${card} p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted mb-3">Staff</p>
            {assignedStaff.length === 0 ? (
              <p className="text-xs text-gray-muted leading-relaxed">
                Pa gen staff asiye.{' '}
                <a href="/organizer/staff" className="text-orange underline underline-offset-2">Ale nan Staff Pool</a>{' '}
                pou asiye staff yo nan evènman sa a.
              </p>
            ) : (
              <div className="space-y-2">
                {assignedStaff.map(s => {
                  const phone = s.phone.replace(/\D/g, '');
                  const msg = staffUrl
                    ? `Salut ${s.name}! Ou ka kòmanse pran kòmand nan lyen sa a: ${staffUrl}`
                    : '';
                  return (
                    <div key={s.name} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold">{s.name}</p>
                        {s.phone && <p className="text-[10px] text-gray-muted">{s.phone}</p>}
                      </div>
                      {staffUrl && phone ? (
                        <a href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-bold transition-all">
                          WhatsApp
                        </a>
                      ) : staffUrl ? (
                        <span className="text-[10px] text-gray-muted">Pa gen nimewo</span>
                      ) : null}
                    </div>
                  );
                })}
                {!posActivated && (
                  <p className="text-[10px] text-gray-muted pt-1">Aktive POS la pou voye lyen an.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LIVE TAB ── */}
      {tab === 'live' && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setLiveStation(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${!liveStation ? 'bg-orange text-white border-orange' : 'border-border text-gray-muted hover:text-white'}`}>
              Tout
            </button>
            {stations.map(s => (
              <button key={s.id} onClick={() => setLiveStation(s.id!)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${liveStation === s.id ? 'bg-orange text-white border-orange' : 'border-border text-gray-muted hover:text-white'}`}>
                {s.name}
              </button>
            ))}
          </div>

          {orders.length === 0 ? (
            <div className={`${card} p-10 text-center`}>
              <p className="text-3xl mb-2">📋</p>
              <p className="text-gray-muted text-xs">Pa gen kòmand ankò.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map(order => (
                <div key={order.id} className={`${card} p-4 ${order.status === 'pending' ? 'border-orange/40' : 'opacity-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-heading text-lg text-orange">#{order.orderNum}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/[0.06] text-gray-light">{order.stationName}</span>
                        <span className="text-[10px] text-gray-muted">{order.staffName}</span>
                        <span className="text-[10px] text-gray-muted ml-auto">{PAY_LABELS[order.paymentMethod]}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {order.items.map((item, i) => (
                          <span key={i} className="text-[10px] bg-white/[0.04] border border-border rounded px-2 py-0.5">
                            {item.qty}× {item.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-heading text-xl">${order.total.toFixed(2)}</p>
                      {order.status === 'pending' ? (
                        <button onClick={() => handleMarkDelivered(order.id!)}
                          className="mt-1 px-3 py-1 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold transition-all">
                          ✓ Livre
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-muted">✓ Livre</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INVENTORY TAB ── */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          {stations.map(st => {
            const stItems = items.filter(i => i.stationId === st.id);
            if (!stItems.length) return null;
            return (
              <div key={st.id}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted mb-2">{st.name}</p>
                <div className={card}>
                  {stItems.map((item, idx) => {
                    const remaining = item.stock - item.sold;
                    const low = remaining <= 5 && item.stock > 0;
                    const isEditing = editStock[item.id!] !== undefined;
                    return (
                      <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${idx < stItems.length - 1 ? 'border-b border-border' : ''}`}>
                        <div className="flex-1">
                          <p className="text-sm font-bold">{item.name}</p>
                          <p className="text-xs text-orange">${item.price.toFixed(2)}</p>
                        </div>
                        <div className="text-right text-xs text-gray-muted">
                          <p>Vann: <strong className="text-white">{item.sold}</strong></p>
                          <p>Stock: <strong className="text-white">{item.stock}</strong></p>
                        </div>
                        <div className={`text-center min-w-[60px] px-2 py-1 rounded-lg text-xs font-bold ${remaining === 0 ? 'bg-red-900/30 text-red-400' : low ? 'bg-orange/20 text-orange' : 'bg-green/10 text-green'}`}>
                          {remaining} {low && remaining > 0 ? '⚠️' : ''}
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input type="number" value={editStock[item.id!]}
                              onChange={e => setEditStock(p => ({ ...p, [item.id!]: e.target.value }))}
                              className="w-16 px-2 py-1 rounded bg-white/[0.06] border border-border text-white text-xs outline-none" />
                            <button onClick={() => handleSaveStock(item.id!)} className="text-green text-xs font-bold hover:opacity-80">✓</button>
                            <button onClick={() => setEditStock(p => { const n = { ...p }; delete n[item.id!]; return n; })} className="text-gray-muted text-xs">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setEditStock(p => ({ ...p, [item.id!]: String(item.stock) }))}
                            className="text-[10px] text-gray-muted hover:text-orange transition-colors">✏️</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className={`${card} p-10 text-center`}>
              <p className="text-gray-muted text-xs">Pa gen atik. Ale nan Setup pou ajoute.</p>
            </div>
          )}
        </div>
      )}

      {/* ── STATS TAB ── */}
      {tab === 'stats' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Kòmand', value: completedOrders.length },
              { label: 'Ann Atant', value: pendingOrders.length, color: 'text-orange' },
              { label: 'Total Revni', value: `$${totalRevenue.toFixed(2)}`, color: 'text-green' },
            ].map(s => (
              <div key={s.label} className={`${card} p-4 text-center`}>
                <p className="text-[9px] uppercase tracking-widest text-gray-muted mb-1">{s.label}</p>
                <p className={`font-heading text-2xl ${s.color ?? ''}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {byStation.some(s => s.count > 0) && (
            <div className={card}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted px-4 pt-4 pb-2">Pa Estasyon</p>
              {byStation.filter(s => s.count > 0).map(s => (
                <div key={s.name} className="flex justify-between items-center px-4 py-2.5 border-t border-border">
                  <span className="text-sm font-bold">{s.name}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green">${s.revenue.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-muted">{s.count} kòmand</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {byStaff.length > 0 && (
            <div className={card}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted px-4 pt-4 pb-2">Pa Staff</p>
              {byStaff.map(s => (
                <div key={s.name} className="flex justify-between items-center px-4 py-2.5 border-t border-border">
                  <span className="text-sm font-bold">{s.name}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green">${s.revenue.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-muted">{s.count} kòmand</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {byPayment.length > 0 && (
            <div className={card}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted px-4 pt-4 pb-2">Pa Metòd Peman</p>
              {byPayment.map(p => (
                <div key={p.label} className="flex justify-between items-center px-4 py-2.5 border-t border-border">
                  <span className="text-sm font-bold">{p.label}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green">${p.revenue.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-muted">{p.count} kòmand</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

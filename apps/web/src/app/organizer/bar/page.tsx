'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizerEvent } from '../OrganizerEventContext';
import {
  getBarMenu, saveBarMenuItem, deleteBarMenuItem, recordBarSale, getBarSales,
  type BarMenuItem, type BarSale, type BarSaleItem,
} from '@/lib/db';

type Tab = 'pos' | 'menu' | 'sales';

interface CartItem extends BarSaleItem {}

const CATEGORIES = ['Bwason', 'Manje', 'Lòt'];

export default function BarPosPage() {
  const { user } = useAuth();
  const { selectedEvent } = useOrganizerEvent();

  const [tab, setTab] = useState<Tab>('pos');
  const [menu, setMenu] = useState<BarMenuItem[]>([]);
  const [sales, setSales] = useState<BarSale[]>([]);
  const [loading, setLoading] = useState(false);

  // POS state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState('');
  const [recording, setRecording] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(false);

  // Menu state
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const posActivated = !!(selectedEvent as any)?.posActivated;
  const eventId = selectedEvent?.id;
  const organizerId = user?.uid;

  useEffect(() => {
    if (!organizerId || !eventId || !posActivated) return;
    setLoading(true);
    Promise.all([
      getBarMenu(organizerId, eventId),
      getBarSales(organizerId, eventId),
    ]).then(([m, s]) => { setMenu(m); setSales(s); }).finally(() => setLoading(false));
  }, [organizerId, eventId, posActivated]);

  // ── Cart helpers ──
  function addToCart(item: BarMenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.name === item.name);
      if (existing) return prev.map(c => c.name === item.name ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { name: item.name, qty: 1, price: item.price }];
    });
    setSaleSuccess(false);
  }

  function removeFromCart(name: string) {
    setCart(prev => {
      const existing = prev.find(c => c.name === name);
      if (!existing) return prev;
      if (existing.qty === 1) return prev.filter(c => c.name !== name);
      return prev.map(c => c.name === name ? { ...c, qty: c.qty - 1 } : c);
    });
  }

  const cartTotal = cart.reduce((a, c) => a + c.qty * c.price, 0);

  async function handleRecordSale() {
    if (!organizerId || !eventId || cart.length === 0) return;
    setRecording(true);
    try {
      await recordBarSale({ organizerId, eventId, items: cart, total: cartTotal, note });
      setSales(prev => [{
        organizerId, eventId, items: cart, total: cartTotal, note, soldAt: { seconds: Date.now() / 1000 },
      }, ...prev]);
      setCart([]);
      setNote('');
      setSaleSuccess(true);
    } finally { setRecording(false); }
  }

  // ── Menu handlers ──
  async function handleAddItem() {
    if (!organizerId || !eventId || !newName.trim() || !newPrice) return;
    setSaving(true);
    try {
      const id = await saveBarMenuItem({
        organizerId, eventId,
        name: newName.trim(),
        price: parseFloat(newPrice),
        category: newCategory,
      });
      setMenu(prev => [...prev, { id, organizerId, eventId, name: newName.trim(), price: parseFloat(newPrice), category: newCategory }]);
      setNewName(''); setNewPrice('');
    } finally { setSaving(false); }
  }

  async function handleDeleteItem(itemId: string) {
    setDeleting(itemId);
    try {
      await deleteBarMenuItem(itemId);
      setMenu(prev => prev.filter(m => m.id !== itemId));
    } finally { setDeleting(null); }
  }

  // ── No event selected ──
  if (!selectedEvent) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl mb-3">📅</p>
      <p className="text-gray-muted text-sm">Chwazi yon evènman nan antet la.</p>
    </div>
  );

  // ── POS not activated ──
  if (!posActivated) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl mb-3">🍽️</p>
      <p className="text-white font-bold mb-1">POS pa aktive pou evènman sa a</p>
      <p className="text-gray-muted text-sm mb-4">Ale nan <strong>Evènman</strong> epi aktive POS pou <strong>{selectedEvent.name}</strong>.</p>
    </div>
  );

  const card = 'bg-dark-card border border-border rounded-xl';
  const inp = 'w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted';

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = menu.filter(m => m.category === cat);
    return acc;
  }, {} as Record<string, BarMenuItem[]>);

  const totalSalesRevenue = sales.reduce((a, s) => a + s.total, 0);

  return (
    <div className="max-w-2xl mx-auto">

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {([
          ['pos', '🍹', 'POS'],
          ['menu', '📋', 'Meni'],
          ['sales', '💰', 'Vant'],
        ] as const).map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${tab === id ? 'border-orange text-orange' : 'border-transparent text-gray-muted hover:text-white'}`}>
            {icon} {label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-gray-muted self-center pr-1">{selectedEvent.name}</span>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-orange border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── POS TAB ── */}
      {!loading && tab === 'pos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Item grid */}
          <div>
            {menu.length === 0 ? (
              <div className={`${card} p-8 text-center`}>
                <p className="text-3xl mb-2">📋</p>
                <p className="text-gray-muted text-xs">Pa gen atik. Ale nan <strong className="text-white">Meni</strong> pou ajoute.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {CATEGORIES.filter(cat => grouped[cat].length > 0).map(cat => (
                  <div key={cat}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted mb-2">{cat}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {grouped[cat].map(item => (
                        <button key={item.id} onClick={() => addToCart(item)}
                          className={`${card} p-3 text-left hover:border-orange/50 hover:bg-orange/5 active:scale-95 transition-all`}>
                          <p className="text-sm font-bold text-white truncate">{item.name}</p>
                          <p className="text-orange font-heading text-lg">${item.price.toFixed(2)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className={`${card} p-4 flex flex-col gap-3 h-fit sticky top-4`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted">Komand</p>

            {saleSuccess && (
              <div className="bg-green/10 border border-green/30 rounded-lg p-3 text-center">
                <p className="text-green font-bold text-sm">✓ Vant anrejistre!</p>
              </div>
            )}

            {cart.length === 0 ? (
              <p className="text-gray-muted text-xs text-center py-6">Tape yon atik pou kòmanse.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {cart.map(c => (
                    <div key={c.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeFromCart(c.name)}
                          className="w-6 h-6 rounded border border-border text-gray-muted hover:text-red-400 hover:border-red-400/50 text-xs transition-all">−</button>
                        <span className="text-xs font-bold text-white">{c.qty}×</span>
                        <span className="text-xs text-gray-light truncate max-w-[100px]">{c.name}</span>
                      </div>
                      <span className="text-xs font-bold">${(c.qty * c.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-3 flex justify-between items-center">
                  <span className="text-sm text-gray-muted">Total</span>
                  <span className="font-heading text-2xl text-white">${cartTotal.toFixed(2)}</span>
                </div>

                <input value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Nòt (opsyonèl)" className={inp} />

                <button onClick={handleRecordSale} disabled={recording}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${recording ? 'bg-white/[0.04] text-gray-muted cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
                  {recording ? '...' : `💵 Anrejistre — $${cartTotal.toFixed(2)} Kash`}
                </button>

                <button onClick={() => { setCart([]); setSaleSuccess(false); }}
                  className="text-xs text-gray-muted hover:text-red-400 transition-colors text-center bg-transparent border-none cursor-pointer">
                  Efase komand
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MENU TAB ── */}
      {!loading && tab === 'menu' && (
        <div className="space-y-4">

          {/* Add item form */}
          <div className={`${card} p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted mb-3">Ajoute Atik</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Non *" className={`${inp} col-span-1`} />
              <input value={newPrice} onChange={e => setNewPrice(e.target.value)}
                placeholder="Pri *" type="number" min="0" step="0.25" className={inp} />
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                className={`${inp} col-span-1`}>
                {CATEGORIES.map(c => <option key={c} className="bg-dark-card">{c}</option>)}
              </select>
            </div>
            <button onClick={handleAddItem} disabled={saving || !newName.trim() || !newPrice}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${saving || !newName.trim() || !newPrice ? 'bg-white/[0.04] text-gray-muted cursor-not-allowed' : 'bg-orange text-white hover:bg-orange/80'}`}>
              {saving ? '...' : '➕ Ajoute'}
            </button>
          </div>

          {/* Menu list */}
          {menu.length === 0 ? (
            <div className={`${card} p-10 text-center`}>
              <p className="text-3xl mb-2">🍹</p>
              <p className="text-gray-muted text-xs">Meni vid. Ajoute premye atik ou a.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {CATEGORIES.filter(cat => grouped[cat].length > 0).map(cat => (
                <div key={cat}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted mb-2">{cat}</p>
                  <div className={card}>
                    {grouped[cat].map((item, i) => (
                      <div key={item.id} className={`flex items-center justify-between px-4 py-3 ${i < grouped[cat].length - 1 ? 'border-b border-border' : ''}`}>
                        <div>
                          <p className="text-sm font-bold">{item.name}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-heading text-lg text-orange">${item.price.toFixed(2)}</span>
                          <button onClick={() => handleDeleteItem(item.id!)} disabled={deleting === item.id}
                            className="text-gray-muted hover:text-red-400 transition-colors text-sm disabled:opacity-40">
                            {deleting === item.id ? '...' : '✕'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SALES TAB ── */}
      {!loading && tab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={`${card} p-4`}>
              <p className="text-[9px] uppercase tracking-widest text-gray-muted mb-1">Total Vant</p>
              <p className="font-heading text-3xl">{sales.length}</p>
            </div>
            <div className={`${card} p-4`}>
              <p className="text-[9px] uppercase tracking-widest text-gray-muted mb-1">Total Revni</p>
              <p className="font-heading text-3xl text-green">${totalSalesRevenue.toFixed(2)}</p>
            </div>
          </div>

          {sales.length === 0 ? (
            <div className={`${card} p-10 text-center`}>
              <p className="text-3xl mb-2">💰</p>
              <p className="text-gray-muted text-xs">Pa gen vant ankò.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sales.map((s, i) => (
                <div key={i} className={`${card} p-4`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-wrap gap-1">
                      {s.items.map((item, j) => (
                        <span key={j} className="text-[10px] bg-white/[0.04] border border-border rounded px-2 py-0.5">
                          {item.qty}× {item.name}
                        </span>
                      ))}
                    </div>
                    <span className="font-heading text-xl text-green ml-3 flex-shrink-0">${s.total.toFixed(2)}</span>
                  </div>
                  {s.note && <p className="text-[10px] text-gray-muted">{s.note}</p>}
                  <p className="text-[10px] text-gray-muted mt-1">
                    {s.soldAt?.seconds ? new Date(s.soldAt.seconds * 1000).toLocaleTimeString() : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

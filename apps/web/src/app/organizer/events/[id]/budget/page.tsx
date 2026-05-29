'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  getEvent, getBudgetItems, addBudgetItem, deleteBudgetItem,
  BUDGET_CATEGORIES, type BudgetItem, type EventData,
} from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';

export default function BudgetPage() {
  const { id: eventId } = useParams() as { id: string };
  const { user } = useAuth();

  const [event, setEvent]     = useState<EventData | null>(null);
  const [items, setItems]     = useState<BudgetItem[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [budgetTarget, setBudgetTarget] = useState<number>(0);
  const [targetInput, setTargetInput]   = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  // Form
  const [category, setCategory] = useState<typeof BUDGET_CATEGORIES[number]>(BUDGET_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount]     = useState('');
  const [note, setNote]         = useState('');

  useEffect(() => {
    if (!eventId || !user?.uid) return;
    (async () => {
      try {
        const [ev, budgetList, tSnap] = await Promise.all([
          getEvent(eventId),
          getBudgetItems(eventId),
          getDocs(query(collection(db, 'tickets'), where('eventId', '==', eventId))),
        ]);
        setEvent(ev);
        setItems(budgetList);
        setTickets(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        const target = (ev as any)?.budgetTarget || 0;
        setBudgetTarget(target);
        setTargetInput(target > 0 ? String(target) : '');
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [eventId, user?.uid]);

  const handleAdd = async () => {
    if (!description.trim() || !amount || isNaN(Number(amount)) || !user?.uid) return;
    setSaving(true); setError('');
    try {
      const item = await addBudgetItem({
        eventId, organizerId: user.uid,
        category, description: description.trim(),
        amount: Math.round(Number(amount) * 100) / 100,
        note: note.trim() || undefined,
      });
      setItems(prev => [item, ...prev]);
      setDescription(''); setAmount(''); setNote('');
    } catch (e: any) { setError(e?.message || 'Erè'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (itemId: string) => {
    await deleteBudgetItem(itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleSaveTarget = async () => {
    const val = Math.round(Number(targetInput) * 100) / 100;
    if (isNaN(val) || val < 0) return;
    setSavingTarget(true);
    await updateDoc(doc(db, 'events', eventId), { budgetTarget: val });
    setBudgetTarget(val);
    setSavingTarget(false);
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  // ── Revenue from tickets ──
  const validTickets = tickets.filter(t => t.status === 'valid' || t.status === 'used');
  const ticketRevenue = validTickets.reduce((s: number, t: any) => s + (t.price || 0), 0);
  const barRevenue    = validTickets.reduce((s: number, t: any) => s + (t.barTabBalance || 0), 0);
  const totalRevenue  = ticketRevenue + barRevenue;

  // ── Expenses ──
  const totalExpenses = items.reduce((s, i) => s + i.amount, 0);
  const net = budgetTarget + totalRevenue - totalExpenses;

  // ── Group by category ──
  const byCategory = BUDGET_CATEGORIES
    .map(cat => ({ cat, catItems: items.filter(i => i.category === cat) }))
    .filter(({ catItems }) => catItems.length > 0);

  const card = 'bg-dark-card border border-border rounded-card';

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* Header */}
      <div>
        <Link href={`/organizer/events/${eventId}/overview`} className="inline-flex items-center gap-1 text-[11px] text-gray-muted hover:text-white mb-3 transition-colors">
          ← Overview
        </Link>
        <h2 className="font-heading text-xl tracking-wide uppercase">Bidjè</h2>
        <p className="text-xs text-gray-muted mt-1">{event?.name}</p>
      </div>

      {/* Budget target input */}
      <div className={`${card} p-4`}>
        <p className="text-[10px] uppercase tracking-widest text-gray-muted font-bold mb-2">Bidjè Kliyan / Bidjè Planifye</p>
        <div className="flex gap-2">
          <input value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="$0.00" type="number" min="0"
            className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange" />
          <button onClick={handleSaveTarget} disabled={savingTarget}
            className="px-4 py-2.5 rounded-xl bg-orange text-black font-bold text-sm disabled:opacity-40 hover:bg-orange/90 transition-all">
            {savingTarget ? '…' : 'Anrejistre'}
          </button>
        </div>
      </div>

      {/* Ledger summary — 4 cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`${card} p-4`}>
          <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1">💼 Bidjè</p>
          <p className="font-heading text-2xl text-white">${budgetTarget.toLocaleString()}</p>
          <p className="text-[10px] text-gray-muted mt-1">Montan planifye</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1">🎟 Revni Tikè</p>
          <p className="font-heading text-2xl text-green">${totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-gray-muted mt-1">{validTickets.length} tikè valid</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1">📋 Depans</p>
          <p className="font-heading text-2xl text-orange">${totalExpenses.toLocaleString()}</p>
          <p className="text-[10px] text-gray-muted mt-1">{items.length} liy</p>
        </div>
        <div className={`${card} p-4 ${net >= 0 ? 'border-green/30' : 'border-red-500/30'}`}>
          <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1">📊 Nèt</p>
          <p className={`font-heading text-2xl ${net >= 0 ? 'text-green' : 'text-red-400'}`}>
            {net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-muted mt-1">{net >= 0 ? '✓ Pozitif' : '⚠ Negatif'}</p>
        </div>
      </div>

      {/* Revenue breakdown */}
      {(ticketRevenue > 0 || barRevenue > 0) && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-gray-muted font-bold mb-2">Detay Revni Tikè (otomatik)</h3>
          <div className={card}>
            <div className="flex justify-between items-center px-4 py-3">
              <p className="text-sm">🎟 Vant Tikè</p>
              <p className="font-bold text-green">${ticketRevenue.toLocaleString()}</p>
            </div>
            {barRevenue > 0 && (
              <div className="flex justify-between items-center px-4 py-3 border-t border-border">
                <p className="text-sm">🍺 Bar Tab</p>
                <p className="font-bold text-green">${barRevenue.toLocaleString()}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Add expense */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-gray-muted font-bold mb-2">Ajoute Depans</h3>
        <div className={`${card} p-4 space-y-3`}>
          <div className="flex gap-3">
            <select value={category} onChange={e => setCategory(e.target.value as typeof category)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange">
              {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="$0.00" type="number" min="0"
              className="w-28 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange" />
          </div>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Deskripsyon *"
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange" />
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nòt (opsyonèl)"
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange" />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={handleAdd} disabled={saving || !description.trim() || !amount}
            className="w-full py-2.5 rounded-xl bg-orange text-black font-bold text-sm disabled:opacity-40 hover:bg-orange/90 transition-all">
            {saving ? '…' : '+ Ajoute Depans'}
          </button>
        </div>
      </section>

      {/* Expense list by category */}
      {byCategory.length > 0 ? (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-gray-muted font-bold mb-2">Lis Depans</h3>
          <div className="space-y-3">
            {byCategory.map(({ cat, catItems }) => {
              const catTotal = catItems.reduce((s, i) => s + i.amount, 0);
              return (
                <div key={cat} className={card}>
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-muted">{cat}</p>
                    <p className="text-xs font-bold text-orange">${catTotal.toLocaleString()}</p>
                  </div>
                  {catItems.map((item, i) => (
                    <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : 'border-t border-border'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{item.description}</p>
                        {item.note && <p className="text-[11px] text-gray-muted">{item.note}</p>}
                      </div>
                      <p className="font-bold text-sm shrink-0">${item.amount.toLocaleString()}</p>
                      <button onClick={() => handleDelete(item.id)}
                        className="text-gray-muted hover:text-red-400 text-[11px] shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Total */}
            <div className={`${card} flex justify-between items-center px-4 py-4`}>
              <p className="text-sm font-bold">Total Depans</p>
              <p className="font-heading text-xl text-orange">${totalExpenses.toLocaleString()}</p>
            </div>
          </div>
        </section>
      ) : (
        <div className={`${card} p-10 text-center`}>
          <p className="text-3xl mb-2">💰</p>
          <p className="text-gray-muted text-sm">Pa gen depans ankò. Ajoute premye depans ou a.</p>
        </div>
      )}

    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import {
  subscribePendingTickets,
  approveTicket,
  rejectTicket,
  type PendingTicket,
} from '@/lib/db';

const METHOD_LABEL: Record<string, string> = {
  moncash: 'MonCash',
  natcash: 'NatCash',
  cash:    'Kach',
  free:    'Gratis',
};

const METHOD_COLOR: Record<string, string> = {
  moncash: 'bg-orange-dim text-orange',
  natcash: 'bg-blue-900/30 text-blue-400',
  cash:    'bg-green-900/30 text-green',
};

function formatDate(ts: PendingTicket['purchasedAt'], locale: string): string {
  if (!ts) return '—';
  const d = ts.toDate();
  return d.toLocaleDateString(
    locale === 'ht' ? 'fr-HT' : locale === 'fr' ? 'fr-FR' : 'en-US',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );
}

export default function PendingTicketsPage() {
  const { user } = useAuth();
  const { t, locale } = useT();

  const [tickets, setTickets]     = useState<PendingTicket[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribePendingTickets(user.uid, setTickets);
  }, [user?.uid]);

  const ticketList = tickets.filter(tk =>
    ['pending_verification', 'pending_cash'].includes(tk.paymentStatus)
  );
  const barList = tickets.filter(tk =>
    (tk as any).barTabPaymentStatus === 'pending_cash'
  );

  async function handle(id: string, action: 'approve' | 'reject') {
    setLoadingId(id);
    try {
      if (action === 'approve') await approveTicket(id);
      else                      await rejectTicket(id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  }

  if (!user) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  const card = 'bg-dark-card border border-border rounded-card overflow-hidden';

  return (
    <div className="space-y-8">

      {/* ── Tikè an atant ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-heading text-xl tracking-wide uppercase">{t('pending_title')}</h2>
          {ticketList.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-orange-dim text-orange text-[11px] font-bold">
              {ticketList.length}
            </span>
          )}
        </div>

        {ticketList.length === 0 ? (
          <div className={`${card} p-10 text-center`}>
            <p className="text-3xl mb-2">✅</p>
            <p className="text-gray-light font-semibold text-sm">{t('pending_empty')}</p>
          </div>
        ) : (
          <div className={card}>
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  {[t('pending_col_buyer'), t('pending_col_method'), 'Txn ID', t('pending_col_price'), t('pending_col_date'), ''].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-muted ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ticketList.map(tk => (
                  <tr key={tk.id} className="border-b border-border last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[13px]">{tk.buyerName}</p>
                      <p className="text-[11px] text-gray-muted mt-0.5">
                        {tk.buyerPhone}
                        {tk.sectionName && <span className="ml-2 text-gray-muted/60">· {tk.sectionName}</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${METHOD_COLOR[tk.paymentMethod] ?? 'bg-white/[0.06] text-gray-light'}`}>
                        {METHOD_LABEL[tk.paymentMethod] ?? tk.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-muted">{tk.txnId || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-bold text-[13px]">{((tk.priceHTG ?? tk.price ?? 0)).toLocaleString()} HTG</p>
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] text-gray-muted">{formatDate(tk.purchasedAt, locale)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button disabled={loadingId === tk.id} onClick={() => handle(tk.id, 'approve')}
                          className="px-3 py-1.5 rounded-lg bg-green-900/30 text-green text-[11px] font-bold border border-green/20 hover:bg-green-900/50 disabled:opacity-40 transition-all">
                          {loadingId === tk.id ? '…' : t('pending_approve')}
                        </button>
                        <button disabled={loadingId === tk.id} onClick={() => handle(tk.id, 'reject')}
                          className="px-3 py-1.5 rounded-lg bg-red-900/30 text-red text-[11px] font-bold border border-red/20 hover:bg-red-900/50 disabled:opacity-40 transition-all">
                          {t('pending_reject')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Bar an atant ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-heading text-xl tracking-wide uppercase">🍺 Bar an Atant</h2>
          {barList.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-orange-dim text-orange text-[11px] font-bold">
              {barList.length}
            </span>
          )}
        </div>

        {barList.length === 0 ? (
          <div className={`${card} p-10 text-center`}>
            <p className="text-3xl mb-2">✅</p>
            <p className="text-gray-light font-semibold text-sm">Pa gen bar an atant</p>
          </div>
        ) : (
          <div className="space-y-3">
            {barList.map(tk => {
              const items: { name: string; qty: number; price: number; station: string }[] = (tk as any).barTabPendingPreorder || [];
              const pendingCash: number = (tk as any).barTabPendingCash || 0;
              return (
                <div key={tk.id} className={`${card} p-4`}>
                  <div className="flex items-start justify-between gap-4">
                    {/* Buyer */}
                    <div>
                      <p className="font-semibold text-[13px]">{tk.buyerName}</p>
                      <p className="text-[11px] text-gray-muted">{tk.buyerPhone}</p>
                      {tk.sectionName && <p className="text-[11px] text-gray-muted/60 mt-0.5">{tk.sectionName}</p>}
                    </div>

                    {/* Amount + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="font-heading text-lg text-orange">${pendingCash.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-muted">Cash pou kolekte</p>
                      <div className="flex gap-2">
                        <button disabled={loadingId === tk.id} onClick={() => handle(tk.id, 'approve')}
                          className="px-3 py-1.5 rounded-lg bg-green-900/30 text-green text-[11px] font-bold border border-green/20 hover:bg-green-900/50 disabled:opacity-40 transition-all">
                          {loadingId === tk.id ? '…' : 'Konfime'}
                        </button>
                        <button disabled={loadingId === tk.id} onClick={() => handle(tk.id, 'reject')}
                          className="px-3 py-1.5 rounded-lg bg-red-900/30 text-red text-[11px] font-bold border border-red/20 hover:bg-red-900/50 disabled:opacity-40 transition-all">
                          Anile
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bar items */}
                  {items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1">
                      {items.map((item, i) => (
                        <div key={i} className="flex justify-between text-[12px]">
                          <span className="text-gray-light">{item.name} <span className="text-gray-muted">×{item.qty}</span></span>
                          <span className="text-orange">${(item.price * item.qty).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}

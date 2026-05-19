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

type Filter = 'all' | 'pending_verification' | 'pending_cash';

const METHOD_LABEL: Record<string, string> = {
  moncash: 'MonCash',
  natcash: 'NatCash',
  cash:    'Kach',
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
  const [filter, setFilter]       = useState<Filter>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // ── Real-time listener ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribePendingTickets(user.uid, setTickets);
    return () => unsub();
  }, [user?.uid]);

  // ── Derived data ───────────────────────────────────────────────
  const displayed = filter === 'all'
    ? tickets
    : tickets.filter((tk) => tk.paymentStatus === filter);

  const countOf    = (s: string) => tickets.filter((tk) => tk.paymentStatus === s).length;
  const totalValue = tickets.reduce((sum, tk) => sum + (tk.priceHTG ?? tk.price ?? 0), 0);

  // ── Approve / Reject ───────────────────────────────────────────
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

  // ── Tab helper ─────────────────────────────────────────────────
  const tabCls = (f: Filter) =>
    `px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${
      filter === f
        ? 'border-orange text-orange'
        : 'border-transparent text-gray-muted hover:text-gray-light'
    }`;

  // ── Loading ────────────────────────────────────────────────────
  if (!user) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-heading text-xl tracking-wide uppercase">
          {t('pending_title')}
        </h2>
        {tickets.length > 0 && (
          <span className="px-2.5 py-0.5 rounded-full bg-orange-dim text-orange text-[11px] font-bold">
            {tickets.length}
          </span>
        )}
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-dark-card border border-border rounded-card p-4">
          <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">
            {t('pending_moncash_natcash')}
          </p>
          <p className="font-heading text-3xl tracking-wide">{countOf('pending_verification')}</p>
          <p className="text-[10px] text-gray-muted mt-1">
            {t('pending_awaiting_verify')}
          </p>
        </div>
        <div className="bg-dark-card border border-border rounded-card p-4">
          <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">
            {t('pending_cash')}
          </p>
          <p className="font-heading text-3xl tracking-wide">{countOf('pending_cash')}</p>
          <p className="text-[10px] text-gray-muted mt-1">
            {t('pending_awaiting_confirm')}
          </p>
        </div>
        <div className="bg-dark-card border border-border rounded-card p-4">
          <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">
            {t('pending_total_value')}
          </p>
          <p className="font-heading text-3xl tracking-wide text-orange">
            {totalValue.toLocaleString()} HTG
          </p>
          <p className="text-[10px] text-gray-muted mt-1">
            {t('pending')}
          </p>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex border-b border-border mb-5">
        <button className={tabCls('all')} onClick={() => setFilter('all')}>
          {t('pending_filter_all')} ({tickets.length})
        </button>
        <button className={tabCls('pending_verification')} onClick={() => setFilter('pending_verification')}>
          MonCash / NatCash ({countOf('pending_verification')})
        </button>
        <button className={tabCls('pending_cash')} onClick={() => setFilter('pending_cash')}>
          {t('pending_filter_cash')} ({countOf('pending_cash')})
        </button>
      </div>

      {/* ── Empty state ── */}
      {displayed.length === 0 ? (
        <div className="bg-dark-card border border-border rounded-card p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-light font-semibold mb-1">
            {t('pending_empty')}
          </p>
          <p className="text-gray-muted text-xs">
            {t('pending_empty_sub')}
          </p>
        </div>
      ) : (

        /* ── Table ── */
        <div className="bg-dark-card border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                {[
                  t('pending_col_buyer'),
                  t('pending_col_method'),
                  'Txn ID',
                  t('pending_col_price'),
                  t('pending_col_date'),
                  '',
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-muted ${i >= 3 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((tk) => (
                <tr
                  key={tk.id}
                  className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Buyer */}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[13px]">{tk.buyerName}</p>
                    <p className="text-[11px] text-gray-muted mt-0.5">
                      {tk.buyerPhone}
                      {tk.sectionName && <span className="ml-2 text-gray-muted/60">· {tk.sectionName}</span>}
                    </p>
                  </td>

                  {/* Method pill */}
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${METHOD_COLOR[tk.paymentMethod] ?? 'bg-white/[0.06] text-gray-light'}`}>
                      {METHOD_LABEL[tk.paymentMethod] ?? tk.paymentMethod}
                    </span>
                  </td>

                  {/* Txn ID */}
                  <td className="px-4 py-3 font-mono text-[11px] text-gray-muted">
                    {tk.txnId || '—'}
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3 text-right font-bold text-[13px]">
                    {(tk.priceHTG ?? tk.price ?? 0).toLocaleString()} HTG
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-right text-[11px] text-gray-muted">
                    {formatDate(tk.purchasedAt, locale)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        disabled={loadingId === tk.id}
                        onClick={() => handle(tk.id, 'approve')}
                        className="px-3 py-1.5 rounded-lg bg-green-900/30 text-green text-[11px] font-bold border border-green/20 hover:bg-green-900/50 disabled:opacity-40 transition-all"
                      >
                        {loadingId === tk.id ? '…' : t('pending_approve')}
                      </button>
                      <button
                        disabled={loadingId === tk.id}
                        onClick={() => handle(tk.id, 'reject')}
                        className="px-3 py-1.5 rounded-lg bg-red-900/30 text-red text-[11px] font-bold border border-red/20 hover:bg-red-900/50 disabled:opacity-40 transition-all"
                      >
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
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { purchaseTickets, type TicketData } from '../../../lib/db';
import { useT } from '../../../i18n';

// ─── Pending order shape (stored in sessionStorage before redirect) ───
interface PendingOrder {
  eventId: string;
  eventName: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  section: string;
  sectionColor: string;
  seats: string[];
  pricePerSeat: number;
  orderId: string;
}

type Status = 'verifying' | 'creating' | 'done' | 'error';

function MoncashReturnInner() {
  const { t }        = useT();
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [status,  setStatus]  = useState<Status>('verifying');
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [errMsg,  setErrMsg]  = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const transactionId = searchParams.get('transactionId') ?? '';
        const orderId       = searchParams.get('orderId')       ?? '';

        const raw = sessionStorage.getItem('moncash_pending_order');
        if (!raw) throw new Error(t('moncash_error_order'));
        const order: PendingOrder = JSON.parse(raw);

        setStatus('verifying');
        const vRes = await fetch('/api/payment/moncash/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.orderId || orderId, transactionId }),
        });
        const vData = await vRes.json();
        if (!vData.success) throw new Error(vData.error ?? t('moncash_error_payment'));

        setStatus('creating');
        const tix = await purchaseTickets(
          order.eventId,
          order.buyerName || 'Guest',
          order.buyerEmail,
          order.buyerPhone,
          order.section,
          order.sectionColor,
          order.seats,
          order.pricePerSeat,
          undefined,
          transactionId,
          'moncash',
          { paymentStatus: 'paid', txnId: transactionId },
        );

        sessionStorage.removeItem('moncash_pending_order');
        sessionStorage.setItem('moncash_tickets', JSON.stringify(tix));

        setTickets(tix);
        setStatus('done');
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : t('error_unknown'));
        setStatus('error');
      }
    };
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'verifying' || status === 'creating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-dark text-white">
        <div className="w-12 h-12 border-4 border-cyan border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-light">
          {status === 'verifying' ? t('moncash_verifying') : t('moncash_creating')}
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-dark text-white px-6">
        <div className="text-5xl">❌</div>
        <h1 className="text-xl font-bold text-center">{t('moncash_error_title')}</h1>
        <p className="text-sm text-gray-light text-center max-w-sm">{errMsg}</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-cyan text-dark font-bold rounded-xl text-sm"
        >
          {t('back')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-dark text-white px-6">
      <div className="text-5xl">🎉</div>
      <h1 className="text-2xl font-bold text-center">{t('moncash_success_title')}</h1>
      <p className="text-sm text-gray-light text-center">
        {tickets.length} {t('moncash_tickets_created')}
      </p>
      <button
        onClick={() => router.push('/tickets')}
        className="px-6 py-3 bg-cyan text-dark font-bold rounded-xl text-sm"
      >
        {t('buy_view_ticket')}
      </button>
    </div>
  );
}

export default function MoncashReturnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <div className="w-10 h-10 border-4 border-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MoncashReturnInner />
    </Suspense>
  );
}
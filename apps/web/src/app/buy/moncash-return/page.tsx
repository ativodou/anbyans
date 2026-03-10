'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { purchaseTickets } from '@/lib/db';
import type { TicketData } from '@/lib/db';

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
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [status,  setStatus]  = useState<Status>('verifying');
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [errMsg,  setErrMsg]  = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        // MonCash redirects with ?transactionId=xxx&orderId=xxx
        const transactionId = searchParams.get('transactionId') ?? '';
        const orderId       = searchParams.get('orderId')       ?? '';

        // Recover pending order from sessionStorage
        const raw = sessionStorage.getItem('moncash_pending_order');
        if (!raw) throw new Error('Enfòmasyon kòmand pa jwenn. Eseye ankò.');
        const order: PendingOrder = JSON.parse(raw);

        // 1. Verify transaction server-side
        setStatus('verifying');
        const vRes = await fetch('/api/payment/moncash/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.orderId || orderId, transactionId }),
        });
        const vData = await vRes.json();
        if (!vData.success) throw new Error(vData.error ?? 'Peman pa konfime pa MonCash.');

        // 2. Create tickets in Firestore
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
        );

        // 3. Clean up + store tickets for /tickets page
        sessionStorage.removeItem('moncash_pending_order');
        sessionStorage.setItem('moncash_tickets', JSON.stringify(tix));

        setTickets(tix);
        setStatus('done');
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : 'Erè enkoni');
        setStatus('error');
      }
    };
    run();
  }, []);

  if (status === 'verifying' || status === 'creating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-dark text-white">
        <div className="w-12 h-12 border-4 border-cyan border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-light">
          {status === 'verifying' ? 'Ap verifye peman MonCash...' : 'Ap kreye tikè ou yo...'}
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-dark text-white px-6">
        <div className="text-5xl">❌</div>
        <h1 className="text-xl font-bold text-center">Peman pa konfime</h1>
        <p className="text-sm text-gray-light text-center max-w-sm">{errMsg}</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-cyan text-dark font-bold rounded-xl text-sm"
        >
          Retounen
        </button>
      </div>
    );
  }

  // done
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-dark text-white px-6">
      <div className="text-5xl">🎉</div>
      <h1 className="text-2xl font-bold text-center">Peman Konfime!</h1>
      <p className="text-sm text-gray-light text-center">
        {tickets.length} tikè kreye pou ou.
      </p>
      <button
        onClick={() => router.push('/tickets')}
        className="px-6 py-3 bg-cyan text-dark font-bold rounded-xl text-sm"
      >
        Wè Tikè Mwen →
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

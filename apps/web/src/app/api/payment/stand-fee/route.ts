import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/payment/stand-fee
 * Body: { requestId, amount, connectedAccountId?, eventName, vendorName }
 * Returns: { clientSecret, feeRate }
 *
 * Platform cut is read from Firestore config/platform.standFeeFee (percentage integer, e.g. 10).
 * Falls back to config/platform.platformFee, then to 9.
 */
async function getPlatformStandFeeRate(): Promise<number> {
  try {
    const snap = await adminDb.get().collection('config').doc('platform').get();
    if (snap.exists) {
      const d = snap.data()!;
      const rate = d.standFeeFee ?? d.platformFee;
      if (typeof rate === 'number' && rate > 0) return rate / 100;
    }
  } catch {}
  return 0.09; // 9% default
}

export async function POST(req: NextRequest) {
  try {
    const Stripe = (await import('stripe')).default;
    const raw = process.env.STRIPE_SECRET_KEY ?? '';
    const secretKey = raw.trim();
    const stripe = new Stripe(secretKey);

    const { requestId, amount, connectedAccountId, eventName, vendorName } = await req.json();

    if (!requestId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const feeRate = await getPlatformStandFeeRate();

    const params: any = {
      amount: Math.round(amount * 100),
      currency: 'usd',
      description: `Stand fee — ${eventName} — ${vendorName}`,
      metadata: {
        requestId,
        type: 'stand_fee',
        eventName,
        vendorName,
        platform_fee_rate: `${Math.round(feeRate * 100)}%`,
      },
      automatic_payment_methods: { enabled: true },
    };

    if (connectedAccountId) {
      params.application_fee_amount = Math.round(amount * feeRate * 100);
      params.transfer_data = { destination: connectedAccountId };
    }

    const pi = await stripe.paymentIntents.create(params);
    return NextResponse.json({
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      feeRate,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

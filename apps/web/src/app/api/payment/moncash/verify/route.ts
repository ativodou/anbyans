import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SANDBOX_HOST = 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware';
const PROD_HOST    = 'https://moncashbutton.digicelgroup.com/Moncash-middleware';

function host() {
  return process.env.MONCASH_MODE === 'production' ? PROD_HOST : SANDBOX_HOST;
}

async function getToken(): Promise<string> {
  const clientId     = process.env.MONCASH_CLIENT_ID!;
  const clientSecret = process.env.MONCASH_CLIENT_SECRET!;
  const credentials  = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${host()}/oauth/token?scope=read,write&grant_type=client_credentials`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`MonCash token error ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, transactionId } = await req.json();

    const token = await getToken();

    // Try by orderId first, fallback to transactionId
    let data: any = null;

    if (orderId) {
      const res = await fetch(`${host()}/v1/RetrieveOrderPayment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ orderId: String(orderId) }),
      });
      if (res.ok) data = await res.json();
    }

    if (!data && transactionId) {
      const res = await fetch(`${host()}/v1/RetrieveTransactionPayment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ transactionId: String(transactionId) }),
      });
      if (res.ok) data = await res.json();
    }

    if (!data) throw new Error('Tranzaksyon pa jwenn');

    // data.payment: { reference, transaction_id, cost, message, payer }
    const payment = data.payment ?? data;
    const success = payment?.message === 'successful' || payment?.message === 'Transaction Successfully';

    return NextResponse.json({
      success,
      transactionId: payment?.transaction_id ?? transactionId,
      payer: payment?.payer,
      cost: payment?.cost,
      message: payment?.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erè enkoni';
    console.error('[MonCash verify]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

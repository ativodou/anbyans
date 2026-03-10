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

  const res = await fetch(`${host()}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'scope=read,write&grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MonCash token error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export async function POST(req: NextRequest) {
  try {
    const { amount, orderId } = await req.json();

    if (!amount || !orderId) {
      return NextResponse.json({ error: 'amount ak orderId obligatwa' }, { status: 400 });
    }

    const token = await getToken();

    const res = await fetch(`${host()}/v1/CreatePayment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ amount: Number(amount), orderId: String(orderId) }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MonCash CreatePayment error ${res.status}: ${text}`);
    }

    const data = await res.json();
    // data.payment_token.token  → token pou redirect
    const paymentToken = data?.payment_token?.token;
    if (!paymentToken) throw new Error('MonCash: pa jwenn payment token');

    const sandboxRedirect = process.env.MONCASH_MODE === 'production'
      ? `https://moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=${paymentToken}`
      : `https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=${paymentToken}`;

    return NextResponse.json({ redirectUrl: sandboxRedirect, paymentToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erè enkoni';
    console.error('[MonCash create]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

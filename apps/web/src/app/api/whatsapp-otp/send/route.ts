import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function genOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const { phone, inviteId } = await req.json();
    if (!phone || !inviteId) {
      return NextResponse.json({ error: 'Missing phone or inviteId' }, { status: 400 });
    }

    const otp = genOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    const db = adminDb.get();
    await db.collection('otpCodes').doc(inviteId).set({
      otp,
      phone,
      expiresAt,
      attempts: 0,
    });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const from       = process.env.TWILIO_WHATSAPP_FROM;

    if (!accountSid || !authToken || !from) {
      return NextResponse.json({ error: 'Twilio env vars not configured' }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const client = require('twilio')(accountSid, authToken);

    await client.messages.create({
      from,
      to: `whatsapp:${phone}`,
      body: `🎉 Anbyans — Kòd ou a: *${otp}*\nKòd sa a ekspire nan 10 minit.`,
    });

    return NextResponse.json({ sent: true });
  } catch (err: any) {
    console.error('[whatsapp-otp/send]', err);
    return NextResponse.json({ error: err.message || 'Erè entèn' }, { status: 500 });
  }
}

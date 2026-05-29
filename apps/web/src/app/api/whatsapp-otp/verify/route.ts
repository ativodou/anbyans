import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { inviteId, otp } = await req.json();
    if (!inviteId || !otp) {
      return NextResponse.json({ error: 'Missing inviteId or otp' }, { status: 400 });
    }

    const db = adminDb.get();
    const auth = adminAuth.get();

    const otpRef  = db.collection('otpCodes').doc(inviteId);
    const otpSnap = await otpRef.get();

    if (!otpSnap.exists) {
      return NextResponse.json({ error: 'Kòd pa jwenn. Voye ankò.' }, { status: 404 });
    }

    const data = otpSnap.data()!;

    if (data.attempts >= 5) {
      return NextResponse.json({ error: 'Twòp eseye. Voye yon nouvo kòd.' }, { status: 429 });
    }

    if (Date.now() > data.expiresAt) {
      return NextResponse.json({ error: 'Kòd ekspire. Voye ankò.' }, { status: 410 });
    }

    // Increment attempts regardless of match
    await otpRef.update({ attempts: FieldValue.increment(1) });

    if (data.otp !== String(otp)) {
      return NextResponse.json({ error: 'Kòd pa kòrèk.' }, { status: 401 });
    }

    // OTP is valid — clean up and issue custom token
    await otpRef.delete();

    const uid = `guest_${inviteId}`;

    // Fetch invitation to get guest name
    const inviteSnap = await db.collection('invitations').doc(inviteId).get();
    const invite = inviteSnap.exists ? inviteSnap.data()! : {};

    // Upsert guest user doc
    await db.collection('users').doc(uid).set(
      {
        role: 'guest',
        inviteId,
        phone: data.phone,
        name: invite.guestName ?? null,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const customToken = await auth.createCustomToken(uid);

    return NextResponse.json({ customToken });
  } catch (err: any) {
    console.error('[whatsapp-otp/verify]', err);
    return NextResponse.json({ error: err.message || 'Erè entèn' }, { status: 500 });
  }
}

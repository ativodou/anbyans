import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function genCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const { inviteId, qty } = await req.json();
    if (!inviteId || !qty || qty < 1 || qty > 3) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const db = adminDb.get();
    const inviteRef = db.collection('invitations').doc(inviteId);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const invite = inviteSnap.data()!;

    if (invite.status === 'confirmed') {
      return NextResponse.json({ error: 'Already confirmed', ticketCode: invite.ticketCode }, { status: 409 });
    }

    const maxQty = 1 + (invite.allowPlusOnes ?? 0);
    if (qty > maxQty) {
      return NextResponse.json({ error: 'Quantity exceeds allowed' }, { status: 400 });
    }

    // Load event
    const eventSnap = await db.collection('events').doc(invite.eventId).get();
    if (!eventSnap.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = eventSnap.data()!;

    // Only for free private events
    if (event.privateMode !== 'free') {
      return NextResponse.json({ error: 'Not a free event' }, { status: 400 });
    }

    const sections = event.sections || [];
    const section = sections[0] || {};
    const sectionName = section.name || 'Général';
    const sectionId = sectionName.toLowerCase().replace(/\s+/g, '-') || 'general';
    const sectionColor = section.color || '#f97316';

    const codes: string[] = [];
    const batch = db.batch();

    for (let i = 0; i < qty; i++) {
      const code = genCode();
      const ticketRef = db.collection('tickets').doc();
      batch.set(ticketRef, {
        ticketCode: code, qrData: code,
        eventId: invite.eventId,
        organizerId: event.organizerId,
        buyerName: invite.guestName,
        buyerPhone: invite.guestPhone || '',
        buyerEmail: invite.guestEmail || null,
        section: sectionId, sectionName, sectionColor,
        seat: null,
        price: 0, priceHTG: 0,
        paymentMethod: 'free', paymentStatus: 'paid',
        status: 'valid',
        purchasedAt: FieldValue.serverTimestamp(),
      });
      codes.push(code);
    }

    batch.update(inviteRef, {
      status: 'confirmed',
      ticketCode: codes[0],
      ticketCount: qty,
      confirmedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ codes });
  } catch (e: any) {
    console.error('RSVP error:', e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

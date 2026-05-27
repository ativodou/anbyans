import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function deleteDocs(db: Firestore, col: string, field: string, value: string) {
  const snap = await db.collection(col).where(field, '==', value).get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
}

export async function POST(req: NextRequest) {
  try {
    const { targetUid, targetRole, targetEmail, idToken } = await req.json();

    // Lazy-init so env vars are available at request time, not build time
    const auth = adminAuth.get();
    const db   = adminDb.get();

    // Verify caller is an admin
    const decoded = await auth.verifyIdToken(idToken);
    const callerSnap = await db.doc(`users/${decoded.uid}`).get();
    if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const del = (col: string, field: string, val: string) => deleteDocs(db, col, field, val);

    if (targetRole === 'organizer') {
      await Promise.all([
        del('events', 'organizerId', targetUid),
        del('vendors', 'organizerId', targetUid),
        del('vendorRequests', 'organizerId', targetUid),
        del('tickets', 'organizerId', targetUid),
        del('vendorPurchases', 'organizerId', targetUid),
        del('staff', 'organizerId', targetUid),
      ]);
      await db.doc(`organizers/${targetUid}`).delete().catch(() => {});
      await db.doc(`users/${targetUid}`).delete().catch(() => {});
    } else if (targetRole === 'reseller') {
      const snap = await db.collection('vendors').where('uid', '==', targetUid).get();
      const vendorIds = snap.docs.map(d => d.id);
      await Promise.all(snap.docs.map(d => d.ref.delete()));
      for (const vid of vendorIds) {
        await Promise.all([
          del('vendorRequests', 'vendorId', vid),
          del('vendorPurchases', 'vendorId', vid),
          del('tickets', 'vendorId', vid),
        ]);
      }
      await db.doc(`users/${targetUid}`).delete().catch(() => {});
    } else {
      await del('tickets', 'buyerEmail', targetEmail || '');
      await db.doc(`users/${targetUid}`).delete().catch(() => {});
    }

    await auth.deleteUser(targetUid);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('delete-user error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

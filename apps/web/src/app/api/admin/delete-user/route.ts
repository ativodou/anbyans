import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function deleteDocs(col: string, field: string, value: string) {
  const snap = await adminDb.collection(col).where(field, '==', value).get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
}

async function deleteOrganizerData(uid: string) {
  await Promise.all([
    deleteDocs('events',          'organizerId', uid),
    deleteDocs('vendors',         'organizerId', uid),
    deleteDocs('vendorRequests',  'organizerId', uid),
    deleteDocs('tickets',         'organizerId', uid),
    deleteDocs('vendorPurchases', 'organizerId', uid),
    deleteDocs('staff',           'organizerId', uid),
  ]);
  await adminDb.doc(`organizers/${uid}`).delete().catch(() => {});
  await adminDb.doc(`users/${uid}`).delete().catch(() => {});
}

async function deleteVendorData(uid: string) {
  const snap = await adminDb.collection('vendors').where('uid', '==', uid).get();
  const vendorIds = snap.docs.map(d => d.id);
  await Promise.all(snap.docs.map(d => d.ref.delete()));
  for (const vid of vendorIds) {
    await Promise.all([
      deleteDocs('vendorRequests',  'vendorId', vid),
      deleteDocs('vendorPurchases', 'vendorId', vid),
      deleteDocs('tickets',         'vendorId', vid),
    ]);
  }
  await adminDb.doc(`users/${uid}`).delete().catch(() => {});
}

async function deleteFanData(uid: string, email: string) {
  await deleteDocs('tickets', 'buyerEmail', email);
  await adminDb.doc(`users/${uid}`).delete().catch(() => {});
}

export async function POST(req: NextRequest) {
  try {
    const { targetUid, targetRole, targetEmail, idToken } = await req.json();

    // Verify caller is an admin
    const decoded = await adminAuth.verifyIdToken(idToken);
    const callerSnap = await adminDb.doc(`users/${decoded.uid}`).get();
    if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete Firestore data based on role
    if (targetRole === 'organizer') {
      await deleteOrganizerData(targetUid);
    } else if (targetRole === 'reseller') {
      await deleteVendorData(targetUid);
    } else {
      await deleteFanData(targetUid, targetEmail || '');
    }

    // Delete Firebase Auth account
    await adminAuth.deleteUser(targetUid);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('delete-user error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

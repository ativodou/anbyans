import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction,
  Timestamp,
  type Unsubscribe,
  documentId,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Event Types ─────────────────────────────────────────────────

export interface EventSection {
  name: string;
  capacity: number;
  price: number;          // fan price
  sold: number;
  color: string;
  vendorPrice?: number;       // vendor bulk price
  vendorOpenDate?: string;    // ISO date — when vendor window opens
  vendorCloseDate?: string;   // ISO date — when vendor window closes
}

export interface EventRestriction {
  dressCode: string;
  foodDrink: string;
  cameras: string;
  bags: string;
  security: string;
  accessibility: string;
  health: string;
}

export interface EventPromo {
  code: string;
  discount: number;
  type: 'percent' | 'fixed';
  maxUses: number;
  used: number;
}

export interface EventVenue {
  name: string;
  address: string;
  city: string;
  country: string;
  gps: { lat: number; lng: number };
  capacity: number;
}

export interface EventData {
  id?: string;
  name: string;
  description: string;
  category: string;
  language: string;
  ageRestriction: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: EventVenue;
  sections: EventSection[];
  restrictions: EventRestriction;
  promos: EventPromo[];
  imageUrl: string;
  status: 'draft' | 'published' | 'live' | 'ended' | 'cancelled';
  organizerId: string;
  organizerName: string;
  totalCapacity: number;
  totalSold: number;
  revenue: number;
  platformFee: number;
  isPrivate?: boolean;
  privateToken?: string;
  privateMode?: 'paid' | 'free';
  suggestedAmount?: number;
  refundPolicy?: 'no_refund' | 'timed' | 'organizer_approval';
  refundDeadlineDays?: number; // for 'timed': how many days before event
  // Payment collection numbers (organizer's MonCash/NatCash for fan payments)
  moncashPhone?: string;
  natcashPhone?: string;
  // Floor plan — prèt pou Seats.io ak Firebase Storage
  emoji?: string;
  city?: string;
  floorPlanUrl?: string;
  seatsioChartKey?: string;
  posActivated?: boolean;
  posActivatedAt?: string;
  privateActivated?: boolean;
  privateActivatedAt?: string;
  createdAt: any;
  updatedAt: any;
}

// ─── Door Staff Types ────────────────────────────────────────────

export interface DoorStaff {
  id?: string;
  staffName: string;
  phone: string;
  pin: string;
  deviceId: string | null;
  activated: boolean;
  activatedAt: any;
  disabled: boolean;
  scansCount: number;
  admittedCount: number;
  deniedCount: number;
  createdAt: any;
}

// ─── Ticket Types ────────────────────────────────────────────────

export interface TicketData {
  id?: string;
  eventId: string;
  organizerId?: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  section: string;
  sectionName?: string;
  sectionColor: string;
  seat: string;
  price: number;
  priceHTG?: number;
  ticketCode: string;
  qrData: string;
  buyerPin?: string;
  paymentIntentId?: string;  // Stripe PI id — dispute defense
  paymentMethod?: 'stripe' | 'moncash' | 'natcash' | 'cash' | 'free';
  paymentStatus?: 'paid' | 'pending_verification' | 'pending_cash';
  txnId?: string;
  buyerIp?: string;
  buyerUid?: string;
  status: 'valid' | 'used' | 'cancelled' | 'refunded' | 'pending_transfer' | 'pending';
  usedAt?: any;
  usedBy?: string;
  purchasedAt: any;
  // Bar tab fields
  barTabBalance?: number;
  barTabSpent?: number;
  barPreorder?: { name: string; qty: number; price: number }[];
  // Transfer fields
  transferToken?: string;
  transferToName?: string;
  transferToPhone?: string;
  transferExpiry?: any;
  // Vendor/reseller fields
  vendorId?: string;
  vendorName?: string;
}

// ─── Offline Ticket (for scanner download) ───────────────────────

export interface OfflineTicket {
  ticketCode: string;
  qrData: string;
  buyerName: string;
  section: string;
  sectionColor: string;
  seat: string;
  status: 'valid' | 'used';
}

// ─── Create Event ────────────────────────────────────────────────

export async function createEvent(data: Omit<EventData, 'id' | 'createdAt' | 'updatedAt' | 'totalSold' | 'revenue' | 'platformFee'>) {
  const totalCapacity = data.sections.reduce((sum, s) => sum + s.capacity, 0);
  const eventDoc = {
    ...data,
    totalCapacity,
    totalSold: 0,
    revenue: 0,
    platformFee: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'events'), eventDoc);
  return ref.id;
}

// ─── Update Event ────────────────────────────────────────────────

export async function updateEvent(eventId: string, data: Partial<EventData>) {
  await updateDoc(doc(db, 'events', eventId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ─── Get Single Event ────────────────────────────────────────────

export async function getEvent(eventId: string): Promise<EventData | null> {
  const snap = await getDoc(doc(db, 'events', eventId));
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  if (!d.name && d.title) d.name = d.title;
  if (!d.startDate && d.date) d.startDate = d.date;
  if (!d.moncashPhone && d.paymentMethods?.moncash?.active)
    d.moncashPhone = d.paymentMethods.moncash.values?.[0] || '';
  if (!d.natcashPhone && d.paymentMethods?.natcash?.active)
    d.natcashPhone = d.paymentMethods.natcash.values?.[0] || '';
  return { id: snap.id, ...d } as EventData;
}

// ─── Get All Published Events ────────────────────────────────────

export async function getPublishedEvents(): Promise<EventData[]> {
  const q = query(
    collection(db, 'events'),
    where('status', '==', 'published')
  );
  const snap = await getDocs(q);
  const events = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventData));
  events.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  return events;
}

// ─── Get Private Event by Token ──────────────────────────────────

// ─── Ticket Transfer ─────────────────────────────────────────────

export async function initiateTransfer(
  eventId: string,
  ticketId: string,
  transferToName: string,
  transferToPhone: string,
): Promise<string> {
  const transferToken = Math.random().toString(36).slice(2, 10).toUpperCase() +
                        Math.random().toString(36).slice(2, 10).toUpperCase();
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const ticketRef = doc(db, 'events', eventId, 'tickets', ticketId);
  await updateDoc(ticketRef, {
    status: 'pending_transfer',
    transferToken,
    transferToName,
    transferToPhone,
    transferExpiry: expiry,
  });

  // Also store in top-level transfers collection for easy lookup by token
  await setDoc(doc(db, 'transfers', transferToken), {
    eventId,
    ticketId,
    transferToName,
    transferToPhone,
    createdAt: new Date(),
    expiry,
    status: 'pending',
  });

  return transferToken;
}

export async function getTransferByToken(token: string): Promise<{
  eventId: string; ticketId: string; transferToName: string;
  transferToPhone: string; expiry: Date; status: string;
} | null> {
  const snap = await getDoc(doc(db, 'transfers', token));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    eventId: d.eventId,
    ticketId: d.ticketId,
    transferToName: d.transferToName,
    transferToPhone: d.transferToPhone,
    expiry: d.expiry?.toDate?.() ?? new Date(d.expiry),
    status: d.status,
  };
}

export async function acceptTransfer(token: string): Promise<void> {
  const transfer = await getTransferByToken(token);
  if (!transfer) throw new Error('Transfè pa jwenn.');
  if (transfer.status !== 'pending') throw new Error('Transfè sa deja itilize.');
  if (new Date() > transfer.expiry) throw new Error('Transfè a ekspire.');

  const ticketRef = doc(db, 'events', transfer.eventId, 'tickets', transfer.ticketId);
  const ticketSnap = await getDoc(ticketRef);
  if (!ticketSnap.exists()) throw new Error('Tikè pa jwenn.');

  const newPin = Math.floor(1000 + Math.random() * 9000).toString();

  await updateDoc(ticketRef, {
    buyerName: transfer.transferToName,
    buyerPhone: transfer.transferToPhone,
    buyerEmail: '',
    buyerPin: newPin,
    status: 'valid',
    transferToken: null,
    transferToName: null,
    transferToPhone: null,
    transferExpiry: null,
  });

  await updateDoc(doc(db, 'transfers', token), { status: 'accepted' });
}

export async function cancelTransfer(eventId: string, ticketId: string, token: string): Promise<void> {
  const ticketRef = doc(db, 'events', eventId, 'tickets', ticketId);
  await updateDoc(ticketRef, {
    status: 'valid',
    transferToken: null,
    transferToName: null,
    transferToPhone: null,
    transferExpiry: null,
  });
  await updateDoc(doc(db, 'transfers', token), { status: 'cancelled' });
}

export async function getEventByPrivateToken(token: string): Promise<EventData | null> {
  const q = query(collection(db, 'events'), where('privateToken', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as EventData;
}

// ─── Get Events by Organizer ─────────────────────────────────────

export async function getOrganizerEvents(organizerId: string): Promise<EventData[]> {
  const q = query(
    collection(db, 'events'),
    where('organizerId', '==', organizerId),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EventData));
}

// ─── Delete Event ────────────────────────────────────────────────

export async function deleteEvent(eventId: string) {
  await deleteDoc(doc(db, 'events', eventId));
}

// ═══════════════════════════════════════════════════════════════════
// DOOR STAFF MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateDeviceId(): string {
  // Create a fingerprint from browser info + random salt
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const parts = [
    nav?.userAgent || '',
    nav?.language || '',
    screen?.width || 0,
    screen?.height || 0,
    Math.random().toString(36).slice(2, 10),
    Date.now().toString(36),
  ];
  // Simple hash
  let hash = 0;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'dev-' + Math.abs(hash).toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// ─── Add Door Staff (organizer) ──────────────────────────────────

export async function addDoorStaff(eventId: string, staffName: string, phone: string = ''): Promise<DoorStaff> {
  const pin = generatePin();
  const staffData: Omit<DoorStaff, 'id'> = {
    staffName,
    phone,
    pin,
    deviceId: null,
    activated: false,
    activatedAt: null,
    disabled: false,
    scansCount: 0,
    admittedCount: 0,
    deniedCount: 0,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'events', eventId, 'doorStaff'), staffData);
  return { id: ref.id, ...staffData };
}

// ─── Get All Door Staff (organizer) ──────────────────────────────

export async function getDoorStaff(eventId: string): Promise<DoorStaff[]> {
  const snap = await getDocs(collection(db, 'events', eventId, 'doorStaff'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DoorStaff));
}

// ─── Remove Door Staff (organizer) ──────────────────────────────

export async function removeDoorStaff(eventId: string, staffId: string) {
  await deleteDoc(doc(db, 'events', eventId, 'doorStaff', staffId));
}

// ─── Disable/Enable Door Staff (organizer) ──────────────────────

export async function toggleDoorStaff(eventId: string, staffId: string, disabled: boolean) {
  await updateDoc(doc(db, 'events', eventId, 'doorStaff', staffId), { disabled });
}

// ─── Verify Door Staff PIN (locks to device) ────────────────────

export async function verifyDoorStaffPin(
  eventId: string,
  pin: string
): Promise<{ valid: boolean; waiting?: boolean; staffId?: string; staffName?: string; assignmentId?: string; role?: string; error?: string }> {
  // Get event first to check it exists and isn't over
  const event = await getEvent(eventId);
  if (!event) return { valid: false, error: 'Event not found' };

  // Check event hasn't ended (2hr grace)
  const endStr = event.endDate || event.startDate;
  const endTimeStr = event.endTime || '23:59';
  const expiry = new Date(`${endStr}T${endTimeStr}`);
  expiry.setHours(expiry.getHours() + 2);
  if (new Date() > expiry) return { valid: false, error: 'Event is over' };

  // Find assignment for this event where the pool member has this PIN
  const assignSnap = await getDocs(query(
    collection(db, 'staffAssignments'),
    where('eventId', '==', eventId),
    limit(100)
  ));
  if (assignSnap.empty) return { valid: false, error: 'Wrong PIN' };

  // For each assignment, check if the pool member's PIN matches
  let assignDoc: any = null;
  let staffName = 'Staff';
  let staffRole = 'scanner';
  for (const d of assignSnap.docs) {
    const a = d.data();
    const memberDoc = await getDoc(doc(db, 'staffPool', a.staffId));
    if (memberDoc.exists() && (memberDoc.data() as any).pin === pin) {
      assignDoc = d;
      staffName = (memberDoc.data() as any).name || 'Staff';
      staffRole = a.role || (memberDoc.data() as any).role || 'scanner';
      break;
    }
  }
  if (!assignDoc) return { valid: false, error: 'Wrong PIN' };

  const assignment = assignDoc.data();

  // Not activated yet — waiting for organizer
  if (!assignment.active) {
    return { valid: false, waiting: true, assignmentId: assignDoc.id };
  }

  // Device lock check
  const thisDeviceId = getOrCreateDeviceId();
  if (!assignment.deviceId) {
    await updateDoc(assignDoc.ref, {
      deviceId: thisDeviceId,
      activatedAt: serverTimestamp(),
    });
    return { valid: true, staffId: assignDoc.id, staffName, assignmentId: assignDoc.id, role: staffRole };
  }

  if (assignment.deviceId !== thisDeviceId) {
    return { valid: false, error: 'PIN already used on another phone' };
  }

  return { valid: true, staffId: assignDoc.id, staffName, assignmentId: assignDoc.id, role: staffRole };
}

// ─── Device ID (persists in localStorage) ────────────────────────

function getOrCreateDeviceId(): string {
  const key = 'anbyans-device-id';
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = generateDeviceId();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return generateDeviceId();
  }
}

// ─── Update Door Staff Scan Counts ──────────────────────────────

export async function updateDoorStaffStats(
  _eventId: string,
  assignmentId: string,
  admitted: boolean
) {
  // assignmentId is a staffAssignments document — that's where the scanner stores stats
  const ref = doc(db, 'staffAssignments', assignmentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  await updateDoc(ref, {
    scansCount: (data.scansCount || 0) + 1,
    admittedCount: (data.admittedCount || 0) + (admitted ? 1 : 0),
    deniedCount: (data.deniedCount || 0) + (admitted ? 0 : 1),
  });
}

// ═══════════════════════════════════════════════════════════════════
// TICKET OPERATIONS (OFFLINE SCANNER)
// ═══════════════════════════════════════════════════════════════════

// ─── Download All Tickets for Offline Scanner ────────────────────

export async function downloadEventTickets(eventId: string): Promise<OfflineTicket[]> {
  const q = query(
    collection(db, 'tickets'),
    where('eventId', '==', eventId),
    where('status', 'in', ['valid', 'used'])
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      ticketCode: data.ticketCode,
      qrData: data.qrData,
      buyerName: data.buyerName,
      section: data.section,
      sectionColor: data.sectionColor,
      seat: data.seat,
      status: data.status,
    };
  });
}

// ─── Mark Ticket Used (online) ───────────────────────────────────

export async function markTicketUsed(eventId: string, ticketCode: string, scannedBy: string): Promise<boolean> {
  const q = query(
    collection(db, 'tickets'),
    where('eventId', '==', eventId),
    where('ticketCode', '==', ticketCode),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return false;

  const ticketDoc = snap.docs[0];
  if (ticketDoc.data().status === 'used') return false;

  await updateDoc(ticketDoc.ref, {
    status: 'used',
    usedAt: serverTimestamp(),
    usedBy: scannedBy,
  });
  return true;
}

// ─── Sync Offline Scans Back to Firebase ─────────────────────────

export async function syncOfflineScans(
  eventId: string,
  usedCodes: { ticketCode: string; usedAt: string; scannedBy: string }[]
): Promise<number> {
  let synced = 0;
  for (const scan of usedCodes) {
    const q = query(
      collection(db, 'tickets'),
      where('eventId', '==', eventId),
      where('ticketCode', '==', scan.ticketCode),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty && snap.docs[0].data().status !== 'used') {
      await updateDoc(snap.docs[0].ref, {
        status: 'used',
        usedAt: Timestamp.fromDate(new Date(scan.usedAt)),
        usedBy: scan.scannedBy,
      });
      synced++;
    }
  }
  return synced;
}

// ─── Known Venues (seeded data) ──────────────────────────────────
// ─── Verify Ticket by Code (public) ─────────────────────────────

export async function verifyTicketByCode(ticketCode: string): Promise<{
  valid: boolean;
  ticket?: TicketData;
  event?: EventData;
  error?: string;
}> {
  try {
    const q = query(
      collection(db, 'tickets'),
      where('ticketCode', '==', ticketCode.trim().toUpperCase()),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return { valid: false, error: 'Ticket not found' };

    const ticketDoc = snap.docs[0];
    const ticket = { id: ticketDoc.id, ...ticketDoc.data() } as TicketData;

    // Get the parent event
    const eventId = ticket.eventId || ticketDoc.ref.parent.parent?.id;
    let event: EventData | null = null;
    if (eventId) {
      event = await getEvent(eventId);
    }

    return { valid: true, ticket, event: event || undefined };
  } catch (err) {
    console.error('Verify error:', err);
    return { valid: false, error: 'Verification failed' };
  }
}
// ─── Purchase Tickets (creates ticket docs) ──────────────────────

function generateTicketCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'ANB-';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateBuyerPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
export async function purchaseTickets(
  eventId: string,
  buyerName: string,
  buyerEmail: string,
  buyerPhone: string,
  section: string,
  sectionColor: string,
  seats: string[],
  pricePerSeat: number,
  buyerPin?: string,
  paymentIntentId?: string,
  paymentMethod?: 'stripe' | 'moncash' | 'natcash' | 'cash' | 'free',
  opts?: {
    organizerId?: string;
    sectionName?: string;
    priceHTG?: number;
    paymentStatus?: 'paid' | 'pending_verification' | 'pending_cash';
    txnId?: string;
    vendorId?: string;
    vendorName?: string;
  }
): Promise<TicketData[]> {
  // Resolve organizerId from event if not provided
  let organizerId = opts?.organizerId || '';
  if (!organizerId) {
    const ev = await getEvent(eventId);
    organizerId = (ev as any)?.organizerId || (ev as any)?.uid || '';
  }

  // Derive paymentStatus from paymentMethod if not provided
  const paymentStatus = opts?.paymentStatus || (
    paymentMethod === 'stripe' ? 'paid' :
    (paymentMethod === 'moncash' || paymentMethod === 'natcash') ? 'pending_verification' :
    paymentMethod === 'cash' ? 'pending_cash' : 'paid'
  );
  const ticketStatus = paymentStatus === 'paid' ? 'valid' : 'pending';

  // Pre-build ticket refs and docs so they can be written inside the transaction
  const resolvedPin = buyerPin || generateBuyerPin();
  const ticketEntries = seats.map(seat => {
    const ticketCode = generateTicketCode();
    const qrData = `ANB:${eventId}:${ticketCode}:${Date.now().toString(36)}`;
    const ref = doc(collection(db, 'tickets'));
    const data: Omit<TicketData, 'id'> = {
      eventId,
      organizerId,
      buyerName,
      buyerEmail,
      buyerPhone,
      section,
      sectionName: opts?.sectionName || section,
      sectionColor,
      seat,
      price: pricePerSeat,
      ...(opts?.priceHTG && { priceHTG: opts.priceHTG }),
      ticketCode,
      qrData,
      buyerPin: resolvedPin,
      status: ticketStatus,
      paymentStatus,
      paymentMethod,
      ...(paymentIntentId && { paymentIntentId }),
      ...(opts?.txnId && { txnId: opts.txnId }),
      ...(opts?.vendorId && { vendorId: opts.vendorId }),
      ...(opts?.vendorName && { vendorName: opts.vendorName }),
      purchasedAt: serverTimestamp(),
    };
    return { ref, data };
  });

  const eventRef = doc(db, 'events', eventId);

  // Atomic transaction: capacity check + ticket writes + sold counter update
  await runTransaction(db, async (txn) => {
    const eventSnap = await txn.get(eventRef);
    if (eventSnap.exists()) {
      const evData = eventSnap.data();
      const targetSec = (evData.sections || []).find((s: any) => s.name === section);
      if (targetSec) {
        const available = (targetSec.capacity || 0) - (targetSec.sold || 0);
        if (available < seats.length) throw new Error('SOLD_OUT');
      }
      const updatedSections = (evData.sections || []).map((s: any) =>
        s.name === section ? { ...s, sold: (s.sold || 0) + seats.length } : s
      );
      txn.update(eventRef, {
        totalSold: (evData.totalSold || 0) + seats.length,
        revenue: (evData.revenue || 0) + (seats.length * pricePerSeat),
        sections: updatedSections,
        updatedAt: serverTimestamp(),
      });
    }
    for (const { ref, data } of ticketEntries) {
      txn.set(ref, data);
    }
  });

  return ticketEntries.map(({ ref, data }) => ({ id: ref.id, ...data }));
}
export const KNOWN_VENUES: EventVenue[] = [
  { name: 'Karibe Hotel', address: 'Juvenat 7, Petion-Ville', city: 'Petion-Ville', country: 'Haiti', gps: { lat: 18.5135, lng: -72.2896 }, capacity: 2000 },
  { name: 'Champ de Mars', address: 'Champ de Mars, Port-au-Prince', city: 'Port-au-Prince', country: 'Haiti', gps: { lat: 18.5458, lng: -72.3387 }, capacity: 10000 },
  { name: 'Marriott Port-au-Prince', address: 'Route de Delmas, Port-au-Prince', city: 'Port-au-Prince', country: 'Haiti', gps: { lat: 18.5410, lng: -72.3300 }, capacity: 1500 },
  { name: 'Stade Sylvio Cator', address: 'Rue Oswald Durand, Port-au-Prince', city: 'Port-au-Prince', country: 'Haiti', gps: { lat: 18.5395, lng: -72.3366 }, capacity: 30000 },
  { name: 'Parc Istorik', address: 'Milot, Cap-Haitien', city: 'Cap-Haitien', country: 'Haiti', gps: { lat: 19.6050, lng: -72.2150 }, capacity: 5000 },
  { name: 'Lakay Mizik', address: 'Tabarre, Port-au-Prince', city: 'Port-au-Prince', country: 'Haiti', gps: { lat: 18.5580, lng: -72.2780 }, capacity: 800 },
  { name: 'Club Indigo', address: 'Route Nationale 1, Montrouis', city: 'Montrouis', country: 'Haiti', gps: { lat: 18.9530, lng: -72.7130 }, capacity: 1200 },
  { name: 'BAM Brooklyn', address: '30 Lafayette Ave, Brooklyn, NY', city: 'Brooklyn', country: 'USA', gps: { lat: 40.6862, lng: -73.9782 }, capacity: 2100 },
  { name: 'Barclays Center', address: '620 Atlantic Ave, Brooklyn, NY', city: 'Brooklyn', country: 'USA', gps: { lat: 40.6826, lng: -73.9754 }, capacity: 19000 },
  { name: 'Marlins Park', address: '501 Marlins Way, Miami, FL', city: 'Miami', country: 'USA', gps: { lat: 25.7781, lng: -80.2197 }, capacity: 37000 },
  { name: 'Little Haiti Cultural Center', address: '212 NE 59th Terrace, Miami, FL', city: 'Miami', country: 'USA', gps: { lat: 25.8326, lng: -80.1917 }, capacity: 500 },
  { name: 'Hard Rock Cafe Punta Cana', address: 'Blvd Turistico del Este, Punta Cana', city: 'Punta Cana', country: 'Rep. Dominiken', gps: { lat: 18.5820, lng: -68.4055 }, capacity: 1000 },
  { name: 'Place des Arts Montreal', address: '175 Rue Sainte-Catherine O, Montreal', city: 'Montreal', country: 'Canada', gps: { lat: 45.5076, lng: -73.5663 }, capacity: 3000 },
  { name: 'Zenith Paris', address: '211 Avenue Jean Jaures, Paris', city: 'Paris', country: 'France', gps: { lat: 48.8935, lng: 2.3935 }, capacity: 6300 },
];
// ═══════════════════════════════════════════════════════════════════
// RESELLER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

export interface BulkTier {
  minQty: number;
  maxQty: number | null;
  priceEach: number;
}

export interface ResellerSectionPricing {
  section: string;
  sectionColor: string;
  onlinePrice: number;
  vendorPrice: number;
  vendorOpenDate: string;
  vendorCloseDate: string;
  windowOpen: boolean;
  available: number;
  // legacy compat
  bulkTiers: BulkTier[];
  calendarTiers: never[];
  activeTier: null;
  activePrice: number | null;
}

export interface VendorPurchase {
  id?: string;
  vendorId: string;
  vendorName?: string;
  eventId: string;
  eventName: string;
  eventEmoji: string;
  eventDate: string;
  section: string;
  sectionColor: string;
  qty: number;
  priceEach: number;
  totalPaid: number;
  sold: number;
  purchaseDate: string;
  ticketCodes: string[];
  createdAt: any;
}

export interface VendorData {
  id?: string;
  uid?: string;           // Firebase Auth UID (set when reseller accepts invite)
  organizerId: string;    // which organizer invited them
  name: string;
  contact: string;
  phone: string;
  city: string;
  payMethod: string;
  payAccount: string;
  status: 'active' | 'inactive' | 'pending';
  joinedDate: string;
  inviteToken?: string;   // random token sent via WhatsApp link
  trusted?: boolean;      // admin/organizer grants credit card access
  interestedEvents?: { eventId: string; eventName: string; organizerId: string; emoji?: string }[];
  createdAt: any;
  updatedAt: any;
}

// ─── Vendor Request (free agent applies to work an event) ───────────

export interface VendorRequest {
  id?: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  vendorCity?: string;
  eventId: string;
  eventName: string;
  eventEmoji?: string;
  eventDate?: string;
  organizerId: string;
  status: 'pending' | 'approved' | 'denied';
  note?: string;
  requestedAt: any;
  resolvedAt?: any;
}

export async function requestVendorAccess(params: {
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  vendorCity?: string;
  eventId: string;
  eventName: string;
  eventEmoji?: string;
  eventDate?: string;
  organizerId: string;
}): Promise<VendorRequest> {
  // Check if request already exists
  const q = query(
    collection(db, 'vendorRequests'),
    where('vendorId', '==', params.vendorId),
    where('eventId', '==', params.eventId),
    limit(1)
  );
  const existing = await getDocs(q);
  if (!existing.empty) {
    return { id: existing.docs[0].id, ...existing.docs[0].data() } as VendorRequest;
  }
  const ref = await addDoc(collection(db, 'vendorRequests'), {
    ...params,
    status: 'pending',
    requestedAt: serverTimestamp(),
  });
  return { id: ref.id, ...params, status: 'pending', requestedAt: null };
}

export async function getVendorRequests(vendorId: string): Promise<VendorRequest[]> {
  const q = query(collection(db, 'vendorRequests'), where('vendorId', '==', vendorId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorRequest));
}

export async function getOrganizerVendorRequests(organizerId: string, status?: 'pending' | 'approved' | 'all'): Promise<VendorRequest[]> {
  const constraints: any[] = [where('organizerId', '==', organizerId)];
  if (!status || status === 'pending') constraints.push(where('status', '==', 'pending'));
  else if (status === 'approved') constraints.push(where('status', '==', 'approved'));
  const q = query(collection(db, 'vendorRequests'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorRequest))
    .sort((a, b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));
}

export async function resolveVendorRequest(
  requestId: string,
  status: 'approved' | 'denied'
): Promise<void> {
  await updateDoc(doc(db, 'vendorRequests', requestId), {
    status,
    resolvedAt: serverTimestamp(),
  });
}

// ─── Create / Invite Reseller ──────────────────────────────────────

export async function inviteVendor(data: {
  organizerId: string;
  name: string;
  contact: string;
  phone: string;
  city: string;
  payMethod: string;
  eventId?: string;
  eventName?: string;
  eventEmoji?: string;
}): Promise<VendorData> {
  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  const vendorDoc: Omit<VendorData, 'id'> = {
    organizerId: data.organizerId,
    name: data.name,
    contact: data.contact,
    phone: data.phone,
    city: data.city,
    payMethod: data.payMethod,
    payAccount: data.phone,
    status: 'pending',
    joinedDate: '—',
    inviteToken: token,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'vendors'), vendorDoc);
  if (data.eventId && data.eventName) {
    await addDoc(collection(db, 'vendorRequests'), {
      vendorId: ref.id,
      vendorName: data.name,
      vendorPhone: data.phone,
      vendorCity: data.city,
      eventId: data.eventId,
      eventName: data.eventName,
      eventEmoji: data.eventEmoji ?? '',
      organizerId: data.organizerId,
      status: 'approved',
      requestedAt: serverTimestamp(),
      resolvedAt: serverTimestamp(),
    });
  }
  return { id: ref.id, ...vendorDoc };
}

// ─── Get Resellers by Organizer ────────────────────────────────────

export async function getOrganizerVendors(organizerId: string): Promise<VendorData[]> {
  // 1. Vendors directly assigned via invite
  const q = query(collection(db, 'vendors'), where('organizerId', '==', organizerId));
  const snap = await getDocs(q);
  const byOrg = snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorData));

  // 2. Vendors who self-registered and have approved requests for this organizer's events
  const reqQ = query(
    collection(db, 'vendorRequests'),
    where('organizerId', '==', organizerId),
    where('status', '==', 'approved')
  );
  const reqSnap = await getDocs(reqQ);
  const existingIds = new Set(byOrg.map(v => v.id));
  const seen = new Set<string>();
  const missingIds: string[] = [];
  reqSnap.docs.forEach(d => {
    const id = d.data().vendorId as string;
    if (id && !existingIds.has(id) && !seen.has(id)) { seen.add(id); missingIds.push(id); }
  });

  if (missingIds.length === 0) return byOrg;

  // Batch in groups of 10 (Firestore 'in' limit)
  const extra: VendorData[] = [];
  for (let i = 0; i < missingIds.length; i += 10) {
    const batch = missingIds.slice(i, i + 10);
    const bSnap = await getDocs(query(collection(db, 'vendors'), where(documentId(), 'in', batch)));
    bSnap.docs.forEach(d => extra.push({ id: d.id, ...d.data() } as VendorData));
  }
  return [...byOrg, ...extra];
}

// ─── Get Reseller Purchases ────────────────────────────────────────

export async function getVendorPurchases(vendorId: string): Promise<VendorPurchase[]> {
  const q = query(
    collection(db, 'vendorPurchases'),
    where('vendorId', '==', vendorId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPurchase));
}

// ─── Get All Reseller Purchases for an Organizer ───────────────────

export async function getOrganizerVendorPurchases(organizerId: string): Promise<(VendorPurchase & { vendorId: string; vendorName: string })[]> {
  const q = query(
    collection(db, 'vendorPurchases'),
    where('organizerId', '==', organizerId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPurchase & { vendorId: string; vendorName: string }));
}

// ─── Bulk Purchase (reseller buys tickets upfront) ─────────────────

export async function vendorBulkPurchase(params: {
  vendorId: string;
  vendorName: string;
  organizerId: string;
  eventId: string;
  eventName: string;
  eventEmoji: string;
  eventDate: string;
  section: string;
  sectionColor: string;
  qty: number;
  priceEach: number;
  paymentMethod?: string;
}): Promise<VendorPurchase> {
  // Allow directly-invited vendors (organizerId match) OR self-registered with approved request
  const vendorSnap = await getDoc(doc(db, 'vendors', params.vendorId));
  const isDirectInvite = vendorSnap.exists() && vendorSnap.data().organizerId === params.organizerId;
  if (!isDirectInvite) {
    const reqQ = query(
      collection(db, 'vendorRequests'),
      where('vendorId', '==', params.vendorId),
      where('eventId', '==', params.eventId),
      where('status', '==', 'approved'),
      limit(1)
    );
    const reqSnap = await getDocs(reqQ);
    if (reqSnap.empty) throw new Error('Vendor not approved for this event');
  }

  const totalPaid = params.qty * params.priceEach;
  const now = new Date();
  const purchaseDate = `${now.getDate()} ${['Jan','Fev','Mas','Avr','Me','Jen','Jiy','Out','Sep','Okt','Nov','Des'][now.getMonth()]}`;

  // Generate ticket codes for each ticket in the batch
  const ticketCodes: string[] = [];
  for (let i = 0; i < params.qty; i++) {
    ticketCodes.push(generateTicketCode());
  }

  // Save reseller tickets to root tickets collection
  for (const code of ticketCodes) {
    const qrData = `ANB:${params.eventId}:${code}:${Date.now().toString(36)}`;
    await addDoc(collection(db, 'tickets'), {
      eventId: params.eventId,
      organizerId: params.organizerId,
      buyerName: `Vandè: ${params.vendorName}`,
      buyerEmail: '',
      buyerPhone: '',
      section: params.section,
      sectionName: params.section,
      sectionColor: params.sectionColor,
      seat: 'GA',
      price: params.priceEach,
      ticketCode: code,
      qrData,
      buyerPin: generateBuyerPin(),
      status: 'valid',
      paymentStatus: 'pending_verification',
      paymentMethod: params.paymentMethod ?? 'other',
      vendorId: params.vendorId,
      vendorName: params.vendorName,
      isVendorTicket: true,
      purchasedAt: serverTimestamp(),
    });
  }

  // Save purchase record
  const purchaseDoc = {
    vendorId: params.vendorId,
    vendorName: params.vendorName,
    organizerId: params.organizerId,
    eventId: params.eventId,
    eventName: params.eventName,
    eventEmoji: params.eventEmoji,
    eventDate: params.eventDate,
    section: params.section,
    sectionColor: params.sectionColor,
    qty: params.qty,
    priceEach: params.priceEach,
    totalPaid,
    sold: 0,
    purchaseDate,
    ticketCodes,
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'vendorPurchases'), purchaseDoc);

  // Update event totalSold + revenue
  const eventRef = doc(db, 'events', params.eventId);
  const eventSnap = await getDoc(eventRef);
  if (eventSnap.exists()) {
    const data = eventSnap.data();
    await updateDoc(eventRef, {
      totalSold: (data.totalSold || 0) + params.qty,
      revenue: (data.revenue || 0) + totalPaid,
      updatedAt: serverTimestamp(),
    });
  }

  return { id: ref.id, ...purchaseDoc };
}

// ─── Update Reseller Status ────────────────────────────────────────

export async function updateVendorTrusted(vendorId: string, trusted: boolean) {
  await updateDoc(doc(db, 'vendors', vendorId), { trusted, updatedAt: serverTimestamp() });
}

export async function updateVendorStatus(vendorId: string, status: 'active' | 'inactive' | 'pending') {
  await updateDoc(doc(db, 'vendors', vendorId), {
    status,
    updatedAt: serverTimestamp(),
  });
}


// ─── Get All Unassigned Vendors ──────────────────────────────────────

export async function getAllUnassignedVendors(): Promise<VendorData[]> {
  const q = query(collection(db, 'vendors'), where('organizerId', '==', ''));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorData));
}

export async function assignVendorToOrganizer(vendorId: string, organizerId: string): Promise<void> {
  await updateDoc(doc(db, 'vendors', vendorId), { organizerId, status: 'active', updatedAt: serverTimestamp() });
}

export async function removeVendorFromOrganizer(vendorId: string): Promise<void> {
  await updateDoc(doc(db, 'vendors', vendorId), { organizerId: '', updatedAt: serverTimestamp() });
}

// ─── Accept Reseller Invite (reseller side) ─────────────────────────

export async function acceptVendorInvite(token: string, uid: string): Promise<VendorData | null> {
  const q = query(
    collection(db, 'vendors'),
    where('inviteToken', '==', token),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const resellerDoc = snap.docs[0];
  const now = new Date();
  const joinedDate = `${now.getDate()} ${['Jan','Fev','Mas','Avr','Me','Jen','Jiy','Out','Sep','Okt','Nov','Des'][now.getMonth()]} ${now.getFullYear()}`;
  await updateDoc(resellerDoc.ref, {
    uid,
    status: 'active',
    joinedDate,
    updatedAt: serverTimestamp(),
  });
  return { id: resellerDoc.id, ...resellerDoc.data(), uid, status: 'active', joinedDate } as VendorData;
}

// ─── Get Bulk Pricing for an Event (from event sections) ─────────

export async function getEventBulkPricing(eventId: string): Promise<ResellerSectionPricing[]> {
  const event = await getEvent(eventId);
  if (!event) return [];
  const today = new Date().toISOString().slice(0, 10);
  return event.sections
    .filter(s => s.vendorPrice != null && s.vendorPrice > 0)
    .map(s => {
      const windowOpen = (!s.vendorOpenDate || today >= s.vendorOpenDate) &&
                         (!s.vendorCloseDate || today <= s.vendorCloseDate);
      return {
        section: s.name,
        sectionColor: s.color,
        onlinePrice: s.price,
        available: s.capacity - s.sold,
        vendorPrice: s.vendorPrice!,
        vendorOpenDate: s.vendorOpenDate ?? '',
        vendorCloseDate: s.vendorCloseDate ?? '',
        windowOpen,
        // kept for compat — not used anymore
        bulkTiers: [],
        calendarTiers: [],
        activeTier: null,
        activePrice: windowOpen ? s.vendorPrice! : null,
      };
    });
}

// ─── Save Bulk Tiers to Event Section ────────────────────────────

export async function saveEventBulkTiers(
  eventId: string,
  sectionName: string,
  tiers: BulkTier[]
) {
  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const sections = (data.sections || []).map((s: any) =>
    s.name === sectionName ? { ...s, bulkTiers: tiers } : s
  );
  await updateDoc(eventRef, { sections, updatedAt: serverTimestamp() });
}
// ─── Get Organizer Payment Methods ───────────────────────────────
export interface OrgPaymentMethod {
  key: string;
  label: string;
  icon: string;
  values: string[];
}

export async function getOrganizerPaymentMethods(organizerId: string): Promise<OrgPaymentMethod[]> {
  const snap = await getDoc(doc(db, 'organizers', organizerId));
  if (!snap.exists()) return [];
  const data = snap.data() as any;
  const pm = data.paymentMethods || {};
  const META: Record<string, { label: string; icon: string }> = {
    zelle:   { label: 'Zelle',    icon: '⚡' },
    cashapp: { label: 'Cash App', icon: '💲' },
    paypal:  { label: 'PayPal',   icon: '🅿️' },
    moncash: { label: 'MonCash',  icon: '📱' },
    natcash: { label: 'NatCash',  icon: '💚' },
  };
  return Object.entries(pm)
    .filter(([, v]: [string, any]) => v?.active && v?.values?.length > 0)
    .map(([k, v]: [string, any]) => ({
      key: k,
      label: META[k]?.label ?? k,
      icon: META[k]?.icon ?? '💳',
      values: v.values as string[],
    }));
}

// ─── Get Reseller by Firebase Auth UID ────────────────────────────

export async function getVendorByUid(uid: string): Promise<VendorData | null> {
  const q = query(collection(db, 'vendors'), where('uid', '==', uid), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as VendorData;
}

// ─── Reseller Sells a Ticket to a Customer ────────────────────────
// Assigns the next available ticket from reseller's pool to a real buyer

export async function vendorSellTicket(params: {
  purchaseId: string;
  eventId: string;
  buyerName: string;
  buyerPhone: string;
  qty: number;
}): Promise<{ codes: string[]; pin: string }> {
  const purchaseRef = doc(db, 'vendorPurchases', params.purchaseId);
  const purchaseSnap = await getDoc(purchaseRef);
  if (!purchaseSnap.exists()) throw new Error('Purchase not found');

  const purchase = purchaseSnap.data() as VendorPurchase;
  const available = purchase.qty - purchase.sold;
  if (params.qty > available) throw new Error('Not enough tickets');

  // One PIN for the fan — same for all tickets in this sale
  const buyerPin = generateBuyerPin();
  const assignedCodes = purchase.ticketCodes.slice(purchase.sold, purchase.sold + params.qty);

  for (const code of assignedCodes) {
    const ticketsQ = query(
      collection(db, 'tickets'),
      where('ticketCode', '==', code),
      limit(1)
    );
    const ticketSnap = await getDocs(ticketsQ);
    if (!ticketSnap.empty) {
      await updateDoc(ticketSnap.docs[0].ref, {
        buyerName: params.buyerName,
        buyerPhone: params.buyerPhone,
        buyerPin,
        isVendorSold: true,
        vendorSoldAt: serverTimestamp(),
        status: 'valid',
      });
    }
  }

  await updateDoc(purchaseRef, {
    sold: purchase.sold + params.qty,
    updatedAt: serverTimestamp(),
  });

  // Write sale record so the vendor sales history tab is populated
  await addDoc(collection(db, 'vendorSales'), {
    vendorId: purchase.vendorId,
    eventId: params.eventId,
    eventName: purchase.eventName,
    eventDate: purchase.eventDate,
    section: purchase.section,
    sectionColor: purchase.sectionColor,
    qty: params.qty,
    sellPriceEach: purchase.priceEach,
    costPriceEach: purchase.priceEach,
    buyerName: params.buyerName,
    buyerPhone: params.buyerPhone,
    codes: assignedCodes,
    soldAt: serverTimestamp(),
  });

  return { codes: assignedCodes, pin: buyerPin };
}

// ─── Refund Requests ─────────────────────────────────────────────────────────

export interface RefundRequest {
  id?: string;
  eventId: string;
  eventName: string;
  ticketId: string;
  ticketCode: string;
  buyerName: string;
  buyerPhone: string;
  reason: string;
  amount: number;
  section: string;
  status: 'pending' | 'approved' | 'denied';
  denialNote?: string;
  requestedAt: any;
  resolvedAt?: any;
}

export async function requestRefund(
  eventId: string,
  eventName: string,
  ticketId: string,
  ticketCode: string,
  buyerName: string,
  buyerPhone: string,
  reason: string,
  amount: number,
  section: string
): Promise<string> {
  const ref = doc(collection(db, 'refundRequests'));
  const data: RefundRequest = {
    id: ref.id, eventId, eventName, ticketId, ticketCode,
    buyerName, buyerPhone, reason, amount, section,
    status: 'pending', requestedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  await updateDoc(doc(db, 'tickets', ticketId), {
    status: 'refunded',
    refundRequestId: ref.id,
  });
  return ref.id;
}

export async function getRefundRequests(eventId: string): Promise<RefundRequest[]> {
  const q = query(collection(db, 'refundRequests'), where('eventId', '==', eventId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as RefundRequest));
}

export async function approveRefund(requestId: string, _eventId: string, ticketId: string): Promise<void> {
  await updateDoc(doc(db, 'refundRequests', requestId), {
    status: 'approved', resolvedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'tickets', ticketId), {
    status: 'refunded',
  });
}

export async function denyRefund(requestId: string, _eventId: string, ticketId: string, denialNote: string): Promise<void> {
  await updateDoc(doc(db, 'refundRequests', requestId), {
    status: 'denied', denialNote, resolvedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'tickets', ticketId), {
    status: 'used',
  });
}

// ═══════════════════════════════════════════════════════════════════
// FLOOR PLAN / EVENT LAYOUT
// ═══════════════════════════════════════════════════════════════════

export interface FloorPlanDoc {
  placeId: string;
  venueName: string;
  image: string;
  isVerified?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface EventLayoutZone {
  id: string;
  sectionId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EventLayoutDoc {
  eventId: string;
  placeId: string;
  zones: EventLayoutZone[];
  createdAt?: any;
  updatedAt?: any;
}

export async function getFloorPlan(placeId: string): Promise<FloorPlanDoc | null> {
  const snap = await getDoc(doc(db, 'floorPlans', placeId));
  if (!snap.exists()) return null;
  return { placeId: snap.id, ...snap.data() } as FloorPlanDoc;
}

export async function saveFloorPlan(
  placeId: string,
  data: { venueName: string; image: string; createdBy: string },
): Promise<void> {
  await setDoc(doc(db, 'floorPlans', placeId), {
    ...data,
    isVerified: false,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
}

export async function getEventLayout(eventId: string): Promise<EventLayoutDoc | null> {
  const snap = await getDoc(doc(db, 'eventLayouts', eventId));
  if (!snap.exists()) return null;
  return { eventId: snap.id, ...snap.data() } as EventLayoutDoc;
}

export async function saveEventLayout(
  eventId: string,
  data: { organizerId: string; placeId: string; venueName: string; zones: EventLayoutZone[] },
): Promise<void> {
  await setDoc(doc(db, 'eventLayouts', eventId), {
    ...data,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
}

export async function getOrganizerVenueLayout(
  organizerId: string,
  placeId: string,
): Promise<EventLayoutDoc | null> {
  const q = query(
    collection(db, 'eventLayouts'),
    where('organizerId', '==', organizerId),
    where('placeId', '==', placeId),
    orderBy('updatedAt', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { eventId: d.id, ...d.data() } as EventLayoutDoc;
}

// ═══════════════════════════════════════════════════════════════════
// VENUE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

export interface VenueSection {
  name: string;
  color: string;
  capacity: number;
}

export interface VenueData {
  id?: string;
  name: string;
  address: string;
  city: string;
  country: string;
  gps: { lat: number; lng: number };
  capacity: number;
  photos?: string[];
  floorPlanUrl?: string;
  contact?: { phone?: string; email?: string; website?: string };
  amenities?: string[];
  sections?: VenueSection[];
  isVerified?: boolean;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export async function getVenues(): Promise<VenueData[]> {
  const snap = await getDocs(collection(db, 'venues'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VenueData));
}

export async function getVenue(venueId: string): Promise<VenueData | null> {
  const snap = await getDoc(doc(db, 'venues', venueId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as VenueData;
}

export async function createVenue(data: Omit<VenueData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'venues'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateVenue(venueId: string, data: Partial<VenueData>): Promise<void> {
  await updateDoc(doc(db, 'venues', venueId), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteVenue(venueId: string): Promise<void> {
  await deleteDoc(doc(db, 'venues', venueId));
}

// Seed known venues into Firestore (run once from admin)
export async function seedKnownVenues(): Promise<number> {
  const SEED_VENUES: Omit<VenueData, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: 'Karibe Hotel', address: 'Juvenat 7, Petion-Ville', city: 'Petion-Ville', country: 'Haiti',
      gps: { lat: 18.5135, lng: -72.2896 }, capacity: 2000,
      amenities: ['Parking', 'AC', 'Bar', 'Sekirite', 'Espace VIP'],
      isVerified: true,
      sections: [
        { name: 'VIP', color: '#f97316', capacity: 200 },
        { name: 'Jeneral', color: '#06b6d4', capacity: 1800 },
      ],
    },
    {
      name: 'Champ de Mars', address: 'Champ de Mars, Port-au-Prince', city: 'Port-au-Prince', country: 'Haiti',
      gps: { lat: 18.5458, lng: -72.3387 }, capacity: 10000,
      amenities: ['Espas Ouvè', 'Gwo Kapasité'],
      isVerified: true,
    },
    {
      name: 'Marriott Port-au-Prince', address: 'Route de Delmas, Port-au-Prince', city: 'Port-au-Prince', country: 'Haiti',
      gps: { lat: 18.5410, lng: -72.3300 }, capacity: 1500,
      amenities: ['Parking', 'AC', 'Bar', 'Wifi', 'Sekirite', 'Espace VIP'],
      isVerified: true,
      sections: [
        { name: 'VIP', color: '#f97316', capacity: 150 },
        { name: 'Jeneral', color: '#22c55e', capacity: 1350 },
      ],
    },
    {
      name: 'Stade Sylvio Cator', address: 'Rue Oswald Durand, Port-au-Prince', city: 'Port-au-Prince', country: 'Haiti',
      gps: { lat: 18.5395, lng: -72.3366 }, capacity: 30000,
      amenities: ['Espas Ouvè', 'Gwo Kapasité', 'Sekirite'],
      isVerified: true,
    },
    {
      name: 'Club Indigo', address: 'Route Nationale 1, Montrouis', city: 'Montrouis', country: 'Haiti',
      gps: { lat: 18.9530, lng: -72.7130 }, capacity: 1200,
      amenities: ['Plaj', 'Pisinn', 'Bar', 'AC', 'Parking', 'Espace VIP'],
      isVerified: true,
    },
    {
      name: 'Parc Istorik La Citadelle', address: 'Milot, Cap-Haitien', city: 'Cap-Haitien', country: 'Haiti',
      gps: { lat: 19.6050, lng: -72.2150 }, capacity: 5000,
      amenities: ['Espas Ouvè', 'Istwa'],
      isVerified: true,
    },
    {
      name: 'Lakay Mizik', address: 'Tabarre, Port-au-Prince', city: 'Port-au-Prince', country: 'Haiti',
      gps: { lat: 18.5580, lng: -72.2780 }, capacity: 800,
      amenities: ['AC', 'Bar', 'Parking', 'Sono'],
      isVerified: true,
    },
    {
      name: 'Little Haiti Cultural Center', address: '212 NE 59th Terrace, Miami, FL', city: 'Miami', country: 'USA',
      gps: { lat: 25.8326, lng: -80.1917 }, capacity: 500,
      amenities: ['AC', 'Parking', 'Sono', 'Wifi'],
      isVerified: true,
    },
    {
      name: 'Marlins Park', address: '501 Marlins Way, Miami, FL', city: 'Miami', country: 'USA',
      gps: { lat: 25.7781, lng: -80.2197 }, capacity: 37000,
      amenities: ['Parking', 'AC', 'Bar', 'Gwo Kapasité'],
      isVerified: true,
    },
    {
      name: 'BAM Brooklyn', address: '30 Lafayette Ave, Brooklyn, NY', city: 'Brooklyn', country: 'USA',
      gps: { lat: 40.6862, lng: -73.9782 }, capacity: 2100,
      amenities: ['AC', 'Bar', 'Sekirite'],
      isVerified: true,
    },
    {
      name: 'Place des Arts Montreal', address: '175 Rue Sainte-Catherine O, Montreal', city: 'Montreal', country: 'Canada',
      gps: { lat: 45.5076, lng: -73.5663 }, capacity: 3000,
      amenities: ['AC', 'Bar', 'Parking', 'Sekirite'],
      isVerified: true,
    },
    {
      name: 'Zenith Paris', address: '211 Avenue Jean Jaures, Paris', city: 'Paris', country: 'France',
      gps: { lat: 48.8935, lng: 2.3935 }, capacity: 6300,
      amenities: ['AC', 'Bar', 'Sekirite', 'Espace VIP'],
      isVerified: true,
    },
    {
      name: 'Hard Rock Cafe Punta Cana', address: 'Blvd Turistico del Este, Punta Cana', city: 'Punta Cana', country: 'Rep. Dominiken',
      gps: { lat: 18.5820, lng: -68.4055 }, capacity: 1000,
      amenities: ['Plaj', 'Bar', 'AC', 'Parking'],
      isVerified: true,
    },
    // Haiti
    {
      name: 'Hotel Montana', address: 'Rue F. Cardozo, Petion-Ville', city: 'Petion-Ville', country: 'Haiti',
      gps: { lat: 18.5190, lng: -72.2950 }, capacity: 600,
      amenities: ['Parking', 'AC', 'Bar', 'Piscine', 'Espace VIP', 'Wifi', 'Sekirite'],
      isVerified: true,
      sections: [{ name: 'VIP', color: '#f97316', capacity: 100 }, { name: 'Jeneral', color: '#06b6d4', capacity: 500 }],
    },
    {
      name: 'Petionville Club', address: 'Rue Pan Americaine, Petion-Ville', city: 'Petion-Ville', country: 'Haiti',
      gps: { lat: 18.5085, lng: -72.2870 }, capacity: 1500,
      amenities: ['Parking', 'AC', 'Bar', 'Piscine', 'Sekirite', 'Espace VIP'],
      isVerified: true,
      sections: [{ name: 'VIP', color: '#f97316', capacity: 200 }, { name: 'Jeneral', color: '#22c55e', capacity: 1300 }],
    },
    {
      name: 'Oasis', address: 'Route de l\'Aéroport, Cap-Haïtien', city: 'Cap-Haïtien', country: 'Haiti',
      gps: { lat: 19.7580, lng: -72.2010 }, capacity: 800,
      amenities: ['Parking', 'AC', 'Bar', 'Sono', 'Sekirite'],
      isVerified: true,
    },
    {
      name: 'Ibo Lele', address: 'Kenscoff Road, Petion-Ville', city: 'Petion-Ville', country: 'Haiti',
      gps: { lat: 18.5070, lng: -72.2780 }, capacity: 500,
      amenities: ['Parking', 'AC', 'Bar', 'Vue Montay', 'Sekirite'],
      isVerified: true,
    },
    {
      name: 'Wahoo Bay Beach', address: 'Route Nationale 1, Arcahaie', city: 'Arcahaie', country: 'Haiti',
      gps: { lat: 18.7680, lng: -72.5480 }, capacity: 2000,
      amenities: ['Plaj', 'Piscine', 'Bar', 'Parking', 'Sekirite'],
      isVerified: true,
    },
    {
      name: 'Centre de Convention de Pétion-Ville', address: 'Delmas 75, Petion-Ville', city: 'Petion-Ville', country: 'Haiti',
      gps: { lat: 18.5320, lng: -72.3050 }, capacity: 3000,
      amenities: ['Parking', 'AC', 'Bar', 'Sekirite', 'Espace VIP', 'Sono'],
      isVerified: true,
      sections: [{ name: 'VIP', color: '#f97316', capacity: 400 }, { name: 'Jeneral', color: '#06b6d4', capacity: 2600 }],
    },
    // USA — diaspora
    {
      name: 'Bell Works', address: '101 Crawfords Corner Rd, Holmdel, NJ', city: 'Holmdel', country: 'USA',
      gps: { lat: 40.3615, lng: -74.1860 }, capacity: 5000,
      amenities: ['Parking', 'AC', 'Bar', 'Sekirite'],
      isVerified: true,
    },
    {
      name: 'Citi Field', address: '41 Seaver Way, Queens, NY', city: 'New York', country: 'USA',
      gps: { lat: 40.7571, lng: -73.8458 }, capacity: 41800,
      amenities: ['Parking', 'AC', 'Bar', 'Gwo Kapasité', 'Sekirite'],
      isVerified: true,
    },
    {
      name: 'Pier 36', address: '299 South St, New York, NY', city: 'New York', country: 'USA',
      gps: { lat: 40.7122, lng: -74.0010 }, capacity: 3000,
      amenities: ['AC', 'Bar', 'Sekirite', 'Vue Dlo'],
      isVerified: true,
    },
    {
      name: 'Hynes Convention Center', address: '900 Boylston St, Boston, MA', city: 'Boston', country: 'USA',
      gps: { lat: 42.3484, lng: -71.0862 }, capacity: 20000,
      amenities: ['Parking', 'AC', 'Wifi', 'Sekirite'],
      isVerified: true,
    },
    {
      name: 'Hard Rock Live Orlando', address: '6050 Universal Blvd, Orlando, FL', city: 'Orlando', country: 'USA',
      gps: { lat: 28.4742, lng: -81.4680 }, capacity: 3000,
      amenities: ['Parking', 'AC', 'Bar', 'Sekirite', 'Espace VIP'],
      isVerified: true,
    },
    // Canada
    {
      name: 'Salle Claude-Champagne', address: '220 Vincent-d\'Indy Ave, Montreal', city: 'Montreal', country: 'Canada',
      gps: { lat: 45.5130, lng: -73.6180 }, capacity: 900,
      amenities: ['AC', 'Parking', 'Sekirite'],
      isVerified: true,
    },
    // France
    {
      name: 'La Cigale', address: '120 Boulevard de Rochechouart, Paris', city: 'Paris', country: 'France',
      gps: { lat: 48.8843, lng: 2.3402 }, capacity: 1500,
      amenities: ['AC', 'Bar', 'Sekirite'],
      isVerified: true,
    },
  ];

  let count = 0;
  for (const v of SEED_VENUES) {
    await addDoc(collection(db, 'venues'), { ...v, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    count++;
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════════
// PENDING TICKET APPROVAL  (Tikè ann atant)
// ═══════════════════════════════════════════════════════════════════

export interface PendingTicket {
  id: string;
  ticketCode: string;
  eventId: string;
  organizerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string | null;
  paymentMethod: 'moncash' | 'natcash' | 'cash' | string;
  paymentStatus: 'pending_verification' | 'pending_cash' | string;
  txnId?: string | null;
  status: string;
  price: number;
  priceHTG?: number;
  sectionName?: string;
  sectionColor?: string;
  purchasedAt: Timestamp | null;
}

/** Real-time listener — returns all pending tickets for an organizer */
export function subscribePendingTickets(
  organizerId: string,
  callback: (tickets: PendingTicket[]) => void,
): Unsubscribe {
  const sort = (tickets: PendingTicket[]) =>
    tickets.sort((a, b) => {
      const at = (a.purchasedAt as Timestamp | null)?.toMillis() ?? 0;
      const bt = (b.purchasedAt as Timestamp | null)?.toMillis() ?? 0;
      return bt - at;
    });

  const cache: { payment: PendingTicket[]; barTab: PendingTicket[] } = { payment: [], barTab: [] };
  const emit = () => {
    const seen = new Set<string>();
    const merged: PendingTicket[] = [];
    [...cache.payment, ...cache.barTab].forEach(t => { if (!seen.has(t.id)) { seen.add(t.id); merged.push(t); } });
    callback(sort(merged));
  };

  const q1 = query(collection(db, 'tickets'), where('organizerId', '==', organizerId), where('paymentStatus', 'in', ['pending_verification', 'pending_cash']));
  const q2 = query(collection(db, 'tickets'), where('organizerId', '==', organizerId), where('barTabPaymentStatus', '==', 'pending_cash'));

  const unsub1 = onSnapshot(q1, snap => { cache.payment = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PendingTicket, 'id'>) })); emit(); });
  const unsub2 = onSnapshot(q2, snap => { cache.barTab = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PendingTicket, 'id'>) })); emit(); });

  return () => { unsub1(); unsub2(); };
}

/** Approve: set status=valid, paymentStatus=paid, credit any pending bar tab cash */
export async function approveTicket(ticketId: string): Promise<void> {
  const snap = await getDoc(doc(db, 'tickets', ticketId));
  const data = snap.data() || {};
  const pendingCash = data.barTabPendingCash || 0;
  const pendingItems = data.barTabPendingPreorder || [];
  const existingPreorder = data.barPreorder || [];
  await updateDoc(doc(db, 'tickets', ticketId), {
    status: 'valid',
    paymentStatus: 'paid',
    approvedAt: serverTimestamp(),
    ...(pendingCash > 0 ? {
      barTabBalance: (data.barTabBalance || 0) + pendingCash,
      barTabPendingCash: 0,
      barTabPaymentStatus: 'paid',
      barPreorder: [...existingPreorder, ...pendingItems],
      barTabPendingPreorder: [],
    } : {}),
  });
}

/** Reject: set status=cancelled */
export async function rejectTicket(ticketId: string): Promise<void> {
  await updateDoc(doc(db, 'tickets', ticketId), {
    status: 'cancelled',
    paymentStatus: 'cancelled',
    cancelledAt: serverTimestamp(),
  });
}

// ─── Photo / Logo ─────────────────────────────────────────────────────────────

/** Save a compressed base64 photo for fans & vendors (users collection) */
export async function updateUserPhoto(uid: string, base64: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { photoURL: base64, updatedAt: serverTimestamp() });
}

/** Update editable profile fields for fans/vendors */
export async function updateUserProfile(uid: string, fields: { firstName: string; lastName: string; phone: string; city: string }): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { ...fields, updatedAt: serverTimestamp() });
}

/** Save a compressed base64 logo for organizers (organizers collection) */
export async function updateOrganizerLogo(uid: string, base64: string): Promise<void> {
  await setDoc(doc(db, 'organizers', uid), { uid, logoURL: base64, updatedAt: serverTimestamp() }, { merge: true });
}

/** Get photoURL for a user (fans/vendors) */
export async function getUserPhoto(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data().photoURL ?? null) : null;
}

/** Get logoURL for an organizer */
export async function getOrganizerLogo(uid: string): Promise<string | null> {
  // Try direct doc lookup first (doc ID = uid, used by settings save)
  const snap = await getDoc(doc(db, 'organizers', uid));
  if (snap.exists() && snap.data().logoURL) return snap.data().logoURL;
  // Fallback: query by uid field (legacy docs with auto-generated ID)
  const q = query(collection(db, 'organizers'), where('uid', '==', uid));
  const qSnap = await getDocs(q);
  if (!qSnap.empty && qSnap.docs[0].data().logoURL) return qSnap.docs[0].data().logoURL;
  return null;
}

// ─── Event Status Management ──────────────────────────────────────────────────

/** Manually mark an event as ended */
export async function markEventEnded(eventId: string): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), {
    status: 'ended',
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Reopen an ended event back to published */
export async function markEventPublished(eventId: string): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), {
    status: 'published',
    endedAt: null,
    updatedAt: serverTimestamp(),
  });
}

/** Mark event as live (doors open) */
export async function markEventLive(eventId: string): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), {
    status: 'live',
    liveAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Auto-update event status based on date/time.
 * Call this when loading events on any page.
 * Only writes to Firestore if status needs to change — no unnecessary writes.
 */
export async function autoUpdateEventStatus(event: EventData): Promise<EventData> {
  if (event.status === 'cancelled' || event.status === 'ended') return event;
  if (event.status === 'draft') return event;

  const endStr     = event.endDate  || event.startDate;
  const endTimeStr = event.endTime  || '23:59';
  const startStr   = event.startDate;
  const startTimeStr = event.startTime || '00:00';

  if (!endStr) return event;

  const now       = new Date();
  const endDt     = new Date(`${endStr}T${endTimeStr}`);
  const startDt   = new Date(`${startStr}T${startTimeStr}`);

  // Past end time → ended
  if (now > endDt) {
    await updateDoc(doc(db, 'events', event.id!), {
      status: 'ended',
      endedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ...event, status: 'ended' };
  }

  // Within event window (started but not ended) → live
  if (now >= startDt && now <= endDt && event.status === 'published') {
    await updateDoc(doc(db, 'events', event.id!), {
      status: 'live',
      liveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ...event, status: 'live' };
  }

  return event;
}

/**
 * Run autoUpdateEventStatus on a list of events.
 * Returns the updated list.
 */
export async function autoUpdateAllEventStatuses(events: EventData[]): Promise<EventData[]> {
  return Promise.all(events.map(e => autoUpdateEventStatus(e)));
}

// ═══════════════════════════════════════════════════════════════════
// BAR POS
// ═══════════════════════════════════════════════════════════════════

export interface BarStation {
  id?: string;
  eventId: string;
  organizerId: string;
  name: string;
  sections?: string[]; // ticket section names that can access this station; empty/missing = all
}

export interface BarItem {
  id?: string;
  eventId: string;
  organizerId: string;
  stationId: string;
  stationName: string;
  name: string;
  price: number;
  stock: number;
  sold: number;
  sections?: string[]; // ticket section names that can order this; empty/missing = all sections
}

export interface BarOrderItem {
  itemId: string;
  name: string;
  qty: number;
  price: number;
}

export type BarPaymentMethod = 'cash' | 'card' | 'moncash' | 'natcash' | 'zelle' | 'paypal';
export type BarOrderStatus = 'pending' | 'delivered';

export interface BarOrder {
  id?: string;
  eventId: string;
  organizerId: string;
  stationId: string;
  stationName: string;
  staffName: string;
  items: BarOrderItem[];
  total: number;
  paymentMethod: BarPaymentMethod;
  status: BarOrderStatus;
  orderNum: number;
  createdAt: any;
}

export interface BarConfig {
  staffNames: string[];
}

export async function getBarStations(eventId: string): Promise<BarStation[]> {
  const q = query(collection(db, 'barStations'), where('eventId', '==', eventId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BarStation));
}

export async function updateBarStationSections(stationId: string, sections: string[]): Promise<void> {
  await updateDoc(doc(db, 'barStations', stationId), { sections });
}

export async function saveBarStation(station: Omit<BarStation, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'barStations'), station);
  return ref.id;
}

export async function deleteBarStation(stationId: string): Promise<void> {
  await deleteDoc(doc(db, 'barStations', stationId));
}

export async function getBarItems(eventId: string, stationId?: string): Promise<BarItem[]> {
  const q = stationId
    ? query(collection(db, 'barItems'), where('eventId', '==', eventId), where('stationId', '==', stationId))
    : query(collection(db, 'barItems'), where('eventId', '==', eventId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BarItem));
}

export async function saveBarItem(item: Omit<BarItem, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'barItems'), item);
  return ref.id;
}

export async function deleteBarItem(itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'barItems', itemId));
}

export async function updateBarItemStock(itemId: string, stock: number): Promise<void> {
  await updateDoc(doc(db, 'barItems', itemId), { stock });
}

export async function placeBarOrder(
  order: Omit<BarOrder, 'id' | 'createdAt' | 'orderNum'>,
): Promise<{ id: string; orderNum: number }> {
  const orderNum = Math.floor(Date.now() / 1000) % 10000;
  await Promise.all(
    order.items.map(item =>
      updateDoc(doc(db, 'barItems', item.itemId), { sold: increment(item.qty) }),
    ),
  );
  const ref = await addDoc(collection(db, 'barOrders'), {
    ...order, orderNum, createdAt: serverTimestamp(),
  });
  return { id: ref.id, orderNum };
}

export function subscribeBarOrders(
  eventId: string,
  stationId: string | null,
  callback: (orders: BarOrder[]) => void,
): Unsubscribe {
  const q = stationId
    ? query(collection(db, 'barOrders'), where('eventId', '==', eventId), where('stationId', '==', stationId))
    : query(collection(db, 'barOrders'), where('eventId', '==', eventId));
  return onSnapshot(q, snap => {
    const orders = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as BarOrder))
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    callback(orders);
  });
}

export async function updateBarOrderStatus(orderId: string, status: BarOrderStatus): Promise<void> {
  await updateDoc(doc(db, 'barOrders', orderId), { status });
}

export async function getBarOrders(eventId: string): Promise<BarOrder[]> {
  const q = query(collection(db, 'barOrders'), where('eventId', '==', eventId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as BarOrder))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function getBarConfig(eventId: string): Promise<BarConfig> {
  const snap = await getDoc(doc(db, 'barConfig', eventId));
  if (snap.exists()) return snap.data() as BarConfig;
  return { staffNames: [] };
}

export async function saveBarConfig(eventId: string, config: Partial<BarConfig>): Promise<void> {
  await setDoc(doc(db, 'barConfig', eventId), config, { merge: true });
}

// Returns names of staff assigned to an event from staffPool/staffAssignments.
// Falls back to barConfig.staffNames for events that haven't used staffPool yet.
export async function getBarStaffNames(eventId: string): Promise<string[]> {
  const assignSnap = await getDocs(
    query(collection(db, 'staffAssignments'), where('eventId', '==', eventId), where('active', '==', true))
  );
  if (!assignSnap.empty) {
    const names = await Promise.all(
      assignSnap.docs.map(async d => {
        const staffId = (d.data() as any).staffId;
        const memberSnap = await getDoc(doc(db, 'staffPool', staffId));
        return memberSnap.exists() ? ((memberSnap.data() as any).name as string) : null;
      })
    );
    const filtered = names.filter(Boolean) as string[];
    if (filtered.length > 0) return filtered;
  }
  // Fallback: manually-entered names in barConfig
  const cfg = await getBarConfig(eventId);
  return cfg.staffNames ?? [];
}

export interface AssignedStaffMember { name: string; phone: string; }

export async function getAssignedStaff(eventId: string): Promise<AssignedStaffMember[]> {
  const assignSnap = await getDocs(
    query(collection(db, 'staffAssignments'), where('eventId', '==', eventId), where('active', '==', true))
  );
  if (assignSnap.empty) return [];
  const members = await Promise.all(
    assignSnap.docs.map(async d => {
      const memberSnap = await getDoc(doc(db, 'staffPool', (d.data() as any).staffId));
      if (!memberSnap.exists()) return null;
      const data = memberSnap.data() as any;
      return { name: data.name as string, phone: (data.phone ?? '') as string };
    })
  );
  return members.filter(Boolean) as AssignedStaffMember[];
}

export async function getEventByBarCode(barCode: string): Promise<EventData | null> {
  const q = query(collection(db, 'events'), where('barCode', '==', barCode));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as EventData;
}

export async function getPlatformFeeRate(): Promise<number> {
  try {
    const snap = await getDoc(doc(db, 'config', 'platform'));
    const fee = snap.data()?.platformFee;
    if (typeof fee === 'number' && fee > 0) return fee / 100;
  } catch {}
  return 0.09;
}

export async function getPlatformConfig(): Promise<{ platformFee: number; posFee: number; privateFee: number; budgetFee: number; chargebackReserve: number; payoutDelayDays: number }> {
  try {
    const snap = await getDoc(doc(db, 'config', 'platform'));
    if (snap.exists()) {
      const d = snap.data();
      return {
        platformFee:      d.platformFee      ?? 9,
        posFee:           d.posFee           ?? 50,
        privateFee:       d.privateFee       ?? 25,
        budgetFee:        d.budgetFee        ?? 15,
        chargebackReserve: d.chargebackReserve ?? 20,
        payoutDelayDays:  d.payoutDelayDays  ?? 7,
      };
    }
  } catch {}
  return { platformFee: 9, posFee: 50, privateFee: 25, budgetFee: 15, chargebackReserve: 20, payoutDelayDays: 7 };
}

// ─── Event Create Draft ──────────────────────────────────────────────────────

export async function saveEventDraft(uid: string, draft: Record<string, any>): Promise<void> {
  await setDoc(doc(db, 'organizers', uid, 'drafts', 'event_create'), {
    ...draft,
    savedAt: serverTimestamp(),
  });
}

export async function loadEventDraft(uid: string): Promise<Record<string, any> | null> {
  const snap = await getDoc(doc(db, 'organizers', uid, 'drafts', 'event_create'));
  return snap.exists() ? snap.data() : null;
}

export async function clearEventDraft(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'organizers', uid, 'drafts', 'event_create'));
}

// ─── Vendor Dashboard Draft ──────────────────────────────────────────────────

export async function saveVendorDraft(uid: string, draft: Record<string, any>): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'drafts', 'vendor_dashboard'), {
    ...draft,
    savedAt: serverTimestamp(),
  });
}

export async function loadVendorDraft(uid: string): Promise<Record<string, any> | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'drafts', 'vendor_dashboard'));
  return snap.exists() ? snap.data() : null;
}

// ─── Account Deletion ────────────────────────────────────────────

export async function writeAuditLog(
  adminUid: string,
  action: string,
  targetUid: string,
  details: Record<string, any> = {}
): Promise<void> {
  await addDoc(collection(db, 'auditLog'), {
    adminUid,
    action,
    targetUid,
    details,
    createdAt: serverTimestamp(),
  });
}

export async function requestPayout(data: {
  organizerId: string;
  organizerName: string;
  organizerEmail: string;
  amount: number;
  payoutMethod: string;
  payoutAccount: string;
  note?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'payoutRequests'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getOrganizerPayoutRequests(organizerId: string) {
  const snap = await getDocs(query(
    collection(db, 'payoutRequests'),
    where('organizerId', '==', organizerId),
    orderBy('createdAt', 'desc'),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function deleteDocs(q: ReturnType<typeof query>) {
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

export async function deleteOrganizerData(organizerId: string): Promise<void> {
  await Promise.all([
    deleteDocs(query(collection(db, 'events'),          where('organizerId', '==', organizerId))),
    deleteDocs(query(collection(db, 'vendors'),         where('organizerId', '==', organizerId))),
    deleteDocs(query(collection(db, 'vendorRequests'),  where('organizerId', '==', organizerId))),
    deleteDocs(query(collection(db, 'tickets'),         where('organizerId', '==', organizerId))),
    deleteDocs(query(collection(db, 'vendorPurchases'), where('organizerId', '==', organizerId))),
    deleteDocs(query(collection(db, 'staff'),           where('organizerId', '==', organizerId))),
  ]);
  await deleteDoc(doc(db, 'organizers', organizerId)).catch(() => {});
  await deleteDoc(doc(db, 'users', organizerId)).catch(() => {});
}

// Reset = wipe operational data only, keep users doc so they can re-onboard
export async function resetOrganizerData(organizerId: string): Promise<void> {
  await Promise.all([
    deleteDocs(query(collection(db, 'events'),          where('organizerId', '==', organizerId))),
    deleteDocs(query(collection(db, 'vendors'),         where('organizerId', '==', organizerId))),
    deleteDocs(query(collection(db, 'vendorRequests'),  where('organizerId', '==', organizerId))),
    deleteDocs(query(collection(db, 'tickets'),         where('organizerId', '==', organizerId))),
    deleteDocs(query(collection(db, 'vendorPurchases'), where('organizerId', '==', organizerId))),
    deleteDocs(query(collection(db, 'staff'),           where('organizerId', '==', organizerId))),
  ]);
}

export async function deleteVendorData(vendorUid: string): Promise<void> {
  const vendorSnap = await getDocs(query(collection(db, 'vendors'), where('uid', '==', vendorUid)));
  const vendorIds = vendorSnap.docs.map(d => d.id);
  await Promise.all(vendorSnap.docs.map(d => deleteDoc(d.ref)));
  for (const vid of vendorIds) {
    await Promise.all([
      deleteDocs(query(collection(db, 'vendorRequests'),  where('vendorId', '==', vid))),
      deleteDocs(query(collection(db, 'vendorPurchases'), where('vendorId', '==', vid))),
      deleteDocs(query(collection(db, 'tickets'),         where('vendorId', '==', vid))),
    ]);
  }
  await deleteDoc(doc(db, 'users', vendorUid)).catch(() => {});
}

export async function resetVendorData(vendorUid: string): Promise<void> {
  const vendorSnap = await getDocs(query(collection(db, 'vendors'), where('uid', '==', vendorUid)));
  const vendorIds = vendorSnap.docs.map(d => d.id);
  await Promise.all(vendorSnap.docs.map(d => deleteDoc(d.ref)));
  for (const vid of vendorIds) {
    await Promise.all([
      deleteDocs(query(collection(db, 'vendorRequests'),  where('vendorId', '==', vid))),
      deleteDocs(query(collection(db, 'vendorPurchases'), where('vendorId', '==', vid))),
      deleteDocs(query(collection(db, 'tickets'),         where('vendorId', '==', vid))),
    ]);
  }
}

export async function deleteFanData(uid: string, email: string): Promise<void> {
  await deleteDocs(query(collection(db, 'tickets'), where('buyerEmail', '==', email)));
  await deleteDoc(doc(db, 'users', uid)).catch(() => {});
}

// ─── Budget tracker ───────────────────────────────────────────────────────────

export const BUDGET_CATEGORIES = [
  'Sal / Venue', 'Artis / Animasyon', 'Dekorasyon', 'Sekirite',
  'Manje', 'Bwason', 'Son / Limyè', 'Maketing', 'Transpò', 'Lòt',
] as const;

export type BudgetCategory = typeof BUDGET_CATEGORIES[number];

export interface BudgetItem {
  id: string;
  eventId: string;
  organizerId: string;
  category: BudgetCategory;
  description: string;
  amount: number;
  note?: string;
  createdAt: Timestamp | null;
}

export async function getBudgetItems(eventId: string): Promise<BudgetItem[]> {
  const snap = await getDocs(query(collection(db, 'budgetItems'), where('eventId', '==', eventId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetItem))
    .sort((a, b) => ((b.createdAt as any)?.toMillis?.() ?? 0) - ((a.createdAt as any)?.toMillis?.() ?? 0));
}

export async function addBudgetItem(item: Omit<BudgetItem, 'id' | 'createdAt'>): Promise<BudgetItem> {
  const ref = doc(collection(db, 'budgetItems'));
  const { note, ...rest } = item;
  const data = { ...rest, createdAt: serverTimestamp(), ...(note ? { note } : {}) };
  await setDoc(ref, data);
  return { id: ref.id, ...data, createdAt: null };
}

export async function deleteBudgetItem(itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'budgetItems', itemId));
}

export async function resetFanData(email: string): Promise<void> {
  await deleteDocs(query(collection(db, 'tickets'), where('buyerEmail', '==', email)));
}

// ─── Cash activation requests ─────────────────────────────────────────────────

export async function addBudgetCashRequest(data: {
  eventId: string;
  eventName: string;
  organizerId: string;
  organizerName: string;
  amount: number;
}): Promise<string> {
  const ref = doc(collection(db, 'budgetCashRequests'));
  await setDoc(ref, { ...data, status: 'pending', createdAt: serverTimestamp() });
  return ref.id;
}

export async function addCashActivationRequest(data: {
  eventId: string;
  eventName: string;
  organizerId: string;
  organizerName: string;
  amount: number;
}): Promise<string> {
  const ref = doc(collection(db, 'cashActivationRequests'));
  await setDoc(ref, { ...data, status: 'pending', createdAt: serverTimestamp() });
  return ref.id;
}

// ─── Guest list / Invitations ─────────────────────────────────────────────────

export interface Invitation {
  id: string;
  eventId: string;
  organizerId: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  allowPlusOnes: 0 | 1 | 2;
  status: 'invited' | 'confirmed' | 'declined';
  ticketCode?: string | null;
  ticketCount?: number;
  invitedAt: Timestamp | null;
  confirmedAt?: Timestamp | null;
}

export async function addGuest(
  eventId: string,
  organizerId: string,
  guest: { name: string; email?: string; phone?: string; allowPlusOnes?: 0 | 1 | 2 }
): Promise<Invitation> {
  const ref = doc(collection(db, 'invitations'));
  const data = {
    eventId, organizerId,
    guestName: guest.name.trim(),
    guestEmail: guest.email?.trim().toLowerCase() || null,
    guestPhone: guest.phone?.trim() || null,
    allowPlusOnes: guest.allowPlusOnes ?? 0,
    status: 'invited' as const,
    ticketCode: null,
    ticketCount: 0,
    invitedAt: serverTimestamp(),
    confirmedAt: null,
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data, invitedAt: null };
}

export async function rsvpFreeInvitation(
  invite: Invitation,
  event: EventData,
  qty: number
): Promise<string[]> {
  const codes: string[] = [];
  const sectionName = event.sections?.[0]?.name ?? 'Général';
  const sectionId = sectionName.toLowerCase().replace(/\s+/g, '-') || 'general';
  const sectionColor = event.sections?.[0]?.color ?? '#f97316';
  for (let i = 0; i < qty; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    await addDoc(collection(db, 'tickets'), {
      ticketCode: code, qrData: code,
      eventId: event.id, organizerId: event.organizerId,
      buyerName: invite.guestName,
      buyerPhone: invite.guestPhone || '',
      buyerEmail: invite.guestEmail || null,
      section: sectionId, sectionName, sectionColor,
      seat: null,
      price: 0, priceHTG: 0,
      paymentMethod: 'free', paymentStatus: 'paid',
      status: 'valid',
      purchasedAt: serverTimestamp(),
    });
    codes.push(code);
  }
  await updateDoc(doc(db, 'invitations', invite.id), {
    status: 'confirmed',
    ticketCode: codes[0],
    ticketCount: qty,
    confirmedAt: serverTimestamp(),
  });
  return codes;
}

export async function getGuestList(eventId: string): Promise<Invitation[]> {
  const snap = await getDocs(query(collection(db, 'invitations'), where('eventId', '==', eventId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation))
    .sort((a, b) => ((b.invitedAt as any)?.toMillis?.() ?? 0) - ((a.invitedAt as any)?.toMillis?.() ?? 0));
}

export async function removeGuest(inviteId: string): Promise<void> {
  await deleteDoc(doc(db, 'invitations', inviteId));
}

export async function getInvitation(inviteId: string): Promise<Invitation | null> {
  const snap = await getDoc(doc(db, 'invitations', inviteId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Invitation;
}

export async function confirmGuest(inviteId: string, ticketCode: string): Promise<void> {
  await updateDoc(doc(db, 'invitations', inviteId), {
    status: 'confirmed',
    ticketCode,
    confirmedAt: serverTimestamp(),
  });
}

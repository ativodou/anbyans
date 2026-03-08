import {
  collection,
  collectionGroup,
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
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Event Types ─────────────────────────────────────────────────

export interface EventSection {
  name: string;
  capacity: number;
  price: number;
  sold: number;
  color: string;
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
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  section: string;
  sectionColor: string;
  seat: string;
  price: number;
  ticketCode: string;
  qrData: string;
  buyerPin?: string;
  status: 'valid' | 'used' | 'cancelled' | 'refunded';
  usedAt?: any;
  usedBy?: string;
  purchasedAt: any;
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
  return { id: snap.id, ...snap.data() } as EventData;
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
): Promise<{ valid: boolean; staffId?: string; staffName?: string; error?: string }> {
  // Get event first to check it exists and isn't over
  const event = await getEvent(eventId);
  if (!event) return { valid: false, error: 'Event not found' };

  // Check event hasn't ended (2hr grace)
  const endStr = event.endDate || event.startDate;
  const endTimeStr = event.endTime || '23:59';
  const expiry = new Date(`${endStr}T${endTimeStr}`);
  expiry.setHours(expiry.getHours() + 2);
  if (new Date() > expiry) return { valid: false, error: 'Event is over' };

  // Find staff with this PIN
  const q = query(
    collection(db, 'events', eventId, 'doorStaff'),
    where('pin', '==', pin),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return { valid: false, error: 'Wrong PIN' };

  const staffDoc = snap.docs[0];
  const staff = staffDoc.data() as DoorStaff;

  // Check not disabled
  if (staff.disabled) return { valid: false, error: 'PIN disabled by organizer' };

  // Generate device ID for this phone
  const thisDeviceId = getOrCreateDeviceId();

  // First time using this PIN — lock to this device
  if (!staff.activated || !staff.deviceId) {
    await updateDoc(staffDoc.ref, {
      deviceId: thisDeviceId,
      activated: true,
      activatedAt: serverTimestamp(),
    });
    return { valid: true, staffId: staffDoc.id, staffName: staff.staffName };
  }

  // Already activated — check same device
  if (staff.deviceId !== thisDeviceId) {
    return { valid: false, error: 'PIN already used on another phone' };
  }

  return { valid: true, staffId: staffDoc.id, staffName: staff.staffName };
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
  eventId: string,
  staffId: string,
  admitted: boolean
) {
  const ref = doc(db, 'events', eventId, 'doorStaff', staffId);
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
    collection(db, 'events', eventId, 'tickets'),
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
    collection(db, 'events', eventId, 'tickets'),
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
      collection(db, 'events', eventId, 'tickets'),
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
      collectionGroup(db, 'tickets'),
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
): Promise<TicketData[]> {
  const tickets: TicketData[] = [];

  for (const seat of seats) {
    const ticketCode = generateTicketCode();
    const qrData = `ANB:${eventId}:${ticketCode}:${Date.now().toString(36)}`;
    const ticketDoc: Omit<TicketData, 'id'> = {
      eventId,
      buyerName,
      buyerEmail,
      buyerPhone,
      section,
      sectionColor,
      seat,
      price: pricePerSeat,
      ticketCode,
      qrData,
     buyerPin: buyerPin || generateBuyerPin(),
      status: 'valid',
      purchasedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'events', eventId, 'tickets'), ticketDoc);
    tickets.push({ id: ref.id, ...ticketDoc });
  }

  // Update event sold count and revenue
  const eventRef = doc(db, 'events', eventId);
  const eventSnap = await getDoc(eventRef);
  if (eventSnap.exists()) {
    const data = eventSnap.data();
    await updateDoc(eventRef, {
      totalSold: (data.totalSold || 0) + seats.length,
      revenue: (data.revenue || 0) + (seats.length * pricePerSeat),
      updatedAt: serverTimestamp(),
    });
  }

  return tickets;
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
  bulkTiers: BulkTier[];
  available: number;
}

export interface VendorPurchase {
  id?: string;
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
  createdAt: any;
  updatedAt: any;
}

// ─── Create / Invite Reseller ──────────────────────────────────────

export async function inviteVendor(data: {
  organizerId: string;
  name: string;
  contact: string;
  phone: string;
  city: string;
  payMethod: string;
}): Promise<VendorData> {
  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  const vendorDoc: Omit<VendorData, 'id'> = {
    ...data,
    payAccount: data.phone,
    status: 'pending',
    joinedDate: '—',
    inviteToken: token,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'vendors'), vendorDoc);
  return { id: ref.id, ...vendorDoc };
}

// ─── Get Resellers by Organizer ────────────────────────────────────

export async function getOrganizerVendors(organizerId: string): Promise<VendorData[]> {
  const q = query(
    collection(db, 'vendors'),
    where('organizerId', '==', organizerId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorData));
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
}): Promise<VendorPurchase> {
  const totalPaid = params.qty * params.priceEach;
  const now = new Date();
  const purchaseDate = `${now.getDate()} ${['Jan','Fev','Mas','Avr','Me','Jen','Jiy','Out','Sep','Okt','Nov','Des'][now.getMonth()]}`;

  // Generate ticket codes for each ticket in the batch
  const ticketCodes: string[] = [];
  for (let i = 0; i < params.qty; i++) {
    ticketCodes.push(generateTicketCode());
  }

  // Save reseller tickets to event's tickets subcollection
  for (const code of ticketCodes) {
    const qrData = `ANB:${params.eventId}:${code}:${Date.now().toString(36)}`;
    await addDoc(collection(db, 'events', params.eventId, 'tickets'), {
      eventId: params.eventId,
      buyerName: `Vandè: ${params.vendorName}`,
      buyerEmail: '',
      buyerPhone: '',
      section: params.section,
      sectionColor: params.sectionColor,
      seat: 'GA',
      price: params.priceEach,
      ticketCode: code,
      qrData,
      buyerPin: generateBuyerPin(),
      status: 'valid',
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

export async function updateVendorStatus(vendorId: string, status: 'active' | 'inactive' | 'pending') {
  await updateDoc(doc(db, 'vendors', vendorId), {
    status,
    updatedAt: serverTimestamp(),
  });
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
  return event.sections.map(s => ({
    section: s.name,
    sectionColor: s.color,
    onlinePrice: s.price,
    available: s.capacity - s.sold,
    bulkTiers: (s as any).bulkTiers || [],
  }));
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
}): Promise<string[]> {
  const purchaseRef = doc(db, 'vendorPurchases', params.purchaseId);
  const purchaseSnap = await getDoc(purchaseRef);
  if (!purchaseSnap.exists()) throw new Error('Purchase not found');

  const purchase = purchaseSnap.data() as VendorPurchase;
  const available = purchase.qty - purchase.sold;
  if (params.qty > available) throw new Error('Not enough tickets');

  const assignedCodes = purchase.ticketCodes.slice(purchase.sold, purchase.sold + params.qty);

  for (const code of assignedCodes) {
    const ticketsQ = query(
      collection(db, 'events', params.eventId, 'tickets'),
      where('ticketCode', '==', code),
      limit(1)
    );
    const ticketSnap = await getDocs(ticketsQ);
    if (!ticketSnap.empty) {
      await updateDoc(ticketSnap.docs[0].ref, {
        buyerName: params.buyerName,
        buyerPhone: params.buyerPhone,
        isVendorSold: true,
        status: 'valid',
      });
    }
  }

  await updateDoc(purchaseRef, { sold: purchase.sold + params.qty });
  return assignedCodes;
}

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
  createdAt: any;
  updatedAt: any;
}

// ─── Door Staff Types ────────────────────────────────────────────

export interface DoorStaff {
  id?: string;
  staffName: string;
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

// ─── Get Events by Organizer ─────────────────────────────────────

export async function getOrganizerEvents(organizerId: string): Promise<EventData[]> {
  const q = query(
    collection(db, 'events'),
    where('organizerId', '==', organizerId),
    orderBy('createdAt', 'desc')
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

export async function addDoorStaff(eventId: string, staffName: string): Promise<DoorStaff> {
  const pin = generatePin();
  const staffData: Omit<DoorStaff, 'id'> = {
    staffName,
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

'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  getEvent,
  getOrganizerEvents,
  verifyDoorStaffPin,
  updateDoorStaffStats,
  downloadEventTickets,
  markTicketUsed,
  syncOfflineScans,
  type EventData,
  type DoorStaff,
  type OfflineTicket,
} from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────

interface ScanRecord {
  ticketCode: string;
  buyerName: string;
  buyerPhone: string;
  section: string;
  sectionColor: string;
  seat: string;
  status: 'admitted' | 'already-used' | 'not-found';
  time: string;
  synced: boolean;
}

type ViewMode = 'loading' | 'pin-entry' | 'organizer-select' | 'organizer-staff' | 'scanner' | 'waiting';

// ─── Local Storage Helpers ───────────────────────────────────────

function saveTicketsLocal(eventId: string, tickets: OfflineTicket[]) {
  try { localStorage.setItem(`anbyans-tickets-${eventId}`, JSON.stringify(tickets)); } catch {}
}
function loadTicketsLocal(eventId: string): OfflineTicket[] {
  try { const r = localStorage.getItem(`anbyans-tickets-${eventId}`); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveScanHistory(eventId: string, history: ScanRecord[]) {
  try { localStorage.setItem(`anbyans-scans-${eventId}`, JSON.stringify(history)); } catch {}
}
function loadScanHistory(eventId: string): ScanRecord[] {
  try { const r = localStorage.getItem(`anbyans-scans-${eventId}`); return r ? JSON.parse(r) : []; } catch { return []; }
}

// ─── Component ───────────────────────────────────────────────────

function ScannerPageInner() {
  const { user } = useAuth();
  const { locale } = useT();
  const searchParams = useSearchParams();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale]);

  const role = (user as any)?.role || 'fan';
  const isOrganizer = role === 'organizer';

  // State
  const [view, setView] = useState<ViewMode>('loading');
  const [eventId, setEventId] = useState('');
  const [event, setEvent] = useState<EventData | null>(null);
  const [orgEvents, setOrgEvents] = useState<EventData[]>([]);

  // Door staff management (organizer) — sourced from staffPool + staffAssignments
  const [staffList, setStaffList] = useState<any[]>([]);

  // PIN entry (door staff)
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [staffId, setStaffId] = useState('');
  const [staffName, setStaffName] = useState('');

  // Scanner
  const [tickets, setTickets] = useState<OfflineTicket[]>([]);
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [lastScan, setLastScan] = useState<ScanRecord | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number>(0);

  // Scanner settings (loaded from organizer settings)
  const [scannerSound, setScannerSound]       = useState(true);
  const [scannerVibrate, setScannerVibrate]   = useState(true);
  const [scannerShowName, setScannerShowName] = useState(true);
  const [scannerMode, setScannerMode]         = useState<'single' | 'continuous'>('single');

  // Online/offline tracking
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setIsOnline(navigator.onLine);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Load organizer scanner settings
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'organizers'), where('uid', '==', user.uid)));
        if (!snap.empty) {
          const s = snap.docs[0].data()?.scanner;
          if (s) {
            setScannerSound(s.sound ?? true);
            setScannerVibrate(s.vibrate ?? true);
            setScannerShowName(s.showName ?? true);
            setScannerMode(s.mode || 'single');
          }
        }
      } catch {}
    })();
  }, [user?.uid]);

  // Initialize
  useEffect(() => {
    const urlEventId = searchParams.get('event');
    if (isOrganizer && !urlEventId) {
      loadOrganizerEvents();
    } else if (urlEventId) {
      setEventId(urlEventId);
      if (isOrganizer) {
        loadEventForOrganizer(urlEventId);
      } else {
        setView('pin-entry');
      }
    } else {
      setView('pin-entry');
    }
  }, [user, searchParams]);

  // ─── Organizer Functions ───────────────────────────────────────

  async function loadOrganizerEvents() {
    if (!user) return;
    try {
      const events = await getOrganizerEvents(user.uid);
      setOrgEvents(events.filter(e => e.status === 'published' || e.status === 'live'));
    } catch {}
    setView('organizer-select');
  }

  async function loadEventForOrganizer(eid: string) {
    try {
      const ev = await getEvent(eid);
      if (ev) {
        setEvent(ev);
        // Load assigned staff from staffAssignments + staffPool
        const [assignSnap, poolSnap] = await Promise.all([
          getDocs(query(collection(db, 'staffAssignments'), where('eventId', '==', eid))),
          getDocs(query(collection(db, 'staffPool'), where('organizerId', '==', user!.uid))),
        ]);
        const poolMap = new Map(poolSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
        const merged = assignSnap.docs
          .map(d => {
            const a = d.data();
            const member = poolMap.get(a.staffId) as any;
            if (!member) return null;
            return {
              id: d.id,
              staffId: a.staffId,
              staffName: member.name,
              phone: member.phone,
              pin: member.pin || '',
              role: a.role || member.role,
              activated: a.active,
              disabled: !a.active,
              scansCount: 0,
              admittedCount: 0,
              deniedCount: 0,
            };
          })
          .filter(Boolean);
        setStaffList(merged);
        setView('organizer-staff');
      }
    } catch {}
  }

  function selectOrgEvent(eid: string) {
    setEventId(eid);
    loadEventForOrganizer(eid);
  }


  function shareStaffPin(staff: any) {
    const url = `${window.location.origin}/organizer/scanner?event=${eventId}`;
    const msg = `📱 Eskane tike pou "${event?.name}"\n👤 ${staff.staffName}\n🔗 ${url}\n🔑 PIN: ${staff.pin}\n\n⚠️ PIN sa a pou OU selman. Li pral bloke sou telefon OU.`;
    const phone = staff.phone?.replace(/[^0-9]/g, '') || '';
    if (phone) {
      window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    } else if (navigator.share) {
      navigator.share({ title: 'Anbyans Scanner', text: msg });
    } else {
      navigator.clipboard.writeText(msg);
      alert(L('Kopye!', 'Copied!', 'Copie!'));
    }
  }

  function organizerStartScanning() {
    const localTickets = loadTicketsLocal(eventId);
    const localHistory = loadScanHistory(eventId);
    setTickets(localTickets);
    setScanHistory(localHistory);
    setStaffName('Organizer');
    setStaffId('organizer');
    setView('scanner');
  }

  // ─── Door Staff PIN Entry ─────────────────────────────────────

  async function handlePinSubmit() {
    if (!eventId || pin.length < 6) {
      setPinError(L('Mete PIN 6 chif la', 'Enter the 6-digit PIN', 'Entrez le PIN a 6 chiffres'));
      return;
    }
    setPinError('');
    try {
      const result = await verifyDoorStaffPin(eventId, pin);
      if (result.valid) {
        const ev = await getEvent(eventId);
        setEvent(ev);
        setStaffId(result.staffId || '');
        setStaffName(result.staffName || '');
        const localTickets = loadTicketsLocal(eventId);
        const localHistory = loadScanHistory(eventId);
        setTickets(localTickets);
        setScanHistory(localHistory);
        setView('scanner');
      } else if (result.waiting) {
        // PIN is valid but organizer hasn't activated yet — poll until they do
        setView('waiting');
        const interval = setInterval(async () => {
          try {
            const check = await verifyDoorStaffPin(eventId, pin);
            if (check.valid) {
              clearInterval(interval);
              const ev = await getEvent(eventId);
              setEvent(ev);
              setStaffId(check.staffId || '');
              setStaffName(check.staffName || '');
              const localTickets = loadTicketsLocal(eventId);
              const localHistory = loadScanHistory(eventId);
              setTickets(localTickets);
              setScanHistory(localHistory);
              setView('scanner');
            }
          } catch {}
        }, 5000);
      } else {
        setPinError(result.error || L('PIN pa bon', 'Invalid PIN', 'PIN invalide'));
      }
    } catch {
      setPinError(L('Ere koneksyon', 'Connection error', 'Erreur de connexion'));
    }
  }

  // ─── Download Tickets ──────────────────────────────────────────

  async function handleDownloadTickets() {
    setDownloading(true);
    try {
      const fresh = await downloadEventTickets(eventId);
      setTickets(fresh);
      saveTicketsLocal(eventId, fresh);
      alert(L(
        `${fresh.length} tike telechaje! Eskane mache san entenet kounye a.`,
        `${fresh.length} tickets downloaded! Scanner works offline now.`,
        `${fresh.length} billets telecharges! Scanner fonctionne hors ligne.`
      ));
    } catch {
      alert(L('Ere. Eseye anko.', 'Error. Try again.', 'Erreur. Reessayez.'));
    }
    setDownloading(false);
  }

  // ─── Scan Ticket (offline-first) ──────────────────────────────

  const processTicketCode = useCallback((code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    const ticket = tickets.find(t => t.ticketCode === trimmed || t.qrData === trimmed);
    const now = new Date().toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let record: ScanRecord;

    if (!ticket) {
      record = {
        ticketCode: trimmed, buyerName: '???', buyerPhone: '',
        section: '—', sectionColor: '#666', seat: '—',
        status: 'not-found', time: now, synced: false,
      };
    } else if (ticket.status === 'used' || scanHistory.some(h => h.ticketCode === ticket.ticketCode && h.status === 'admitted')) {
      record = {
        ticketCode: ticket.ticketCode, buyerName: ticket.buyerName,
        buyerPhone: (ticket as any).buyerPhone || '',
        section: ticket.section, sectionColor: ticket.sectionColor, seat: ticket.seat,
        status: 'already-used', time: now, synced: false,
      };
    } else {
      const updated = tickets.map(t => t.ticketCode === ticket.ticketCode ? { ...t, status: 'used' as const } : t);
      setTickets(updated);
      saveTicketsLocal(eventId, updated);
      record = {
        ticketCode: ticket.ticketCode, buyerName: ticket.buyerName,
        buyerPhone: (ticket as any).buyerPhone || '',
        section: ticket.section, sectionColor: ticket.sectionColor, seat: ticket.seat,
        status: 'admitted', time: now, synced: false,
      };

      if (isOnline) {
        markTicketUsed(eventId, ticket.ticketCode, staffName).catch(() => {});
        if (staffId && staffId !== 'organizer') {
          updateDoorStaffStats(eventId, staffId, true).catch(() => {});
        }
        record.synced = true;
      }
    }

    if (record.status !== 'admitted' && isOnline && staffId && staffId !== 'organizer') {
      updateDoorStaffStats(eventId, staffId, false).catch(() => {});
    }

    setLastScan(record);
    const newHistory = [record, ...scanHistory];
    setScanHistory(newHistory);
    saveScanHistory(eventId, newHistory);

    // Sound feedback
    if (scannerSound) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = record.status === 'admitted' ? 880 : 220;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch {}
    }

    // Vibration
    if (scannerVibrate && navigator.vibrate) {
      navigator.vibrate(record.status === 'admitted' ? [100] : [100, 50, 100]);
    }

    // Continuous mode — auto-clear result after 2s
    if (scannerMode === 'continuous') {
      setTimeout(() => setLastScan(null), 2000);
    }
  }, [tickets, scanHistory, eventId, isOnline, staffId, staffName, scannerSound, scannerVibrate, scannerMode]);

  function handleManualScan() {
    processTicketCode(manualCode);
    setManualCode('');
  }

  // ─── Camera ────────────────────────────────────────────────────

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    cancelAnimationFrame(rafRef.current);
    setCameraActive(false);
  }

  async function startCamera() {
    setCameraError('');
    if (!('BarcodeDetector' in window)) {
      setCameraError('Navigatè sa a pa sipote eskan kamera. Itilize Chrome sou Android.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      setCameraActive(true);
      runScanLoop();
    } catch {
      setCameraError('Pa ka louvri kamera. Otorize akse kamera nan navigate a.');
    }
  }

  function runScanLoop() {
    rafRef.current = requestAnimationFrame(async () => {
      if (!videoRef.current || !detectorRef.current || !videoRef.current.srcObject) return;
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0) {
          processTicketCode(barcodes[0].rawValue as string);
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch {}
      runScanLoop();
    });
  }

  // ─── Sync ─────────────────────────────────────────────────────

  async function handleSync() {
    const unsynced = scanHistory.filter(h => !h.synced && h.status === 'admitted');
    if (unsynced.length === 0) {
      alert(L('Tout sinkronize deja!', 'Everything synced!', 'Tout synchronise!'));
      return;
    }
    setSyncing(true);
    try {
      const count = await syncOfflineScans(eventId, unsynced.map(s => ({
        ticketCode: s.ticketCode, usedAt: new Date().toISOString(), scannedBy: staffName,
      })));
      const updated = scanHistory.map(h => ({ ...h, synced: true }));
      setScanHistory(updated);
      saveScanHistory(eventId, updated);
      alert(L(`${count} tike sinkronize!`, `${count} tickets synced!`, `${count} billets synchronises!`));
    } catch {
      alert(L('Ere sinkronizasyon', 'Sync error', 'Erreur sync'));
    }
    setSyncing(false);
  }

  // ─── Stats ────────────────────────────────────────────────────

  const stats = {
    admitted: scanHistory.filter(h => h.status === 'admitted').length,
    denied: scanHistory.filter(h => h.status !== 'admitted').length,
    total: scanHistory.length,
    unsynced: scanHistory.filter(h => !h.synced && h.status === 'admitted').length,
    downloaded: tickets.length,
  };

  const statusConfig = {
    'admitted':     { bg: '#0a2a0a', border: '#22c55e', color: '#22c55e', icon: '✅', label: L('Antre!', 'Admitted!', 'Admis!') },
    'already-used': { bg: '#2a1a00', border: '#f97316', color: '#f97316', icon: '⚠️', label: L('Deja Itilize!', 'Already Used!', 'Deja utilise!') },
    'not-found':    { bg: '#2a0a0a', border: '#ef4444', color: '#ef4444', icon: '❌', label: L('Pa Jwenn!', 'Not Found!', 'Non trouve!') },
  };

  // ─── Styles ───────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = { minHeight: '100vh', background: '#0a0a0f', color: '#fff' };
  const cardStyle: React.CSSProperties = { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 20 };
  const inputStyle: React.CSSProperties = { width: '100%', padding: 14, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 16, boxSizing: 'border-box' };
  const btnOrange: React.CSSProperties = { padding: '14px 24px', borderRadius: 8, border: 'none', background: '#f97316', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' };

  // ═══════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════

  if (view === 'loading') {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#888' }}>...</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PIN ENTRY (door staff)
  // ═══════════════════════════════════════════════════════════════

  if (view === 'pin-entry') {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ maxWidth: 380, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
              {L('Eskane Tike', 'Ticket Scanner', 'Scanner de Billets')}
            </h1>
            <p style={{ color: '#888', fontSize: 13 }}>
              {L('Mete kod PIN oganizate a ba ou a', 'Enter the PIN code from the organizer', "Entrez le code PIN de l'organisateur")}
            </p>
          </div>

          <div style={cardStyle}>
            {!searchParams.get('event') && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#888', fontSize: 11, marginBottom: 6, display: 'block' }}>Event ID</label>
                <input value={eventId} onChange={e => setEventId(e.target.value)} placeholder="abc123..." style={{ ...inputStyle, fontSize: 14 }} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#888', fontSize: 11, marginBottom: 6, display: 'block' }}>PIN</label>
              <input
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                type="tel"
                maxLength={6}
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight: 800 }}
              />
            </div>

            {pinError && (
              <div style={{ background: '#2a0a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '8px 12px', marginBottom: 16, color: '#ef4444', fontSize: 12, textAlign: 'center' }}>
                {pinError}
              </div>
            )}

            <button onClick={handlePinSubmit} disabled={pin.length < 6} style={{
              ...btnOrange, opacity: pin.length < 6 ? 0.4 : 1, cursor: pin.length < 6 ? 'not-allowed' : 'pointer',
            }}>
              {L('Antre', 'Enter', 'Entrer')} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // WAITING FOR ACTIVATION
  // ═══════════════════════════════════════════════════════════════

  if (view === 'waiting') {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>⏳</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
            {L('Ap tann aktivasyon...', 'Waiting for activation...', 'En attente d\'activation...')}
          </h1>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            {L(
              'PIN ou an bon. Òganizatè a dwe aktive ou anvan ou ka kòmanse eskane.',
              'Your PIN is correct. The organizer needs to activate you before you can start scanning.',
              'Votre PIN est correct. L\'organisateur doit vous activer avant de scanner.'
            )}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#f97316', fontSize: 13 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', animation: 'pulse 1.5s infinite' }} />
            {L('Y ap chèche otorizasyon...', 'Checking for authorization...', 'Vérification en cours...')}
          </div>
          <button onClick={() => { setView('pin-entry'); setPin(''); }}
            style={{ marginTop: 40, background: 'transparent', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer' }}>
            ← {L('Retounen', 'Back', 'Retour')}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ORGANIZER — SELECT EVENT
  // ═══════════════════════════════════════════════════════════════

  if (view === 'organizer-select') {
    return (
      <div style={{ ...pageStyle, padding: 20 }}>
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            📱 {L('Chwazi Evenman', 'Select Event', 'Choisir un evenement')}
          </h1>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>
            {L('Ki evenman ou vle jere eskane a?', 'Which event to manage scanning?', 'Quel evenement gerer?')}
          </p>

          {orgEvents.length === 0 && (
            <div style={cardStyle}>
              <p style={{ color: '#666', textAlign: 'center' }}>{L('Pa gen evenman pibliye', 'No published events', 'Aucun evenement publie')}</p>
            </div>
          )}

          {orgEvents.map(ev => (
            <div key={ev.id} onClick={() => selectOrgEvent(ev.id!)}
              style={{ ...cardStyle, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{ev.name}</div>
                <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{ev.startDate} @ {ev.startTime} • {ev.venue?.name}</div>
              </div>
              <span style={{ color: '#555', fontSize: 18 }}>→</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ORGANIZER — MANAGE DOOR STAFF
  // ═══════════════════════════════════════════════════════════════

  if (view === 'organizer-staff') {
    return (
      <div style={{ ...pageStyle, padding: 20 }}>
        <div style={{ maxWidth: 540, margin: '0 auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🚪 {event?.name}</h1>
              <p style={{ color: '#888', fontSize: 12 }}>{event?.startDate} @ {event?.startTime} • {event?.venue?.name}</p>
            </div>
            <button onClick={organizerStartScanning} style={{
              padding: '10px 18px', borderRadius: 8, border: 'none',
              background: '#f97316', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              📷 {L('Eskane', 'Scan', 'Scanner')}
            </button>
          </div>

          <div style={{ ...cardStyle, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>👥 {L('Ekip Pot la', 'Door Team', 'Équipe Porte')}</div>
              <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{L('Jere staff nan paj Staff la', 'Manage staff from the Staff page', 'Gérez le staff depuis la page Staff')}</div>
            </div>
            <a href={`/organizer/staff?event=${eventId}`}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #f97316', color: '#f97316', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              ➕ {L('Jere Staff', 'Manage Staff', 'Gérer Staff')}
            </a>
          </div>

          <div style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            {L('Ekip nan Pot', 'Door Team', 'Equipe Porte')} ({staffList.length})
          </div>

          {staffList.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <p style={{ color: '#666', fontSize: 13 }}>{L('Pa gen staff asiyen pou evènman sa. Ale nan paj Staff pou asiyen moun.', 'No staff assigned to this event. Go to the Staff page to assign people.', 'Aucun staff assigné. Allez sur la page Staff.')}</p>
            </div>
          )}

          {staffList.map(staff => (
            <div key={staff.id} style={{
              ...cardStyle, marginBottom: 10, padding: 16,
              opacity: staff.disabled ? 0.4 : 1,
              borderColor: staff.activated ? '#22c55e30' : '#1e1e2e',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {staff.staffName}
                    {staff.disabled && <span style={{ color: '#ef4444', fontSize: 10, marginLeft: 8 }}>DISABLED</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span style={{ color: '#888', fontSize: 11 }}>PIN:</span>
                    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 4, color: '#f97316', fontFamily: 'monospace' }}>{staff.pin}</span>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {staff.activated ? (
                      <span style={{ fontSize: 10, color: '#22c55e', background: '#22c55e15', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                        ✓ {L('Aktive', 'Active', 'Actif')}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: '#888', background: '#ffffff08', padding: '2px 8px', borderRadius: 4 }}>
                        {L('Pa anko konekte', 'Not connected yet', 'Pas encore connecte')}
                      </span>
                    )}
                    {staff.scansCount > 0 && (
                      <span style={{ fontSize: 10, color: '#888' }}>
                        {staff.scansCount} {L('eskan', 'scans', 'scans')} • {staff.admittedCount} ✅ • {staff.deniedCount} ❌
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => shareStaffPin(staff)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${staff.phone ? '#22c55e' : '#f97316'}`, background: staff.phone ? '#22c55e15' : 'transparent', color: staff.phone ? '#22c55e' : '#f97316', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    {staff.phone ? '💬 WhatsApp' : L('Pataje', 'Share', 'Partager')}
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button onClick={() => { setEventId(''); setEvent(null); setStaffList([]); setView('organizer-select'); }}
            style={{ marginTop: 16, padding: '10px 0', background: 'transparent', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer' }}>
            ← {L('Retounen', 'Back', 'Retour')}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SCANNER VIEW
  // ═══════════════════════════════════════════════════════════════

  const sc = lastScan ? statusConfig[lastScan.status] : null;

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '16px 16px 100px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>📱 {event?.name || 'Scanner'}</h1>
            <p style={{ color: '#888', fontSize: 11, margin: '4px 0 0' }}>
              👤 {staffName} • {event?.venue?.name}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#22c55e' : '#ef4444' }} />
            <span style={{ color: isOnline ? '#22c55e' : '#ef4444', fontSize: 10, fontWeight: 700 }}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div style={{ ...cardStyle, padding: 12, textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{L('Eskane', 'Scanned', 'Scannes')}</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.total}</div>
          </div>
          <div style={{ ...cardStyle, padding: 12, textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{L('Antre', 'Admitted', 'Admis')}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e' }}>{stats.admitted}</div>
          </div>
          <div style={{ ...cardStyle, padding: 12, textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{L('Refize', 'Denied', 'Refuses')}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{stats.denied}</div>
          </div>
        </div>

        {/* Download & Sync */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={handleDownloadTickets} disabled={downloading || !isOnline}
            style={{
              flex: 1, padding: 12, borderRadius: 8, border: '1px solid #06b6d4',
              background: 'transparent', color: '#06b6d4', fontSize: 12, fontWeight: 700,
              cursor: downloading || !isOnline ? 'not-allowed' : 'pointer',
              opacity: downloading || !isOnline ? 0.4 : 1,
            }}>
            {downloading ? '...' : `⬇️ ${L('Telechaje', 'Download', 'Telecharger')} (${stats.downloaded})`}
          </button>
          <button onClick={handleSync} disabled={syncing || !isOnline || stats.unsynced === 0}
            style={{
              flex: 1, padding: 12, borderRadius: 8,
              border: stats.unsynced > 0 ? 'none' : '1px solid #22c55e',
              background: stats.unsynced > 0 ? '#22c55e' : 'transparent',
              color: stats.unsynced > 0 ? '#000' : '#22c55e',
              fontSize: 12, fontWeight: 700,
              cursor: syncing || !isOnline || stats.unsynced === 0 ? 'not-allowed' : 'pointer',
              opacity: syncing || !isOnline ? 0.4 : 1,
            }}>
            {syncing ? '...' : `🔄 ${L('Sinkronize', 'Sync', 'Sync')} (${stats.unsynced})`}
          </button>
        </div>

        {/* Last scan result */}
        {lastScan && sc && (
          <div style={{ ...cardStyle, marginBottom: 16, textAlign: 'center', borderColor: sc.border, background: sc.bg }}>
            <div style={{ fontSize: 48 }}>{sc.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: sc.color, marginTop: 8 }}>{sc.label}</div>
            {scannerShowName && (
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{lastScan.buyerName}</div>
            )}

            {/* Phone number */}
            {lastScan.buyerPhone && (
              <div style={{ marginTop: 6 }}>
                <a
                  href={`tel:${lastScan.buyerPhone}`}
                  style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}
                >
                  📞 {lastScan.buyerPhone}
                </a>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, border: `1px solid ${lastScan.sectionColor}`, color: lastScan.sectionColor, background: lastScan.sectionColor + '15' }}>
                {lastScan.section}
              </span>
              <span style={{ color: '#888', fontSize: 12 }}>{L('Plas', 'Seat', 'Place')} {lastScan.seat}</span>
            </div>
            <div style={{ color: '#555', fontSize: 10, fontFamily: 'monospace', marginTop: 8 }}>{lastScan.ticketCode}</div>
          </div>
        )}

        {/* Camera view */}
        {cameraActive && (
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <video ref={videoRef} playsInline muted
              style={{ width: '100%', borderRadius: 12, border: '2px solid #f97316', display: 'block', maxHeight: 300, objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 180, height: 180, border: '2px solid #f97316', borderRadius: 12, pointerEvents: 'none', boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
            <button onClick={stopCamera} style={{ position: 'absolute', top: 8, right: 8, padding: '6px 12px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              ✕ {L('Femen', 'Close', 'Fermer')}
            </button>
          </div>
        )}
        {cameraError && (
          <div style={{ background: '#2a0a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 12, textAlign: 'center' }}>
            {cameraError}
          </div>
        )}

        {/* Scan buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={cameraActive ? stopCamera : startCamera}
            style={{ ...btnOrange, flex: 1, background: cameraActive ? '#ef4444' : '#f97316' }}>
            {cameraActive
              ? `⏹ ${L('Kanpe Eskane', 'Stop Scanning', 'Arreter')}`
              : `📷 ${lastScan ? L('Eskane Anko', 'Scan Again', 'Scanner encore') : L('Eskane QR Code', 'Scan QR Code', 'Scanner QR Code')}`}
          </button>
          <button onClick={() => setShowManual(!showManual)}
            style={{ padding: '14px 20px', borderRadius: 8, border: '1px solid #1e1e2e', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 16 }}>
            ⌨️
          </button>
        </div>

        {/* Manual entry */}
        {showManual && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ color: '#f97316', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              {L('Antre kod tike a', 'Enter ticket code', 'Entrez le code du billet')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={manualCode} onChange={e => setManualCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleManualScan()}
                placeholder="ANB-XXXX..." style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 14, fontFamily: 'monospace' }} />
              <button onClick={handleManualScan} style={{ padding: '12px 20px', borderRadius: 8, border: 'none', background: '#f97316', color: '#000', fontWeight: 700, cursor: 'pointer' }}>
                {L('Cheke', 'Check', 'Verifier')}
              </button>
            </div>
          </div>
        )}

        {/* Scan history */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: '#888', margin: 0 }}>{L('Istwa Eskane', 'Scan History', 'Historique')}</h3>
            {stats.unsynced > 0 && <span style={{ fontSize: 10, color: '#f97316' }}>{stats.unsynced} {L('pa sinkronize', 'not synced', 'non sync')}</span>}
          </div>

          {scanHistory.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: 13 }}>{L('Pa gen eskan anko', 'No scans yet', 'Aucun scan')}</p>
            </div>
          )}

          {scanHistory.slice(0, 50).map((h, i) => {
            const s = statusConfig[h.status];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', marginBottom: 6,
                borderRadius: 8, border: `1px solid ${s.border}30`, background: s.bg + '80',
              }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.buyerName}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>
                    <span style={{ color: h.sectionColor }}>{h.section}</span> • {h.seat}
                    {h.buyerPhone ? ` • 📞 ${h.buyerPhone}` : ''}
                    {' • '}<span style={{ fontFamily: 'monospace' }}>{h.ticketCode}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.label}</div>
                  <div style={{ fontSize: 9, color: '#555' }}>{h.time}</div>
                  {!h.synced && h.status === 'admitted' && (
                    <div style={{ fontSize: 8, color: '#f97316', marginTop: 2 }}>⏳</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Back to staff management (organizer only) */}
        {isOrganizer && (
          <button onClick={() => setView('organizer-staff')}
            style={{ marginTop: 20, padding: '10px 0', background: 'transparent', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'center' }}>
            ← {L('Retounen jere ekip la', 'Back to staff management', 'Retour gestion equipe')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#888' }}>...</p></div>}>
      <ScannerPageInner />
    </Suspense>
  );
}
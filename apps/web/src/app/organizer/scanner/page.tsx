'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import jsQR from 'jsqr';
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

type ViewMode = 'loading' | 'pin-entry' | 'organizer-select' | 'organizer-staff' | 'scanner' | 'waiting' | 'fb' | 'sales' | 'security' | 'manager';

function roleToView(role: string): ViewMode {
  switch (role) {
    case 'fb':       return 'fb';
    case 'sales':    return 'sales';
    case 'security': return 'security';
    case 'manager':  return 'manager';
    default:         return 'scanner'; // scanner, door, any unknown
  }
}

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

// ═══════════════════════════════════════════════════════════════
// F&B LOGGING COMPONENT
// ═══════════════════════════════════════════════════════════════

function FbView({ eventId, eventName, organizerId, staffId, staffName, onBack }: {
  eventId: string; eventName: string; organizerId: string; staffId: string; staffName: string;
  onBack: () => void;
}) {
  const { t } = useT();
  const CATEGORIES = ['Food', 'Drinks', 'Merch'];
  const PAY_METHODS = ['Cash', 'MonCash', 'Natcash'];

  const [category, setCategory]   = useState('Food');
  const [amount, setAmount]       = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [note, setNote]           = useState('');
  const [saving, setSaving]       = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [totalToday, setTotalToday]   = useState(0);

  const submit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    setSaving(true);
    try {
      const sale = {
        eventId, staffId, staffName, organizerId,
        category, amount: Number(amount), paymentMethod: payMethod,
        note: note.trim(), recordedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'fbSales'), sale);
      const newSale = { id: ref.id, ...sale, recordedAt: new Date() };
      setRecentSales(prev => [newSale, ...prev].slice(0, 10));
      setTotalToday(prev => prev + Number(amount));
      setAmount('');
      setNote('');
    } finally { setSaving(false); }
  };

  const pageStyle: React.CSSProperties = { minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'system-ui, sans-serif' };
  const cardStyle: React.CSSProperties = { background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16 };

  return (
    <div style={{ ...pageStyle, padding: 20 }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>🍽️ {t('rev_food_bev')}</h1>
            <p style={{ color: '#888', fontSize: 11, margin: '4px 0 0' }}>👤 {staffName} • {eventName}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#888', fontSize: 10, margin: 0 }}>Today's total</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#f97316', margin: 0 }}>${totalToday.toFixed(2)}</p>
          </div>
        </div>

        {/* Entry form */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Log Sale
          </p>

          {/* Category */}
          <p style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>Category</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, border: `1px solid ${category === c ? '#f97316' : '#1e1e2e'}`,
                background: category === c ? '#f9731620' : 'transparent', color: category === c ? '#f97316' : '#888',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{c}</button>
            ))}
          </div>

          {/* Amount */}
          <p style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>Amount ($)</p>
          <input
            type="number" inputMode="decimal" value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }}
          />

          {/* Payment method */}
          <p style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>Payment Method</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {PAY_METHODS.map(m => (
              <button key={m} onClick={() => setPayMethod(m)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, border: `1px solid ${payMethod === m ? '#22c55e' : '#1e1e2e'}`,
                background: payMethod === m ? '#22c55e20' : 'transparent', color: payMethod === m ? '#22c55e' : '#888',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{m}</button>
            ))}
          </div>

          {/* Note (optional) */}
          <input
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }}
          />

          <button onClick={submit} disabled={saving || !amount || Number(amount) <= 0} style={{
            width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
            background: amount && Number(amount) > 0 ? '#f97316' : '#222',
            color: amount && Number(amount) > 0 ? '#000' : '#555',
            fontSize: 15, fontWeight: 800, cursor: amount ? 'pointer' : 'not-allowed',
          }}>
            {saving ? '...' : `✓ Log Sale ${amount ? `$${Number(amount).toFixed(2)}` : ''}`}
          </button>
        </div>

        {/* Recent sales */}
        {recentSales.length > 0 && (
          <div style={cardStyle}>
            <p style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Recent Sales
            </p>
            {recentSales.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e1e2e' }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{s.category}</span>
                  <span style={{ fontSize: 10, color: '#888', marginLeft: 8 }}>{s.paymentMethod}</span>
                  {s.note && <span style={{ fontSize: 10, color: '#666', marginLeft: 8 }}>{s.note}</span>}
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>${Number(s.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onBack} style={{ marginTop: 20, padding: '10px 0', background: 'transparent', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'center' }}>
          ← {t('scanner_go_back')}
        </button>
      </div>
    </div>
  );
}

function ScannerPageInner() {
  const { user } = useAuth();
  const { t } = useT();
  const searchParams = useSearchParams();

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
  const [staffRole, setStaffRole] = useState('scanner');

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const useNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  // Scanner settings (loaded from organizer settings)
  const [scannerSound, setScannerSound]       = useState(true);
  const [scannerVibrate, setScannerVibrate]   = useState(true);
  const [scannerShowName, setScannerShowName] = useState(true);
  const [scannerMode, setScannerMode]         = useState<'single' | 'continuous'>('single');

  // Online/offline tracking + auto-sync on reconnect
  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      // Auto-sync unsynced scans when connection returns
      if (eventId) {
        const history = loadScanHistory(eventId);
        const unsynced = history.filter(h => !h.synced && h.status === 'admitted');
        if (unsynced.length > 0) {
          syncOfflineScans(eventId, unsynced.map(s => ({
            ticketCode: s.ticketCode, usedAt: new Date().toISOString(), scannedBy: staffName,
          }))).then(count => {
            if (count > 0) {
              const updated = history.map(h => ({ ...h, synced: true }));
              setScanHistory(updated);
              saveScanHistory(eventId, updated);
              showToast(`${count} scan${count > 1 ? 's' : ''} synced automatically`);
            }
          }).catch(() => {});
        }
      }
    };
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setIsOnline(navigator.onLine);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [eventId, staffName]);

  // Real-time ticket status sync — catches tickets used on other devices
  useEffect(() => {
    if (!eventId || !isOnline) return;
    const q = query(collection(db, 'tickets'), where('eventId', '==', eventId), where('status', '==', 'used'));
    const unsub = onSnapshot(q, snap => {
      const usedCodes = new Set(snap.docs.map(d => d.data().ticketCode as string));
      setTickets(prev => {
        const updated = prev.map(t => usedCodes.has(t.ticketCode) ? { ...t, status: 'used' as const } : t);
        saveTicketsLocal(eventId, updated);
        return updated;
      });
    }, () => {});
    return () => unsub();
  }, [eventId, isOnline]);

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
          getDocs(query(collection(db, 'staffAssignments'), where('eventId', '==', eid), where('organizerId', '==', user!.uid))),
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
      showToast(t('scanner_pin_copied'));
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
      setPinError(t('scanner_enter_pin'));
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
        setStaffRole(result.role || 'scanner');
        const localTickets = loadTicketsLocal(eventId);
        const localHistory = loadScanHistory(eventId);
        setTickets(localTickets);
        setScanHistory(localHistory);
        setView(roleToView(result.role || 'scanner'));
      } else if (result.waiting) {
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
              setStaffRole(check.role || 'scanner');
              const localTickets = loadTicketsLocal(eventId);
              const localHistory = loadScanHistory(eventId);
              setTickets(localTickets);
              setScanHistory(localHistory);
              setView(roleToView(check.role || 'scanner'));
            }
          } catch {}
        }, 5000);
      } else {
        setPinError(result.error || t('scanner_wrong_pin'));
      }
    } catch {
      setPinError('Connection error');
    }
  }

  // ─── Download Tickets ──────────────────────────────────────────

  async function handleDownloadTickets() {
    setDownloading(true);
    try {
      const fresh = await downloadEventTickets(eventId);
      setTickets(fresh);
      saveTicketsLocal(eventId, fresh);
      showToast(`${fresh.length} ${t('scanner_downloaded_msg')}`);
    } catch {
      showToast(t('scanner_download_error'), false);
    }
    setDownloading(false);
  }

  // ─── Scan Ticket (offline-first) ──────────────────────────────

  const processTicketCode = useCallback((code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    // The live ticket page appends a rotating window number: "qrData:12345"
    // Strip that suffix so we match the stored qrData correctly
    const trimmedBase = trimmed.includes(':') && !trimmed.startsWith('ANB-')
      ? trimmed.split(':').slice(0, -1).join(':')
      : trimmed;
    const ticket = tickets.find(t =>
      t.ticketCode === trimmed ||
      t.qrData === trimmed ||
      t.qrData === trimmedBase
    );
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (useNativeDetector) {
        detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      }
      setCameraActive(true);
      runScanLoop();
    } catch {
      setCameraError('Pa ka louvri kamera. Otorize akse kamera nan navigate a.');
    }
  }

  function runScanLoop() {
    rafRef.current = requestAnimationFrame(async () => {
      if (!videoRef.current || !videoRef.current.srcObject) return;
      try {
        if (useNativeDetector && detectorRef.current) {
          // Chrome / Android — native BarcodeDetector
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0) {
            processTicketCode(barcodes[0].rawValue as string);
            await new Promise(r => setTimeout(r, 2000));
          }
        } else {
          // Safari / iOS — jsQR fallback via canvas
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code?.data) {
                processTicketCode(code.data);
                await new Promise(r => setTimeout(r, 2000));
              }
            }
          }
        }
      } catch {}
      runScanLoop();
    });
  }

  // ─── Sync ─────────────────────────────────────────────────────

  async function handleSync() {
    const unsynced = scanHistory.filter(h => !h.synced && h.status === 'admitted');
    if (unsynced.length === 0) {
      showToast(t('scanner_all_synced'));
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
      showToast(`${count} ${t('scanner_synced_msg')}`);
    } catch {
      showToast(t('scanner_sync_error'), false);
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
    'admitted':     { bg: '#0a2a0a', border: '#22c55e', color: '#22c55e', icon: '✅', label: t('scanner_result_valid') },
    'already-used': { bg: '#2a1a00', border: '#f97316', color: '#f97316', icon: '⚠️', label: t('scanner_result_used') },
    'not-found':    { bg: '#2a0a0a', border: '#ef4444', color: '#ef4444', icon: '❌', label: t('scanner_result_invalid') },
  };

  // ─── Styles ───────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = { minHeight: '100vh', background: '#0a0a0f', color: '#fff', position: 'relative' };
  const ToastEl = toast ? (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.ok ? '#14532d' : '#450a0a', border: `1px solid ${toast.ok ? '#22c55e' : '#ef4444'}`, color: toast.ok ? '#22c55e' : '#ef4444', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      {toast.ok ? '✅' : '❌'} {toast.msg}
    </div>
  ) : null;
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
              {t('scanner_title')}
            </h1>
            <p style={{ color: '#888', fontSize: 13 }}>
              {t('scanner_enter_pin')}
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
              Enter →
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
            {t('scanner_waiting')}
          </h1>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            Your PIN is correct. The organizer needs to activate you before you can start scanning.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#f97316', fontSize: 13 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', animation: 'pulse 1.5s infinite' }} />
            Checking for authorization...
          </div>
          <button onClick={() => { setView('pin-entry'); setPin(''); }}
            style={{ marginTop: 40, background: 'transparent', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer' }}>
            ← {t('scanner_go_back')}
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
            📱 {t('scanner_select_event')}
          </h1>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>
            {'Which event to manage scanning?'}
          </p>

          {orgEvents.length === 0 && (
            <div style={cardStyle}>
              <p style={{ color: '#666', textAlign: 'center' }}>{t('scanner_no_orgs')}</p>
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
              📷 {t('event_action_scanner')}
            </button>
          </div>

          <div style={{ ...cardStyle, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>👥 {t('scanner_staff_title')}</div>
              <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{'Manage staff from the Staff page'}</div>
            </div>
            <a href={`/organizer/staff?event=${eventId}`}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #f97316', color: '#f97316', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              ➕ {t('org_manage_staff')}
            </a>
          </div>

          <div style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            {t('scanner_staff_title')} ({staffList.length})
          </div>

          {staffList.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <p style={{ color: '#666', fontSize: 13 }}>{'No staff assigned to this event.'}</p>
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
                        ✓ {t('active')}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: '#888', background: '#ffffff08', padding: '2px 8px', borderRadius: 4 }}>
                        {'Not connected yet'}
                      </span>
                    )}
                    {staff.scansCount > 0 && (
                      <span style={{ fontSize: 10, color: '#888' }}>
                        {staff.scansCount} {'scans'} • {staff.admittedCount} ✅ • {staff.deniedCount} ❌
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => shareStaffPin(staff)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${staff.phone ? '#22c55e' : '#f97316'}`, background: staff.phone ? '#22c55e15' : 'transparent', color: staff.phone ? '#22c55e' : '#f97316', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    {staff.phone ? '💬 WhatsApp' : 'Share'}
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button onClick={() => { setEventId(''); setEvent(null); setStaffList([]); setView('organizer-select'); }}
            style={{ marginTop: 16, padding: '10px 0', background: 'transparent', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer' }}>
            ← {t('scanner_go_back')}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // F&B VIEW
  // ═══════════════════════════════════════════════════════════════

  if (view === 'fb') {
    return <FbView eventId={eventId} eventName={event?.name || ''} organizerId={(event as any)?.organizerId || (event as any)?.uid || ''} staffId={staffId} staffName={staffName} onBack={() => setView('pin-entry')} />;
  }

  // ═══════════════════════════════════════════════════════════════
  // SALES VIEW
  // ═══════════════════════════════════════════════════════════════

  if (view === 'sales') {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>💰</div>
          <p style={{ color: '#888', fontSize: 14 }}>{'Ticket sales — Coming soon'}</p>
          <button onClick={() => setView('pin-entry')} style={{ marginTop: 24, background: 'transparent', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer' }}>← {t('scanner_go_back')}</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECURITY VIEW
  // ═══════════════════════════════════════════════════════════════

  if (view === 'security') {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🛡️</div>
          <p style={{ color: '#888', fontSize: 14 }}>{'Incident reports — Coming soon'}</p>
          <button onClick={() => setView('pin-entry')} style={{ marginTop: 24, background: 'transparent', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer' }}>← {t('scanner_go_back')}</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // MANAGER VIEW
  // ═══════════════════════════════════════════════════════════════

  if (view === 'manager') {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🧑‍💼</div>
          <p style={{ color: '#888', fontSize: 14 }}>{'Manager dashboard — Coming soon'}</p>
          <button onClick={() => setView('pin-entry')} style={{ marginTop: 24, background: 'transparent', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer' }}>← {t('scanner_go_back')}</button>
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
      {ToastEl}
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

        {/* No tickets warning */}
        {tickets.length === 0 && (
          <div style={{ background: '#2a1500', border: '1px solid #f97316', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ color: '#f97316', fontWeight: 700, fontSize: 13 }}>⚠️ Tikè pa telechaje</div>
              <div style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>Download tickets now while you have internet — scanning won't work offline without them.</div>
            </div>
            <button onClick={handleDownloadTickets} disabled={downloading || !isOnline} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#f97316', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {downloading ? '...' : '⬇️ Download'}
            </button>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div style={{ ...cardStyle, padding: 12, textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{t('scanner_stats_scanned')}</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{stats.total}</div>
          </div>
          <div style={{ ...cardStyle, padding: 12, textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{t('scanner_stats_admitted')}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e' }}>{stats.admitted}</div>
          </div>
          <div style={{ ...cardStyle, padding: 12, textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{t('scanner_stats_denied')}</div>
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
            {downloading ? '...' : `⬇️ ${t('scanner_download')} (${stats.downloaded})`}
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
            {syncing ? '...' : `🔄 ${t('scanner_sync')} (${stats.unsynced})`}
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
              <span style={{ color: '#888', fontSize: 12 }}>{'Seat'} {lastScan.seat}</span>
            </div>
            <div style={{ color: '#555', fontSize: 10, fontFamily: 'monospace', marginTop: 8 }}>{lastScan.ticketCode}</div>
          </div>
        )}

        {/* Camera view */}
        {cameraActive && (
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <video ref={videoRef} playsInline muted
              style={{ width: '100%', borderRadius: 12, border: '2px solid #f97316', display: 'block', maxHeight: 300, objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 180, height: 180, border: '2px solid #f97316', borderRadius: 12, pointerEvents: 'none', boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
            <button onClick={stopCamera} style={{ position: 'absolute', top: 8, right: 8, padding: '6px 12px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              ✕ {t('close')}
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
              ? `⏹ ${'Stop Scanning'}`
              : `📷 ${lastScan ? 'Scan Again' : t('scanner_scan_qr')}`}
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
              {t('scanner_or_enter_code')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={manualCode} onChange={e => setManualCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleManualScan()}
                placeholder="ANB-XXXX..." style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 14, fontFamily: 'monospace' }} />
              <button onClick={handleManualScan} style={{ padding: '12px 20px', borderRadius: 8, border: 'none', background: '#f97316', color: '#000', fontWeight: 700, cursor: 'pointer' }}>
                {'Check'}
              </button>
            </div>
          </div>
        )}

        {/* Scan history */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: '#888', margin: 0 }}>{'Scan History'}</h3>
            {stats.unsynced > 0 && <span style={{ fontSize: 10, color: '#f97316' }}>{stats.unsynced} {'not synced'}</span>}
          </div>

          {scanHistory.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: 13 }}>{'No scans yet'}</p>
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
            ← {t('scanner_go_back')}
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
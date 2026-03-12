'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getOrganizerEvents, type EventData } from '@/lib/db';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, query, where,
  doc, setDoc, deleteDoc, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { useOrganizerEvent } from '../OrganizerEventContext';

// ─── Types ───────────────────────────────────────────────────────

type StaffRole = 'scanner' | 'door' | 'sales' | 'security' | 'fb' | 'manager';
type PageTab   = 'overview' | 'pool' | 'assignments' | 'performance';

// Role-specific settings stored on the pool member
interface ScannerSettings  { deviceLock: boolean; sectionsAllowed: string[]; canOverride: boolean; }
interface DoorSettings     { entrance: string; seeCapacity: boolean; manualAdmit: boolean; }
interface SalesSettings    { commissionPct: number; sectionsAllowed: string[]; payMethods: string[]; salesTarget: number; }
interface SecuritySettings { zone: string; incidentAccess: boolean; canEject: boolean; }
interface FbSettings       { categories: string[]; salesLogging: boolean; cashHandling: boolean; }
interface ManagerSettings  { canManageStaff: boolean; canOverrideScanner: boolean; revenueAccess: boolean; fullDashboard: boolean; }

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: StaffRole;
  pin: string;
  organizerId: string;
  settings?: ScannerSettings | DoorSettings | SalesSettings | SecuritySettings | FbSettings | ManagerSettings;
  createdAt?: any;
}

interface StaffAssignment {
  id: string;
  staffId: string;
  eventId: string;
  organizerId: string;
  active: boolean;
  role: StaffRole;
  assignedAt?: any;
}

// ─── Role definitions ────────────────────────────────────────────

const ROLES: { key: StaffRole; icon: string; ht: string; en: string; fr: string; color: string; border: string }[] = [
  { key: 'scanner',  icon: '📱', ht: 'Eskanè',         en: 'Scanner',       fr: 'Scanner',      color: 'text-cyan',     border: 'border-cyan/30 bg-cyan/5' },
  { key: 'door',     icon: '🚪', ht: 'Pòt',            en: 'Door',          fr: 'Porte',         color: 'text-green',    border: 'border-green/30 bg-green/5' },
  { key: 'sales',    icon: '💰', ht: 'Vant',           en: 'Sales',         fr: 'Ventes',        color: 'text-yellow',   border: 'border-yellow/30 bg-yellow/5' },
  { key: 'security', icon: '🛡️', ht: 'Sekirite',       en: 'Security',      fr: 'Sécurité',      color: 'text-blue-400', border: 'border-blue-400/30 bg-blue-400/5' },
  { key: 'fb',       icon: '🍽️', ht: 'Manje & Bweson', en: 'Food & Drinks', fr: 'Restauration',  color: 'text-purple',   border: 'border-purple/30 bg-purple/5' },
  { key: 'manager',  icon: '🧑‍💼', ht: 'Manadjè',        en: 'Manager',       fr: 'Gestionnaire', color: 'text-orange',   border: 'border-orange/30 bg-orange/5' },
];

const DEFAULT_SETTINGS: Record<StaffRole, any> = {
  scanner:  { deviceLock: true,  sectionsAllowed: ['all'], canOverride: false },
  door:     { entrance: 'Main',  seeCapacity: true, manualAdmit: false },
  sales:    { commissionPct: 0,  sectionsAllowed: ['all'], payMethods: ['cash'], salesTarget: 0 },
  security: { zone: 'Entrance',  incidentAccess: true, canEject: false },
  fb:       { categories: ['all'], salesLogging: true, cashHandling: true },
  manager:  { canManageStaff: true, canOverrideScanner: true, revenueAccess: true, fullDashboard: true },
};

const roleInfo = (key: StaffRole) => ROLES.find(r => r.key === key)!;

// ─── Settings editors ─────────────────────────────────────────────

function ScannerSettingsEditor({ s, onChange }: { s: ScannerSettings; onChange: (v: ScannerSettings) => void }) {
  const sections = ['GA', 'VIP', 'VVIP'];
  return (
    <div className="space-y-3">
      <Toggle label="Device Lock" value={s.deviceLock} onChange={v => onChange({ ...s, deviceLock: v })} hint="One device per session" />
      <Toggle label="Can Override" value={s.canOverride} onChange={v => onChange({ ...s, canOverride: v })} hint="Allow scanning invalid tickets" />
      <div>
        <p className="text-[10px] font-semibold text-gray-light mb-1.5">Sections Allowed</p>
        <div className="flex gap-2 flex-wrap">
          {['all', ...sections].map(sec => (
            <button key={sec} onClick={() => {
              const cur = s.sectionsAllowed;
              const next = sec === 'all' ? ['all'] : cur.includes(sec) ? cur.filter(x => x !== sec) : [...cur.filter(x => x !== 'all'), sec];
              onChange({ ...s, sectionsAllowed: next.length ? next : ['all'] });
            }} className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${s.sectionsAllowed.includes(sec) ? 'bg-cyan/20 text-cyan border-cyan/40' : 'border-border text-gray-muted hover:text-white'}`}>
              {sec === 'all' ? '✓ All' : sec}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DoorSettingsEditor({ s, onChange }: { s: DoorSettings; onChange: (v: DoorSettings) => void }) {
  const entrances = ['Main', 'Side', 'VIP', 'Staff', 'Backstage'];
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold text-gray-light mb-1.5">Entrance</p>
        <div className="flex gap-2 flex-wrap">
          {entrances.map(e => (
            <button key={e} onClick={() => onChange({ ...s, entrance: e })}
              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${s.entrance === e ? 'bg-green/20 text-green border-green/40' : 'border-border text-gray-muted hover:text-white'}`}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <Toggle label="See Capacity Counter" value={s.seeCapacity} onChange={v => onChange({ ...s, seeCapacity: v })} />
      <Toggle label="Manual Admit" value={s.manualAdmit} onChange={v => onChange({ ...s, manualAdmit: v })} hint="Can admit without scanning" />
    </div>
  );
}

function SalesSettingsEditor({ s, onChange }: { s: SalesSettings; onChange: (v: SalesSettings) => void }) {
  const sections = ['GA', 'VIP', 'VVIP'];
  const payMethods = ['Cash', 'MonCash', 'Natcash', 'Card'];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold text-gray-light mb-1.5">Commission %</p>
          <input type="number" min={0} max={50} value={s.commissionPct}
            onChange={e => onChange({ ...s, commissionPct: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-xs outline-none focus:border-orange" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-light mb-1.5">Sales Target ($)</p>
          <input type="number" min={0} value={s.salesTarget}
            onChange={e => onChange({ ...s, salesTarget: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-xs outline-none focus:border-orange" />
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-light mb-1.5">Sections Allowed</p>
        <div className="flex gap-2 flex-wrap">
          {['all', ...sections].map(sec => (
            <button key={sec} onClick={() => {
              const cur = s.sectionsAllowed;
              const next = sec === 'all' ? ['all'] : cur.includes(sec) ? cur.filter(x => x !== sec) : [...cur.filter(x => x !== 'all'), sec];
              onChange({ ...s, sectionsAllowed: next.length ? next : ['all'] });
            }} className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${s.sectionsAllowed.includes(sec) ? 'bg-yellow/20 text-yellow border-yellow/40' : 'border-border text-gray-muted hover:text-white'}`}>
              {sec === 'all' ? '✓ All' : sec}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-light mb-1.5">Payment Methods</p>
        <div className="flex gap-2 flex-wrap">
          {payMethods.map(m => (
            <button key={m} onClick={() => {
              const cur = s.payMethods;
              onChange({ ...s, payMethods: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] });
            }} className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${s.payMethods.includes(m) ? 'bg-yellow/20 text-yellow border-yellow/40' : 'border-border text-gray-muted hover:text-white'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SecuritySettingsEditor({ s, onChange }: { s: SecuritySettings; onChange: (v: SecuritySettings) => void }) {
  const zones = ['Entrance', 'Floor', 'VIP', 'Backstage', 'Parking', 'Stage'];
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold text-gray-light mb-1.5">Zone</p>
        <div className="flex gap-2 flex-wrap">
          {zones.map(z => (
            <button key={z} onClick={() => onChange({ ...s, zone: z })}
              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${s.zone === z ? 'bg-blue-400/20 text-blue-400 border-blue-400/40' : 'border-border text-gray-muted hover:text-white'}`}>
              {z}
            </button>
          ))}
        </div>
      </div>
      <Toggle label="Incident Report Access" value={s.incidentAccess} onChange={v => onChange({ ...s, incidentAccess: v })} />
      <Toggle label="Can Eject Attendees" value={s.canEject} onChange={v => onChange({ ...s, canEject: v })} hint="High trust — enable carefully" warn />
    </div>
  );
}

function FbSettingsEditor({ s, onChange }: { s: FbSettings; onChange: (v: FbSettings) => void }) {
  const cats = ['Food', 'Drinks', 'Merch'];
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold text-gray-light mb-1.5">Categories Managed</p>
        <div className="flex gap-2 flex-wrap">
          {['all', ...cats].map(c => (
            <button key={c} onClick={() => {
              const cur = s.categories;
              const next = c === 'all' ? ['all'] : cur.includes(c) ? cur.filter(x => x !== c) : [...cur.filter(x => x !== 'all'), c];
              onChange({ ...s, categories: next.length ? next : ['all'] });
            }} className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${s.categories.includes(c) ? 'bg-purple/20 text-purple border-purple/40' : 'border-border text-gray-muted hover:text-white'}`}>
              {c === 'all' ? '✓ All' : c}
            </button>
          ))}
        </div>
      </div>
      <Toggle label="Sales Logging" value={s.salesLogging} onChange={v => onChange({ ...s, salesLogging: v })} hint="Required for F&B analytics" />
      <Toggle label="Cash Handling" value={s.cashHandling} onChange={v => onChange({ ...s, cashHandling: v })} />
    </div>
  );
}

function ManagerSettingsEditor({ s, onChange }: { s: ManagerSettings; onChange: (v: ManagerSettings) => void }) {
  return (
    <div className="space-y-3">
      <Toggle label="Can Manage Staff"       value={s.canManageStaff}       onChange={v => onChange({ ...s, canManageStaff: v })}       hint="Activate/deactivate team" />
      <Toggle label="Can Override Scanner"   value={s.canOverrideScanner}   onChange={v => onChange({ ...s, canOverrideScanner: v })}   hint="Force-admit guests" warn />
      <Toggle label="Revenue Visibility"     value={s.revenueAccess}        onChange={v => onChange({ ...s, revenueAccess: v })}        hint="See sales numbers" />
      <Toggle label="Full Dashboard Access"  value={s.fullDashboard}        onChange={v => onChange({ ...s, fullDashboard: v })}        hint="All organizer pages" warn />
    </div>
  );
}

function Toggle({ label, value, onChange, hint, warn }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className={`text-[11px] font-semibold ${warn ? 'text-orange' : 'text-white'}`}>{label}</p>
        {hint && <p className="text-[9px] text-gray-muted">{hint}</p>}
      </div>
      <button onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-all flex-shrink-0 relative ${value ? (warn ? 'bg-orange' : 'bg-green-500') : 'bg-white/[0.1]'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function RoleSettingsEditor({ role, settings, onChange }: { role: StaffRole; settings: any; onChange: (v: any) => void }) {
  switch (role) {
    case 'scanner':  return <ScannerSettingsEditor  s={settings} onChange={onChange} />;
    case 'door':     return <DoorSettingsEditor     s={settings} onChange={onChange} />;
    case 'sales':    return <SalesSettingsEditor    s={settings} onChange={onChange} />;
    case 'security': return <SecuritySettingsEditor s={settings} onChange={onChange} />;
    case 'fb':       return <FbSettingsEditor       s={settings} onChange={onChange} />;
    case 'manager':  return <ManagerSettingsEditor  s={settings} onChange={onChange} />;
  }
}

// ─── Main page ───────────────────────────────────────────────────

export default function OrganizerStaffPage() {
  const { user }   = useAuth();
  const { locale } = useT();
  const L  = (ht: string, en: string, fr: string) => ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;
  const RL = (r: { ht: string; en: string; fr: string }) => locale === 'ht' ? r.ht : locale === 'fr' ? r.fr : r.en;

  const { selectedEvent } = useOrganizerEvent();
  const searchParams = useSearchParams();
  const eventParam   = searchParams.get('event');

  const [tab, setTab]                   = useState<PageTab>('overview');
  const [poolTab, setPoolTab]           = useState<StaffRole>('scanner');
  const [events, setEvents]             = useState<EventData[]>([]);
  const [pool, setPool]                 = useState<StaffMember[]>([]);
  const [assignments, setAssignments]   = useState<StaffAssignment[]>([]);
  const [tickets, setTickets]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // Pool form
  const [showPoolForm, setShowPoolForm] = useState(false);
  const [poolForm, setPoolForm]         = useState({ name: '', phone: '', role: poolTab });
  const [poolFormSettings, setPoolFormSettings] = useState<any>(DEFAULT_SETTINGS[poolTab]);

  // Assignment form
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm]     = useState({ staffId: '', eventId: eventParam || selectedEvent?.id || '', role: 'scanner' as StaffRole });

  const generatePin = () => Math.floor(100000 + Math.random() * 900000).toString();

  // ── Load ──
  const loadAll = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const [evs, poolSnap, assignSnap] = await Promise.all([
        getOrganizerEvents(user.uid),
        getDocs(query(collection(db, 'staffPool'), where('organizerId', '==', user.uid))),
        getDocs(query(collection(db, 'staffAssignments'), where('organizerId', '==', user.uid))),
      ]);
      setEvents(evs);
      setPool(poolSnap.docs.map(d => ({ id: d.id, ...d.data() } as StaffMember)));
      setAssignments(assignSnap.docs.map(d => ({ id: d.id, ...d.data() } as StaffAssignment)));
      const tix: any[] = [];
      await Promise.all(evs.map(async e => {
        if (!e.id) return;
        const snap = await getDocs(collection(db, 'events', e.id, 'tickets'));
        snap.docs.forEach(d => tix.push({ id: d.id, eventId: e.id, ...d.data() }));
      }));
      setTickets(tix);
    } catch (err) { console.error('staff load', err); }
    finally { setLoading(false); }
  }, [user?.uid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Sync form role when pool tab changes
  useEffect(() => {
    setPoolForm(f => ({ ...f, role: poolTab }));
    setPoolFormSettings(DEFAULT_SETTINGS[poolTab]);
  }, [poolTab]);

  // ── Pool CRUD ──
  const handleAddToPool = async () => {
    if (!poolForm.name || !poolForm.phone || !user?.uid) return;
    setSaving(true);
    try {
      const id = `sp_${Date.now()}`;
      const member = { ...poolForm, pin: generatePin(), settings: poolFormSettings, organizerId: user.uid, createdAt: serverTimestamp() };
      await setDoc(doc(db, 'staffPool', id), member);
      setPool(prev => [...prev, { id, ...member }]);
      setPoolForm({ name: '', phone: '', role: poolTab });
      setPoolFormSettings(DEFAULT_SETTINGS[poolTab]);
      setShowPoolForm(false);
    } finally { setSaving(false); }
  };

  const handleSaveSettings = async (member: StaffMember, settings: any) => {
    await updateDoc(doc(db, 'staffPool', member.id), { settings });
    setPool(prev => prev.map(s => s.id === member.id ? { ...s, settings } : s));
  };

  const handleDeleteFromPool = async (id: string) => {
    if (!confirm(L('Retire moun sa?', 'Remove this person?', 'Retirer cette personne?'))) return;
    await deleteDoc(doc(db, 'staffPool', id));
    setPool(prev => prev.filter(s => s.id !== id));
    const toRemove = assignments.filter(a => a.staffId === id);
    await Promise.all(toRemove.map(a => deleteDoc(doc(db, 'staffAssignments', a.id))));
    setAssignments(prev => prev.filter(a => a.staffId !== id));
  };

  const handleRegenPin = async (member: StaffMember) => {
    const pin = generatePin();
    await updateDoc(doc(db, 'staffPool', member.id), { pin });
    setPool(prev => prev.map(s => s.id === member.id ? { ...s, pin } : s));
  };

  // ── Assignment CRUD ──
  const handleAssign = async () => {
    if (!assignForm.staffId || !assignForm.eventId || !user?.uid) return;
    if (assignments.find(a => a.staffId === assignForm.staffId && a.eventId === assignForm.eventId)) return;
    setSaving(true);
    try {
      const id = `sa_${Date.now()}`;
      const member = pool.find(p => p.id === assignForm.staffId);
      const assignment = { staffId: assignForm.staffId, eventId: assignForm.eventId, organizerId: user.uid, role: assignForm.role || member?.role || 'scanner', active: false, assignedAt: serverTimestamp() };
      await setDoc(doc(db, 'staffAssignments', id), assignment);
      setAssignments(prev => [...prev, { id, ...assignment }]);
      setShowAssignForm(false);
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (a: StaffAssignment) => {
    await updateDoc(doc(db, 'staffAssignments', a.id), { active: !a.active });
    setAssignments(prev => prev.map(x => x.id === a.id ? { ...x, active: !x.active } : x));
  };

  const handleRemoveAssignment = async (id: string) => {
    await deleteDoc(doc(db, 'staffAssignments', id));
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  // ── Computed ──
  const focusEventId = eventParam || selectedEvent?.id;
  const focusEvent   = events.find(e => e.id === focusEventId);
  const overviewEvents = focusEventId ? events.filter(e => e.id === focusEventId) : events;
  const getAssigned  = (eventId: string, role?: StaffRole) => assignments.filter(a => a.eventId === eventId && (!role || a.role === role));
  const getActive    = (eventId: string, role?: StaffRole) => getAssigned(eventId, role).filter(a => a.active);
  const getStaffScans = (staffId: string) => tickets.filter(t => t.scannedBy === staffId && t.status === 'used').length;

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div>
      {/* ── Page tabs ── */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {([
          ['overview',    '📊', L('Apèsi',     'Overview',    'Aperçu')],
          ['pool',        '👥', L('Pool',       'Pool',        'Pool')],
          ['assignments', '📋', L('Asiyman',    'Assignments', 'Assignations')],
          ['performance', '📈', L('Pèfòmans',   'Performance', 'Performance')],
        ] as const).map(([key, icon, label]) => (
          <button key={key} onClick={() => setTab(key as PageTab)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${tab === key ? 'border-orange text-orange' : 'border-transparent text-gray-muted hover:text-white'}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══ */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {overviewEvents.length === 0 ? (
            <div className="bg-dark-card border border-border rounded-card p-10 text-center">
              <p className="text-gray-muted text-sm">{L('Pa gen evènman.', 'No events.', 'Aucun événement.')}</p>
            </div>
          ) : overviewEvents.map(ev => {
            const evAssigned = getAssigned(ev.id!);
            const evActive   = getActive(ev.id!);
            const evTickets  = tickets.filter(t => t.eventId === ev.id && t.status !== 'cancelled');
            const evScanned  = evTickets.filter(t => t.status === 'used').length;
            return (
              <div key={ev.id} className="bg-dark-card border border-border rounded-card overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div>
                    <p className="font-bold">{ev.name}</p>
                    <p className="text-[10px] text-gray-muted">📅 {ev.startDate || '—'}</p>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div><p className="text-[9px] text-gray-muted uppercase">{L('Asiyen', 'Assigned', 'Assignés')}</p><p className="font-bold">{evAssigned.length}</p></div>
                    <div><p className="text-[9px] text-gray-muted uppercase">{L('Aktif', 'Active', 'Actifs')}</p><p className="font-bold text-green">{evActive.length}</p></div>
                    <div><p className="text-[9px] text-gray-muted uppercase">{L('Eskane', 'Scanned', 'Scannés')}</p><p className="font-bold text-cyan">{evScanned}/{evTickets.length}</p></div>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-border">
                  {ROLES.map(r => {
                    const ra = getAssigned(ev.id!, r.key);
                    const rx = getActive(ev.id!, r.key);
                    return (
                      <div key={r.key} className="p-3 text-center">
                        <p className="text-lg mb-1">{r.icon}</p>
                        <p className={`text-[9px] uppercase font-bold mb-1 ${r.color}`}>{RL(r)}</p>
                        <p className="font-bold">{ra.length}</p>
                        {ra.length > 0 && <p className="text-[9px] text-green">{rx.length} on</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ POOL ══ */}
      {tab === 'pool' && (
        <div>
          {/* Role category tabs */}
          <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
            {ROLES.map(r => {
              const count = pool.filter(s => s.role === r.key).length;
              return (
                <button key={r.key} onClick={() => setPoolTab(r.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border ${
                    poolTab === r.key ? `${r.border} ${r.color}` : 'border-border text-gray-muted hover:text-white'
                  }`}>
                  {r.icon} {RL(r)}
                  <span className="bg-white/[0.08] px-1.5 py-0.5 rounded-full text-[9px]">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Role description + add button */}
          <div className="flex items-center justify-between mb-4">
            <div>
              {(() => {
                const r = roleInfo(poolTab);
                const descriptions: Record<StaffRole, string> = {
                  scanner:  L('Eskane tikè nan antre', 'Scan tickets at entry', 'Scanner les billets à l\'entrée'),
                  door:     L('Jere antre ak flou', 'Manage entry flow', 'Gérer le flux d\'entrée'),
                  sales:    L('Vann tikè ak pwen vant', 'Sell tickets at POS', 'Vendre des billets au point de vente'),
                  security: L('Sekirize evènman an', 'Secure the event', 'Sécuriser l\'événement'),
                  fb:       L('Jere manje ak bweson', 'Manage food & drinks', 'Gérer nourriture et boissons'),
                  manager:  L('Sipèvize tout operasyon', 'Supervise all operations', 'Superviser toutes les opérations'),
                };
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{r.icon}</span>
                    <div>
                      <p className={`text-sm font-bold ${r.color}`}>{RL(r)}</p>
                      <p className="text-[10px] text-gray-muted">{descriptions[poolTab]}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
            <button onClick={() => setShowPoolForm(!showPoolForm)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
              ➕ {L('Ajoute', 'Add', 'Ajouter')} {RL(roleInfo(poolTab))}
            </button>
          </div>

          {/* Add form */}
          {showPoolForm && (
            <div className="bg-dark-card border border-orange-border rounded-card p-5 mb-5">
              <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">
                {roleInfo(poolTab).icon} {L('NOUVO', 'NEW', 'NOUVEAU')} {RL(roleInfo(poolTab)).toUpperCase()}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Non', 'Name', 'Nom')} *</label>
                  <input value={poolForm.name} onChange={e => setPoolForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Jean Pierre"
                    className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Telefòn', 'Phone', 'Téléphone')} *</label>
                  <input value={poolForm.phone} onChange={e => setPoolForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+509 ..."
                    className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" />
                </div>
              </div>
              {/* Role-specific settings */}
              <div className="border border-border rounded-xl p-4 mb-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-muted font-bold mb-3">{L('Paramèt Wòl', 'Role Settings', 'Paramètres du rôle')}</p>
                <RoleSettingsEditor role={poolTab} settings={poolFormSettings} onChange={setPoolFormSettings} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddToPool} disabled={saving || !poolForm.name || !poolForm.phone}
                  className="px-5 py-2.5 rounded-[10px] bg-orange text-white text-xs font-bold disabled:opacity-50 hover:bg-orange/80 transition-all">
                  {saving ? '...' : L('Ajoute', 'Add', 'Ajouter')}
                </button>
                <button onClick={() => setShowPoolForm(false)}
                  className="px-5 py-2.5 rounded-[10px] border border-border text-xs font-bold text-gray-light hover:text-white transition-all">
                  {L('Anile', 'Cancel', 'Annuler')}
                </button>
              </div>
            </div>
          )}

          {/* Pool members for this role */}
          {pool.filter(s => s.role === poolTab).length === 0 ? (
            <div className="bg-dark-card border border-border rounded-card p-10 text-center">
              <p className="text-4xl mb-2">{roleInfo(poolTab).icon}</p>
              <p className="text-gray-muted text-sm">{L('Pa gen moun nan kategori sa.', 'No one in this category yet.', 'Personne dans cette catégorie.')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pool.filter(s => s.role === poolTab).map(s => {
                const r = roleInfo(s.role);
                const isExpanded = expandedMember === s.id;
                const evCount = assignments.filter(a => a.staffId === s.id).length;
                const [localSettings, setLocalSettings] = useState<any>(s.settings || DEFAULT_SETTINGS[s.role]);

                return (
                  <div key={s.id} className={`bg-dark-card border rounded-card overflow-hidden transition-all ${isExpanded ? `${r.border}` : 'border-border'}`}>
                    {/* Member header */}
                    <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedMember(isExpanded ? null : s.id)}>
                      <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center text-xl flex-shrink-0">{r.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold">{s.name}</p>
                        <p className="text-[11px] text-gray-light">{s.phone}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[9px] text-gray-muted">PIN: <span className="font-mono font-bold text-white tracking-widest">{s.pin}</span></span>
                          <button onClick={e => { e.stopPropagation(); handleRegenPin(s); }}
                            className="text-[9px] text-gray-muted hover:text-orange transition-colors">↻</button>
                          <span className="text-[9px] text-gray-muted">{evCount} {L('evèn', 'events', 'évén.')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); setAssignForm(f => ({ ...f, staffId: s.id, role: s.role })); setShowAssignForm(true); setTab('assignments'); }}
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold border border-border text-gray-light hover:text-orange hover:border-orange transition-all">
                          📋 {L('Asiyen', 'Assign', 'Assigner')}
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteFromPool(s.id); }}
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold border border-border text-gray-muted hover:text-red hover:border-red/30 transition-all">
                          🗑
                        </button>
                        <span className={`text-gray-muted text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </div>

                    {/* Expanded: role settings */}
                    {isExpanded && (
                      <div className="border-t border-border p-4">
                        <p className="text-[10px] uppercase tracking-widest text-gray-muted font-bold mb-3">{L('Paramèt', 'Settings', 'Paramètres')} · {RL(r)}</p>
                        <RoleSettingsEditor role={s.role} settings={localSettings} onChange={setLocalSettings} />
                        <button onClick={() => handleSaveSettings(s, localSettings)}
                          className="mt-4 px-4 py-2 rounded-lg bg-orange text-white text-[10px] font-bold hover:bg-orange/80 transition-all">
                          💾 {L('Sove Paramèt', 'Save Settings', 'Sauvegarder')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ ASSIGNMENTS ══ */}
      {tab === 'assignments' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-light">
              {assignments.length} {L('total', 'total', 'total')} · {assignments.filter(a => a.active).length} {L('aktif', 'active', 'actifs')}
            </p>
            <button onClick={() => setShowAssignForm(!showAssignForm)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
              ➕ {L('Nouvo Asiyman', 'New Assignment', 'Nouvelle Assignation')}
            </button>
          </div>

          {showAssignForm && (
            <div className="bg-dark-card border border-orange-border rounded-card p-5 mb-5">
              <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">{L('ASIYEN AK EVÈNMAN', 'ASSIGN TO EVENT', 'ASSIGNER À ÉVÉNEMENT')}</p>
              <p className="text-[10px] text-gray-muted mb-3">💡 {L('Staff ap dezaktive — aktive yo jou evènman an.', 'Staff starts inactive — activate on event day.', 'Inactif par défaut — activez le jour J.')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Moun', 'Person', 'Personne')} *</label>
                  <select value={assignForm.staffId} onChange={e => {
                    const m = pool.find(p => p.id === e.target.value);
                    setAssignForm(f => ({ ...f, staffId: e.target.value, role: m?.role || f.role }));
                  }} className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange">
                    <option value="">{L('Chwazi...', 'Choose...', 'Choisir...')}</option>
                    {ROLES.map(r => {
                      const rpool = pool.filter(p => p.role === r.key);
                      if (rpool.length === 0) return null;
                      return (
                        <optgroup key={r.key} label={`${r.icon} ${RL(r)}`}>
                          {rpool.map(p => <option key={p.id} value={p.id} className="bg-dark-card">{p.name}</option>)}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Evènman', 'Event', 'Événement')} *</label>
                  <select value={assignForm.eventId} onChange={e => setAssignForm(f => ({ ...f, eventId: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange">
                    <option value="">{L('Chwazi...', 'Choose...', 'Choisir...')}</option>
                    {events.map(e => <option key={e.id} value={e.id!} className="bg-dark-card">{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Wòl', 'Role', 'Rôle')}</label>
                  <select value={assignForm.role} onChange={e => setAssignForm(f => ({ ...f, role: e.target.value as StaffRole }))}
                    className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange">
                    {ROLES.map(r => <option key={r.key} value={r.key} className="bg-dark-card">{r.icon} {RL(r)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAssign} disabled={saving || !assignForm.staffId || !assignForm.eventId}
                  className="px-5 py-2.5 rounded-[10px] bg-orange text-white text-xs font-bold disabled:opacity-50 hover:bg-orange/80 transition-all">
                  {saving ? '...' : L('Asiyen', 'Assign', 'Assigner')}
                </button>
                <button onClick={() => setShowAssignForm(false)}
                  className="px-5 py-2.5 rounded-[10px] border border-border text-xs font-bold text-gray-light hover:text-white transition-all">
                  {L('Anile', 'Cancel', 'Annuler')}
                </button>
              </div>
            </div>
          )}

          {events.map(ev => {
            const evA = assignments.filter(a => a.eventId === ev.id);
            if (evA.length === 0) return null;
            return (
              <div key={ev.id} className="mb-5">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                  <p className="text-sm font-bold">{ev.name}</p>
                  <span className="text-[10px] text-gray-muted">{evA.filter(a => a.active).length}/{evA.length} {L('aktif', 'active', 'actifs')}</span>
                </div>
                <div className="space-y-2">
                  {evA.map(a => {
                    const member = pool.find(p => p.id === a.staffId);
                    const r = roleInfo(a.role);
                    return (
                      <div key={a.id} className={`bg-dark-card border rounded-card p-3.5 flex items-center gap-3 transition-all ${a.active ? 'border-green/30' : 'border-border'}`}>
                        <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-base flex-shrink-0">{r.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold">{member?.name || L('Efase', 'Deleted', 'Supprimé')}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${r.border} ${r.color}`}>{RL(r)}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${a.active ? 'bg-green-dim text-green' : 'bg-white/[0.05] text-gray-muted'}`}>
                              {a.active ? L('AKTIF', 'ACTIVE', 'ACTIF') : L('INAKTIF', 'INACTIVE', 'INACTIF')}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-muted">{member?.phone} · PIN: <span className="font-mono font-bold text-white">{member?.pin}</span></p>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleToggleActive(a)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
                              a.active ? 'border-border text-gray-light hover:text-red hover:border-red/30' : 'border-green text-green bg-green-dim hover:bg-green hover:text-white'
                            }`}>
                            {a.active ? L('Dezaktive', 'Deactivate', 'Désactiver') : L('Aktive', 'Activate', 'Activer')}
                          </button>
                          <button onClick={() => handleRemoveAssignment(a.id)}
                            className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold border border-border text-gray-muted hover:text-red hover:border-red/30 transition-all">
                            🗑
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {assignments.length === 0 && (
            <div className="bg-dark-card border border-border rounded-card p-12 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-muted text-sm">{L('Pa gen asiyman ankò.', 'No assignments yet.', 'Aucune assignation encore.')}</p>
            </div>
          )}
        </div>
      )}

      {/* ══ PERFORMANCE ══ */}
      {tab === 'performance' && (
        <div>
          {/* Role filter */}
          <div className="flex gap-1 mb-4 overflow-x-auto">
            {ROLES.map(r => {
              const count = pool.filter(s => s.role === r.key).length;
              if (count === 0) return null;
              return (
                <button key={r.key} onClick={() => setPoolTab(r.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border whitespace-nowrap transition-all ${
                    poolTab === r.key ? `${r.border} ${r.color}` : 'border-border text-gray-muted hover:text-white'
                  }`}>
                  {r.icon} {RL(r)} <span className="bg-white/[0.08] px-1 rounded text-[9px]">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {pool.filter(s => s.role === poolTab).map(s => {
              const r       = roleInfo(s.role);
              const myA     = assignments.filter(a => a.staffId === s.id);
              const scans   = getStaffScans(s.id);
              const evNames = myA.map(a => events.find(e => e.id === a.eventId)?.name).filter(Boolean);
              return (
                <div key={s.id} className="bg-dark-card border border-border rounded-card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center text-xl">{r.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold">{s.name}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${r.border} ${r.color}`}>{RL(r)}</span>
                      </div>
                      <p className="text-[10px] text-gray-muted">{s.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-muted">{L('Evèn', 'Events', 'Évén.')}</p>
                      <p className="font-bold">{myA.length} <span className="text-green text-[10px]">({myA.filter(a => a.active).length} on)</span></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                      <p className="text-[9px] text-gray-muted uppercase mb-1">📱 {L('Eskane', 'Scanned', 'Scannés')}</p>
                      <p className={`font-heading text-2xl ${scans > 0 ? 'text-cyan' : 'text-gray-muted'}`}>{scans}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                      <p className="text-[9px] text-gray-muted uppercase mb-1">📅 {L('Evèn', 'Events', 'Évén.')}</p>
                      <p className="font-heading text-2xl">{myA.length}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                      <p className="text-[9px] text-gray-muted uppercase mb-1">🍽️ F&B</p>
                      <p className="font-heading text-2xl text-gray-muted">—</p>
                    </div>
                  </div>
                  {evNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
                      {evNames.map((name, i) => <span key={i} className="px-2 py-0.5 rounded bg-white/[0.05] text-[9px] text-gray-light">{name}</span>)}
                    </div>
                  )}
                </div>
              );
            })}
            {pool.filter(s => s.role === poolTab).length === 0 && (
              <div className="bg-dark-card border border-border rounded-card p-10 text-center">
                <p className="text-gray-muted text-sm">{L('Pa gen done.', 'No data.', 'Aucune donnée.')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
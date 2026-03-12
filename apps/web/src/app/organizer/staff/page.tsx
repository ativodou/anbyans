'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getOrganizerEvents, type EventData } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: 'scanner' | 'door' | 'manager';
  pin: string;
  eventIds: string[];
  active: boolean;
  createdAt?: any;
}

export default function OrganizerStaffPage() {
  const { user } = useAuth();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    role: 'scanner' as StaffMember['role'],
    eventIds: [] as string[],
  });

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      try {
        const [evs, staffSnap] = await Promise.all([
          getOrganizerEvents(user.uid),
          getDocs(query(collection(db, 'staff'), where('organizerId', '==', user.uid))),
        ]);
        setEvents(evs);
        setStaff(staffSnap.docs.map(d => ({ id: d.id, ...d.data() } as StaffMember)));
      } catch (err) {
        console.error('staff load', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

  const handleAdd = async () => {
    if (!form.name || !form.phone || !user?.uid) return;
    setSaving(true);
    try {
      const id = `staff_${Date.now()}`;
      const newMember: Omit<StaffMember, 'id'> & { organizerId: string; createdAt: any } = {
        name: form.name,
        phone: form.phone,
        role: form.role,
        pin: generatePin(),
        eventIds: form.eventIds,
        active: true,
        organizerId: user.uid,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'staff', id), newMember);
      setStaff(prev => [...prev, { id, ...newMember }]);
      setForm({ name: '', phone: '', role: 'scanner', eventIds: [] });
      setShowForm(false);
    } catch (err) {
      console.error('add staff', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (member: StaffMember) => {
    try {
      await setDoc(doc(db, 'staff', member.id), { active: !member.active }, { merge: true });
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, active: !s.active } : s));
    } catch (err) {
      console.error('toggle staff', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(L('Ou sèten ou vle retire manm staff sa?', 'Are you sure you want to remove this staff member?', 'Êtes-vous sûr de vouloir retirer ce membre?'))) return;
    try {
      await deleteDoc(doc(db, 'staff', id));
      setStaff(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('delete staff', err);
    }
  };

  const roleLabel = (role: StaffMember['role']) => ({
    scanner: L('Eskanè', 'Scanner', 'Scanner'),
    door:    L('Pòt', 'Door', 'Porte'),
    manager: L('Manadjè', 'Manager', 'Gestionnaire'),
  }[role]);

  const roleColor = (role: StaffMember['role']) => ({
    scanner: 'bg-cyan-dim text-cyan',
    door:    'bg-green-dim text-green',
    manager: 'bg-orange-dim text-orange',
  }[role]);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-gray-light">{staff.length} {L('manm staff', 'staff members', 'membres du personnel')}</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
          ➕ {L('Ajoute Staff', 'Add Staff', 'Ajouter Personnel')}
        </button>
      </div>

      {/* Scanner link info */}
      <div className="bg-dark-card border border-border rounded-card p-4 mb-5 flex items-center gap-3">
        <span className="text-2xl">📱</span>
        <div className="flex-1">
          <p className="text-xs font-bold">{L('Jestion Eskanè', 'Scanner Management', 'Gestion Scanner')}</p>
          <p className="text-[10px] text-gray-light">{L('Konfigire eskanè ak PIN staff nan Paramèt', 'Configure scanner and staff PINs in Settings', 'Configurer scanner et PIN personnel dans Paramètres')}</p>
        </div>
        <Link href="/organizer/settings"
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-white transition-all">
          {L('Paramèt →', 'Settings →', 'Paramètres →')}
        </Link>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-dark-card border border-border rounded-card p-5 mb-5">
          <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">{L('NOUVO MANM STAFF', 'NEW STAFF MEMBER', 'NOUVEAU MEMBRE')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Non', 'Name', 'Nom')} *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Jean Pierre"
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Telefòn', 'Phone', 'Téléphone')} *</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+509 ..."
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Wòl', 'Role', 'Rôle')}</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as StaffMember['role'] }))}
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange">
                <option value="scanner">{L('Eskanè', 'Scanner', 'Scanner')}</option>
                <option value="door">{L('Pòt', 'Door', 'Porte')}</option>
                <option value="manager">{L('Manadjè', 'Manager', 'Gestionnaire')}</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Evènman', 'Events', 'Événements')}</label>
              <div className="max-h-28 overflow-y-auto space-y-1.5 p-2 rounded-[10px] bg-white/[0.04] border border-border">
                {events.length === 0
                  ? <p className="text-[10px] text-gray-muted">{L('Pa gen evènman', 'No events', 'Aucun événement')}</p>
                  : events.map(e => (
                    <label key={e.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.eventIds.includes(e.id!)}
                        onChange={ev => setForm(f => ({
                          ...f,
                          eventIds: ev.target.checked ? [...f.eventIds, e.id!] : f.eventIds.filter(id => id !== e.id),
                        }))}
                        className="accent-orange" />
                      <span className="text-[11px]">{e.name}</span>
                    </label>
                  ))
                }
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !form.name || !form.phone}
              className="px-5 py-2.5 rounded-[10px] bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all disabled:opacity-50">
              {saving ? '...' : L('Ajoute', 'Add', 'Ajouter')}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-xs font-bold text-gray-light hover:text-white transition-all">
              {L('Anile', 'Cancel', 'Annuler')}
            </button>
          </div>
        </div>
      )}

      {/* Staff list */}
      {staff.length === 0 ? (
        <div className="bg-dark-card border border-border rounded-card p-12 text-center">
          <p className="text-5xl mb-3">👥</p>
          <p className="text-gray-muted mb-4">{L('Pa gen staff ankò.', 'No staff yet.', 'Aucun personnel pour l\'instant.')}</p>
          <button onClick={() => setShowForm(true)}
            className="inline-flex px-5 py-2.5 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
            ➕ {L('Ajoute premye manm staff ou', 'Add your first staff member', 'Ajouter votre premier membre')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(s => (
            <div key={s.id} className={`bg-dark-card border rounded-card p-4 transition-all ${s.active ? 'border-border' : 'border-border opacity-50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center text-lg flex-shrink-0">
                  {s.role === 'scanner' ? '📱' : s.role === 'manager' ? '🧑‍💼' : '🚪'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-bold">{s.name}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${roleColor(s.role)}`}>{roleLabel(s.role)}</span>
                    {!s.active && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-white/[0.05] text-gray-muted">{L('DEZAKTIVE', 'INACTIVE', 'INACTIF')}</span>}
                  </div>
                  <p className="text-[11px] text-gray-light">{s.phone}</p>
                  <p className="text-[10px] text-gray-muted mt-0.5">
                    PIN: <span className="font-mono font-bold text-white">{s.pin}</span>
                    {s.eventIds.length > 0 && ` · ${s.eventIds.length} ${L('evèn', 'events', 'évén.')}`}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => handleToggle(s)}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
                      s.active
                        ? 'border-border text-gray-light hover:text-white hover:border-white/20'
                        : 'border-green-border text-green bg-green-dim hover:bg-green hover:text-white'
                    }`}>
                    {s.active ? L('Dezaktive', 'Disable', 'Désactiver') : L('Aktive', 'Enable', 'Activer')}
                  </button>
                  <button onClick={() => handleDelete(s.id)}
                    className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold border border-border text-gray-muted hover:text-red hover:border-red/30 transition-all">
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
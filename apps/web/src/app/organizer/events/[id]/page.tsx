'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import {
  getEvent, updateEvent, deleteEvent,
  getDoorStaff, addDoorStaff, removeDoorStaff,
  type EventData, type DoorStaff,
  getRefundRequests, approveRefund, denyRefund, type RefundRequest,
} from '@/lib/db';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Tab = 'overview' | 'sections' | 'attendees' | 'refunds' | 'staff' | 'settings';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useT();
  const { user } = useAuth();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale as 'ht' | 'en' | 'fr'] ?? ht);

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Refunds
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);

  // Attendees
  const [attendees, setAttendees] = useState<any[]>([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  // Staff
  const [staff, setStaff] = useState<DoorStaff[]>([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);

  // Ticket stats
  const [ticketCount, setTicketCount] = useState(0);
  const [revenue, setRevenue] = useState(0);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id]);

  async function loadAll() {
    setLoading(true);
    try {
      const ev = await getEvent(id);
      if (!ev) { router.push('/organizer/dashboard'); return; }
      setEvent(ev);
      setEditName(ev.name);
      setEditDesc(ev.description);
      setEditStatus(ev.status);
      setEditStartDate(ev.startDate);
      setEditStartTime(ev.startTime);

      // Load staff
      const staffList = await getDoorStaff(id);
      setStaff(staffList);

      // Load tickets + attendees
      const q = query(collectionGroup(db, 'tickets'), where('eventId', '==', id));
      const snap = await getDocs(q);
      setTicketCount(snap.size);
      const rev = snap.docs.reduce((sum, d) => sum + (d.data().price || 0), 0);
      setRevenue(rev);
      const attendeeList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      attendeeList.sort((a: any, b: any) => (b.purchasedAt?.seconds || 0) - (a.purchasedAt?.seconds || 0));
      setAttendees(attendeeList);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function saveBasicInfo() {
    if (!event) return;
    setSaving(true);
    setError('');
    try {
      await updateEvent(id, {
        name: editName,
        description: editDesc,
        status: editStatus as EventData['status'],
        startDate: editStartDate,
        startTime: editStartTime,
      });
      setEvent(prev => prev ? { ...prev, name: editName, description: editDesc, status: editStatus as EventData['status'], startDate: editStartDate, startTime: editStartTime } : prev);
      setSuccess(L('Sove!', 'Saved!', 'Enregistré!'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(L('Erè. Eseye ankò.', 'Error. Try again.', 'Erreur.'));
    }
    setSaving(false);
  }

  async function handleAddStaff() {
    if (!newStaffName.trim()) return;
    setAddingStaff(true);
    try {
      const s = await addDoorStaff(id, newStaffName.trim(), newStaffPhone.trim());
      setStaff(prev => [...prev, s]);
      setNewStaffName('');
      setNewStaffPhone('');
    } catch (err) {
      alert(L('Erè ajoute staff.', 'Error adding staff.', 'Erreur.'));
    }
    setAddingStaff(false);
  }

  async function handleRemoveStaff(staffId: string) {
    if (!confirm(L('Retire staff sa?', 'Remove this staff member?', 'Retirer ce membre?'))) return;
    try {
      await removeDoorStaff(id, staffId);
      setStaff(prev => prev.filter(s => s.id !== staffId));
    } catch (err) {
      alert(L('Erè.', 'Error.', 'Erreur.'));
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteEvent(id);
      router.push('/organizer/dashboard');
    } catch (err) {
      alert(L('Erè efase evènman.', 'Error deleting event.', 'Erreur.'));
    }
  }

  async function publishEvent() {
    setSaving(true);
    try {
      await updateEvent(id, { status: 'published' });
      setEvent(prev => prev ? { ...prev, status: 'published' } : prev);
      setEditStatus('published');
      setSuccess(L('Evènman publiye!', 'Event published!', 'Événement publié!'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(L('Erè.', 'Error.', 'Erreur.'));
    }
    setSaving(false);
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '4px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!event) return null;

  const isDraft = event.status === 'draft';
  const isPublished = event.status === 'published';
  const totalCapacity = event.sections?.reduce((s, sec) => s + sec.capacity, 0) ?? 0;
  const soldPct = totalCapacity > 0 ? Math.round((ticketCount / totalCapacity) * 100) : 0;

  const statusColors: Record<string, string> = {
    draft: '#888', published: '#22c55e', live: '#f97316', ended: '#6366f1', cancelled: '#ef4444',
  };
  const statusColor = statusColors[event.status] || '#888';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: L('Rezime', 'Overview', 'Résumé') },
    { key: 'sections', label: L('Seksyon', 'Sections', 'Sections') },
    { key: 'attendees', label: L('Moun', 'Attendees', 'Participants') },
    { key: 'refunds', label: `${L('Ranbousman', 'Refunds', 'Remboursements')}${refunds.filter(r=>r.status==='pending').length > 0 ? ' 🔴' : ''}` },
    { key: 'staff', label: L('Staff', 'Staff', 'Staff') },
    { key: 'settings', label: L('Paramèt', 'Settings', 'Paramètres') },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff' }}>
      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e', padding: '0 16px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/organizer/dashboard" style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}>← {L('Dashboard', 'Dashboard', 'Dashboard')}</Link>
          <span style={{ flex: 1 }} />
          <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800, background: statusColor + '20', color: statusColor }}>
            {event.status.toUpperCase()}
          </span>
          {isDraft && (
            <button onClick={publishEvent} disabled={saving} style={{ padding: '6px 14px', borderRadius: 8, background: '#22c55e', color: '#000', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              🚀 {L('Publiye', 'Publish', 'Publier')}
            </button>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{event.name}</h1>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>
          📅 {event.startDate} · 🕐 {event.startTime} · 📍 {event.venue?.name}
        </p>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: L('Tikè Vann', 'Tickets Sold', 'Billets Vendus'), value: ticketCount, sub: `/ ${totalCapacity}` },
            { label: L('Revni', 'Revenue', 'Revenus'), value: `$${revenue.toLocaleString()}`, sub: '' },
            { label: L('Ranpli', 'Fill Rate', 'Remplissage'), value: `${soldPct}%`, sub: '' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{s.value}<span style={{ fontSize: 12, color: '#555' }}>{s.sub}</span></div>
              <div style={{ color: '#888', fontSize: 10, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Private token banner */}
        {event.isPrivate && event.privateToken && (
          <div style={{ background: '#1a1025', border: '1px solid #6366f1', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>🔒</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc' }}>{L('Evènman Privé', 'Private Event', 'Événement Privé')}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2, fontFamily: 'monospace' }}>
                anbyans.events/e/{event.privateToken}
              </div>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(`https://anbyans.events/e/${event.privateToken}`); setSuccess(L('Kopi!', 'Copied!', 'Copié!')); setTimeout(() => setSuccess(''), 2000); }}
              style={{ padding: '6px 12px', borderRadius: 8, background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              {L('Kopye Lyen', 'Copy Link', 'Copier')}
            </button>
          </div>
        )}

        {success && <div style={{ background: '#052e16', border: '1px solid #22c55e', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#22c55e', fontSize: 13 }}>✅ {success}</div>}
        {error && <div style={{ background: '#2d0a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>❌ {error}</div>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #1e1e2e', paddingBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 16px', background: 'transparent', border: 'none',
              color: tab === t.key ? '#f97316' : '#888',
              borderBottom: tab === t.key ? '2px solid #f97316' : '2px solid transparent',
              fontSize: 13, fontWeight: tab === t.key ? 700 : 400, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{L('Enfòmasyon Debaz', 'Basic Info', 'Informations de base')}</h3>
              <div style={{ marginBottom: 12 }}>
                <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>{L('Non Evènman', 'Event Name', 'Nom')}</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>{L('Deskripsyon', 'Description', 'Description')}</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>{L('Dat', 'Date', 'Date')}</label>
                  <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>{L('Lè', 'Time', 'Heure')}</label>
                  <input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13 }}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="live">Live</option>
                  <option value="ended">Ended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <button onClick={saveBasicInfo} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, background: '#f97316', color: '#000', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                {saving ? '...' : `💾 ${L('Sove Chanjman', 'Save Changes', 'Enregistrer')}`}
              </button>
            </div>

            {/* Quick links */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Link href={`/events/${id}`} target="_blank" style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16, textDecoration: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>👁️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{L('Wè Paj Piblik', 'View Public Page', 'Voir la page')}</div>
                  <div style={{ color: '#888', fontSize: 10 }}>/events/{id.slice(0, 8)}...</div>
                </div>
              </Link>
              <Link href={`/organizer/scanner?event=${id}`} style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16, textDecoration: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>📱</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{L('Ouvri Eskanè', 'Open Scanner', 'Ouvrir Scanner')}</div>
                  <div style={{ color: '#888', fontSize: 10 }}>{L('Pou antre a', 'For door check-in', "Pour l'entrée")}</div>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* ── SECTIONS ── */}
        {tab === 'sections' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {event.sections?.map((sec, i) => {
              const secSold = sec.sold ?? 0;
              const secPct = sec.capacity > 0 ? Math.round((secSold / sec.capacity) * 100) : 0;
              return (
                <div key={i} style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: sec.color || '#555', flexShrink: 0 }} />
                    <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{sec.name}</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#f97316' }}>${sec.price}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: '#888' }}>{L('Kapasite', 'Capacity', 'Capacité')}: <span style={{ color: '#fff', fontWeight: 700 }}>{sec.capacity}</span></div>
                    <div style={{ fontSize: 12, color: '#888' }}>{L('Vann', 'Sold', 'Vendus')}: <span style={{ color: '#22c55e', fontWeight: 700 }}>{secSold}</span></div>
                    <div style={{ fontSize: 12, color: '#888' }}>{L('Disponib', 'Available', 'Disponibles')}: <span style={{ color: '#fff', fontWeight: 700 }}>{sec.capacity - secSold}</span></div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 6, background: '#1e1e2e', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${secPct}%`, background: sec.color || '#f97316', borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ color: '#555', fontSize: 10, marginTop: 4, textAlign: 'right' }}>{secPct}% {L('ranpli', 'filled', 'rempli')}</div>
                </div>
              );
            })}
            {(!event.sections || event.sections.length === 0) && (
              <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>{L('Pa gen seksyon.', 'No sections.', 'Aucune section.')}</p>
            )}
          </div>
        )}

        {/* ── ATTENDEES ── */}
        {tab === 'attendees' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Search */}
            <input
              value={attendeeSearch}
              onChange={e => setAttendeeSearch(e.target.value)}
              placeholder={L('Chèche pa non, email, telefòn...', 'Search by name, email, phone...', 'Chercher par nom, email, téléphone...')}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #1e1e2e', background: '#12121a', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
            />

            {/* Export CSV button */}
            <button
              onClick={() => {
                const rows = [['Non', 'Email', 'Telefòn', 'Seksyon', 'Plas', 'Pri', 'Status', 'Kòd Tikè']];
                attendees.forEach((a: any) => rows.push([a.buyerName, a.buyerEmail, a.buyerPhone, a.section, a.seat, a.price, a.status, a.ticketCode]));
                const csv = rows.map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('
');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${event?.name}-attendees.csv`; a.click();
              }}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid #1e1e2e', color: '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' }}
            >
              📥 {L('Ekspòte CSV', 'Export CSV', 'Exporter CSV')}
            </button>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 12 }}>
              {['valid', 'used', 'cancelled'].map(s => {
                const count = attendees.filter((a: any) => a.status === s).length;
                const colors: Record<string, string> = { valid: '#22c55e', used: '#f97316', cancelled: '#ef4444' };
                const labels: Record<string, string> = { valid: L('Valid', 'Valid', 'Valide'), used: L('Itilize', 'Used', 'Utilisé'), cancelled: L('Anile', 'Cancelled', 'Annulé') };
                return (
                  <div key={s} style={{ flex: 1, background: '#12121a', border: `1px solid ${colors[s]}30`, borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: colors[s] }}>{count}</div>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{labels[s]}</div>
                  </div>
                );
              })}
            </div>

            {/* List */}
            {attendees
              .filter((a: any) => {
                if (!attendeeSearch.trim()) return true;
                const q = attendeeSearch.toLowerCase();
                return (a.buyerName || '').toLowerCase().includes(q) ||
                       (a.buyerEmail || '').toLowerCase().includes(q) ||
                       (a.buyerPhone || '').toLowerCase().includes(q) ||
                       (a.ticketCode || '').toLowerCase().includes(q);
              })
              .map((a: any) => {
                const statusColors: Record<string, string> = { valid: '#22c55e', used: '#f97316', cancelled: '#ef4444', pending_transfer: '#f59e0b' };
                const sc = statusColors[a.status] || '#888';
                return (
                  <div key={a.id} style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 4, height: 44, borderRadius: 4, background: a.sectionColor || '#555', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.buyerName}</div>
                      <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{a.buyerPhone} {a.buyerEmail ? `· ${a.buyerEmail}` : ''}</div>
                      <div style={{ color: '#555', fontSize: 10, marginTop: 2 }}>
                        {a.section} · {L('Plas', 'Seat', 'Place')} {a.seat} · <span style={{ fontFamily: 'monospace' }}>{a.ticketCode}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#f97316' }}>${a.price}</div>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800, background: sc + '20', color: sc }}>
                        {a.status?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })
            }

            {attendees.length === 0 && (
              <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>{L('Pa gen moun ankò.', 'No attendees yet.', 'Aucun participant.')}</p>
            )}
          </div>
        )}

        {/* ── REFUNDS ── */}
        {tab === 'refunds' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {refunds.length === 0 && (
              <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>{L('Pa gen demann ranbousman.', 'No refund requests.', 'Aucune demande de remboursement.')}</p>
            )}
            {refunds.sort((a,b) => (b.requestedAt?.seconds||0)-(a.requestedAt?.seconds||0)).map(r => {
              const isPending = r.status === 'pending';
              const statusColor = r.status === 'approved' ? '#22c55e' : r.status === 'denied' ? '#ef4444' : '#f59e0b';
              return (
                <div key={r.id} style={{ background: '#12121a', border: `1px solid ${isPending ? '#f59e0b44' : '#1e1e2e'}`, borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.buyerName}</div>
                      <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{r.buyerPhone} · {r.section} · <span style={{ fontFamily: 'monospace' }}>{r.ticketCode}</span></div>
                      <div style={{ color: '#666', fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>"{r.reason}"</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#f97316' }}>${r.amount}</div>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800, background: statusColor + '20', color: statusColor }}>
                        {r.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {r.status === 'denied' && r.denialNote && (
                    <div style={{ padding: '8px 12px', background: '#ef444415', borderRadius: 8, color: '#ef4444', fontSize: 11 }}>
                      🚫 {r.denialNote}
                    </div>
                  )}
                  {isPending && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={async () => {
                          if (!confirm(L('Apwouve ranbousman $' + r.amount + '?', 'Approve $' + r.amount + ' refund?', 'Approuver?'))) return;
                          await approveRefund(r.id!, r.eventId, r.ticketId);
                          setRefunds(prev => prev.map(x => x.id === r.id ? {...x, status: 'approved'} : x));
                        }}
                        style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#22c55e20', border: '1px solid #22c55e44', color: '#22c55e', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        ✅ {L('Apwouve', 'Approve', 'Approuver')}
                      </button>
                      <button
                        onClick={async () => {
                          const note = prompt(L('Rezon refize a (opsyonèl):', 'Reason for denial (optional):', 'Raison du refus:')) ?? '';
                          await denyRefund(r.id!, r.eventId, r.ticketId, note);
                          setRefunds(prev => prev.map(x => x.id === r.id ? {...x, status: 'denied', denialNote: note} : x));
                        }}
                        style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#ef444420', border: '1px solid #ef444444', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        🚫 {L('Refize', 'Deny', 'Refuser')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── STAFF ── */
        {tab === 'staff' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Add staff */}
            <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>➕ {L('Ajoute Staff', 'Add Staff', 'Ajouter Staff')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <input
                  value={newStaffName} onChange={e => setNewStaffName(e.target.value)}
                  placeholder={L('Non staff', 'Staff name', 'Nom du staff')}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13 }}
                />
                <input
                  value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)}
                  placeholder={L('Telefòn (opsyonèl)', 'Phone (optional)', 'Téléphone (optionnel)')}
                  type="tel"
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13 }}
                />
              </div>
              <button onClick={handleAddStaff} disabled={!newStaffName.trim() || addingStaff} style={{ padding: '10px 20px', borderRadius: 8, background: newStaffName.trim() ? '#f97316' : '#333', color: newStaffName.trim() ? '#000' : '#666', fontSize: 13, fontWeight: 700, border: 'none', cursor: newStaffName.trim() ? 'pointer' : 'not-allowed' }}>
                {addingStaff ? '...' : L('Ajoute', 'Add', 'Ajouter')}
              </button>
            </div>

            {/* Staff list */}
            {staff.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>{L('Pa gen staff ankò.', 'No staff yet.', 'Aucun staff.')}</p>
            ) : (
              staff.map(s => (
                <div key={s.id} style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                    {s.staffName[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.staffName}</div>
                    {s.phone && <div style={{ color: '#888', fontSize: 11 }}>{s.phone}</div>}
                    <div style={{ color: '#555', fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>PIN: {s.pin}</div>
                  </div>
                  <div style={{ fontSize: 11, color: s.disabled ? '#ef4444' : '#22c55e' }}>
                    {s.disabled ? '🔴 Dezaktive' : '🟢 Aktif'}
                  </div>
                  <button onClick={() => handleRemoveStaff(s.id!)} style={{ padding: '6px 10px', borderRadius: 6, background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Private token */}
            <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🔒 {L('Vizibilite', 'Visibility', 'Visibilité')}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{L('Evènman Privé', 'Private Event', 'Événement Privé')}</div>
                  <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{L('Sèlman moun ki gen lyen an ka achte tikè.', 'Only people with the link can buy tickets.', 'Seuls les personnes avec le lien peuvent acheter.')}</div>
                </div>
                <div style={{ color: event.isPrivate ? '#22c55e' : '#555', fontWeight: 700, fontSize: 12 }}>
                  {event.isPrivate ? L('Aktive', 'Enabled', 'Activé') : L('Dezaktive', 'Disabled', 'Désactivé')}
                </div>
              </div>
              {event.isPrivate && event.privateToken && (
                <div style={{ background: '#0a0a0f', borderRadius: 8, padding: 12, marginTop: 8 }}>
                  <div style={{ color: '#888', fontSize: 10, marginBottom: 4 }}>Lyen privé:</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#a5b4fc', wordBreak: 'break-all' }}>
                    https://anbyans.events/e/{event.privateToken}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(`https://anbyans.events/e/${event.privateToken}`); setSuccess('Kopi!'); setTimeout(() => setSuccess(''), 2000); }}
                    style={{ marginTop: 10, padding: '6px 14px', borderRadius: 6, background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                  >
                    📋 {L('Kopye Lyen', 'Copy Link', 'Copier le lien')}
                  </button>
                </div>
              )}
            </div>

            {/* Danger zone */}
            <div style={{ background: '#1a0a0a', border: '1px solid #ef444440', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>⚠️ {L('Zòn Danje', 'Danger Zone', 'Zone Danger')}</h3>
              <p style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
                {L('Efase evènman an pou toujou. Aksyon sa pa ka defèt.', 'Permanently delete this event. This cannot be undone.', 'Supprimer définitivement. Irréversible.')}
              </p>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} style={{ padding: '10px 20px', borderRadius: 8, background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  🗑️ {L('Efase Evènman', 'Delete Event', "Supprimer l'événement")}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700 }}>{L('Ou sèten?', 'Are you sure?', 'Êtes-vous sûr?')}</span>
                  <button onClick={handleDelete} style={{ padding: '8px 16px', borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                    {L('Wi, Efase', 'Yes, Delete', 'Oui, Supprimer')}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid #333', color: '#888', fontSize: 12, cursor: 'pointer' }}>
                    {L('Non', 'No', 'Non')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

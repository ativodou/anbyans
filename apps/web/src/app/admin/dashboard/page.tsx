'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, getDoc
} from 'firebase/firestore';
import { updateEvent, getVenues, createVenue, updateVenue, deleteVenue, seedKnownVenues, type EventData, type VenueData } from '@/lib/db';

type Tab = 'overview' | 'events' | 'organizers' | 'users' | 'refunds' | 'finance' | 'venues' | 'settings';

interface OrganizerData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  role: string;
  createdAt: any;
  suspended?: boolean;
  totalEvents?: number;
  totalRevenue?: number;
}

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: any;
  suspended?: boolean;
  phone?: string;
  city?: string;
  country?: string;
}

const NAV: { id: Tab; icon: string; label: string }[] = [
  { id: 'overview',    icon: '📊', label: 'Overview'     },
  { id: 'events',      icon: '📅', label: 'Evènman'      },
  { id: 'organizers',  icon: '🎪', label: 'Òganizatè'    },
  { id: 'users',       icon: '👥', label: 'Itilizatè'    },
  { id: 'refunds',     icon: '💸', label: 'Ranbousman'   },
  { id: 'finance',     icon: '💰', label: 'Finans'       },
  { id: 'venues',      icon: '🏟️', label: 'Sal yo'      },
  { id: 'settings',    icon: '⚙️', label: 'Paramèt'     },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [sideOpen, setSideOpen] = useState(false);

  // Data
  const [events, setEvents] = useState<EventData[]>([]);
  const [organizers, setOrganizers] = useState<OrganizerData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [venues, setVenues] = useState<VenueData[]>([]);
  const [venueSearch, setVenueSearch] = useState('');
  const [venueModal, setVenueModal] = useState<'create' | 'edit' | null>(null);
  const [editingVenue, setEditingVenue] = useState<VenueData | null>(null);
  const [venueForm, setVenueForm] = useState<Partial<VenueData>>({});
  const [venueLoading, setVenueLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Search
  const [eventSearch, setEventSearch] = useState('');
  const [orgSearch, setOrgSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }
    loadAll();
  }, [user, authLoading]);

  async function loadAll() {
    setLoading(true);
    try {
      const [evSnap, usersSnap, refSnap, venSnap] = await Promise.all([
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'refundRequests')),
        getVenues(),
      ]);
      setVenues(venSnap as VenueData[]);

      const evList = evSnap.docs.map(d => ({ id: d.id, ...d.data() } as EventData));
      setEvents(evList);
      setRefunds(refSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserData));
      setUsers(allUsers.filter(u => u.role !== 'organizer'));

      const orgs = allUsers.filter(u => u.role === 'organizer') as OrganizerData[];
      // Attach event stats to each organizer
      const orgMap: Record<string, { count: number; revenue: number }> = {};
      evList.forEach(e => {
        if (!e.organizerId) return;
        if (!orgMap[e.organizerId]) orgMap[e.organizerId] = { count: 0, revenue: 0 };
        orgMap[e.organizerId].count++;
        orgMap[e.organizerId].revenue += (e as any).revenue || 0;
      });
      setOrganizers(orgs.map(o => ({
        ...o,
        totalEvents: orgMap[o.id]?.count || 0,
        totalRevenue: orgMap[o.id]?.revenue || 0,
      })));

      // Load all tickets for finance
      const tickets: any[] = [];
      await Promise.all(evList.map(async e => {
        const snap = await getDocs(collection(db, 'events', e.id!, 'tickets'));
        snap.docs.forEach(d => tickets.push({ id: d.id, ...d.data() }));
      }));
      setAllTickets(tickets);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function toggleSuspendUser(uid: string, suspended: boolean) {
    await updateDoc(doc(db, 'users', uid), { suspended: !suspended });
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, suspended: !suspended } : u));
    setOrganizers(prev => prev.map(o => o.id === uid ? { ...o, suspended: !suspended } : o));
  }

  async function toggleEventStatus(eventId: string, current: string) {
    const next = current === 'published' ? 'cancelled' : 'published';
    await updateEvent(eventId, { status: next as any });
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: next as any } : e));
  }


  async function handleSaveVenue() {
    if (!venueForm.name || !venueForm.city || !venueForm.country) return;
    setVenueLoading(true);
    try {
      const data = {
        name: venueForm.name || '',
        address: venueForm.address || '',
        city: venueForm.city || '',
        country: venueForm.country || '',
        gps: venueForm.gps || { lat: 0, lng: 0 },
        capacity: Number(venueForm.capacity) || 0,
        contact: venueForm.contact || {},
        amenities: venueForm.amenities || [],
        notes: venueForm.notes || '',
        isVerified: venueForm.isVerified ?? true,
        photos: venueForm.photos || [],
        floorPlanUrl: venueForm.floorPlanUrl || '',
        sections: venueForm.sections || [],
      };
      if (venueModal === 'create') {
        const id = await createVenue(data);
        setVenues(prev => [...prev, { id, ...data }]);
      } else if (editingVenue?.id) {
        await updateVenue(editingVenue.id, data);
        setVenues(prev => prev.map(v => v.id === editingVenue.id ? { ...v, ...data } : v));
      }
      setVenueModal(null);
      setEditingVenue(null);
      setVenueForm({});
    } catch (e) { console.error(e); }
    setVenueLoading(false);
  }

  async function handleDeleteVenue(id: string) {
    if (!confirm('Efase sal sa a?')) return;
    await deleteVenue(id);
    setVenues(prev => prev.filter(v => v.id !== id));
  }

  async function handleSeedVenues() {
    if (!confirm('Ajoute 13 sal koni nan Firestore?')) return;
    setVenueLoading(true);
    try {
      const count = await seedKnownVenues();
      alert(`${count} sal ajoute!`);
      const fresh = await getVenues();
      setVenues(fresh);
    } catch(e) { console.error(e); }
    setVenueLoading(false);
  }

  async function approveRefund(r: any) {
    await updateDoc(doc(db, 'refundRequests', r.id), { status: 'approved', resolvedAt: serverTimestamp() });
    await updateDoc(doc(db, 'events', r.eventId, 'tickets', r.ticketId), { status: 'refunded' });
    setRefunds(prev => prev.map(x => x.id === r.id ? { ...x, status: 'approved' } : x));
  }

  async function denyRefund(r: any) {
    const note = prompt('Rezon refize:') ?? '';
    await updateDoc(doc(db, 'refundRequests', r.id), { status: 'denied', denialNote: note, resolvedAt: serverTimestamp() });
    await updateDoc(doc(db, 'events', r.eventId, 'tickets', r.ticketId), { status: 'used' });
    setRefunds(prev => prev.map(x => x.id === r.id ? { ...x, status: 'denied', denialNote: note } : x));
  }

  // ── Finance metrics ──
  const validTickets = allTickets.filter(t => t.status !== 'cancelled' && t.status !== 'refunded');
  const grossRevenue = validTickets.reduce((s, t) => s + (t.price || 0), 0);
  const platformFee = Math.round(grossRevenue * 0.09); // 9% Anbyans fee
  const byMethod: Record<string, number> = {};
  validTickets.forEach(t => {
    const m = t.paymentMethod || 'unknown';
    byMethod[m] = (byMethod[m] || 0) + (t.price || 0);
  });

  // ── Overview metrics ──
  const liveEvents = events.filter(e => e.status === 'published' || e.status === 'live').length;
  const pendingRefunds = refunds.filter(r => r.status === 'pending').length;
  const totalUsers = users.length + organizers.length;

  if (authLoading || loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen flex bg-dark text-white">

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[220px] bg-dark-card border-r border-border flex flex-col transition-transform md:translate-x-0 md:static ${sideOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 pb-5 border-b border-border flex items-center gap-3">
          <Link href="/"><img src="/logo.jpg" alt="Anbyans" className="h-8 rounded" /></Link>
          <span className="text-[9px] font-black uppercase tracking-widest text-orange bg-orange/10 px-2 py-0.5 rounded">ADMIN</span>
        </div>
        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          {NAV.map(n => (
            <button key={n.id} onClick={() => { setTab(n.id); setSideOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] mb-0.5 transition-all ${tab === n.id ? 'bg-orange-dim text-orange font-semibold' : 'text-gray-light hover:bg-dark-hover hover:text-white'}`}>
              <span className="text-base w-5 text-center">{n.icon}</span>
              {n.label}
              {n.id === 'refunds' && pendingRefunds > 0 && (
                <span className="ml-auto bg-red text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingRefunds}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border text-[10px] text-gray-muted">
          <p className="font-bold text-white">{user.firstName} {user.lastName}</p>
          <p>{user.email}</p>
        </div>
      </aside>

      {sideOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSideOpen(false)} />}

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="sticky top-0 z-20 bg-dark border-b border-border px-5 flex items-center h-14 gap-3">
          <button onClick={() => setSideOpen(true)} className="md:hidden text-xl">☰</button>
          <h1 className="font-heading text-xl tracking-wide flex-1">
            {NAV.find(n => n.id === tab)?.icon} {NAV.find(n => n.id === tab)?.label.toUpperCase()}
          </h1>
          <button onClick={loadAll} className="text-gray-muted hover:text-white text-sm transition-all">🔄</button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 max-w-6xl w-full mx-auto">

          {/* ═══ OVERVIEW ═══ */}
          {tab === 'overview' && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                  { icon: '🎫', label: 'TIKÈ VANN', val: validTickets.length, color: 'text-white' },
                  { icon: '💰', label: 'REVNI PLATFÒM', val: '$' + platformFee.toLocaleString(), color: 'text-orange' },
                  { icon: '📅', label: 'EVÈNMAN AKTIF', val: liveEvents, color: 'text-green' },
                  { icon: '👥', label: 'TOTAL ITILIZATÈ', val: totalUsers, color: 'text-cyan' },
                ].map(k => (
                  <div key={k.label} className="bg-dark-card border border-border rounded-card p-4">
                    <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1">{k.icon} {k.label}</p>
                    <p className={`font-heading text-3xl ${k.color}`}>{k.val}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent events */}
                <div className="bg-dark-card border border-border rounded-card p-4">
                  <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">📅 DÈNYE EVÈNMAN</p>
                  {events.slice(0, 5).map(e => (
                    <div key={e.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{e.name}</p>
                        <p className="text-[10px] text-gray-muted">{e.organizerName || '—'} · {e.startDate}</p>
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                  ))}
                </div>

                {/* Pending refunds */}
                <div className="bg-dark-card border border-border rounded-card p-4">
                  <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">💸 RANBOUSMAN AN ATANT</p>
                  {refunds.filter(r => r.status === 'pending').slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{r.buyerName}</p>
                        <p className="text-[10px] text-gray-muted truncate">{r.eventName} · ${r.amount}</p>
                      </div>
                      <button onClick={() => setTab('refunds')} className="text-[10px] text-orange hover:underline">Wè →</button>
                    </div>
                  ))}
                  {refunds.filter(r => r.status === 'pending').length === 0 && (
                    <p className="text-gray-muted text-xs py-4 text-center">✅ Pa gen demann an atant</p>
                  )}
                </div>

                {/* Payment breakdown */}
                <div className="bg-dark-card border border-border rounded-card p-4">
                  <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">💳 BREAKDOWN PEMAN</p>
                  {Object.entries(byMethod).map(([m, amt]) => (
                    <div key={m} className="flex justify-between py-2 border-b border-border last:border-0 text-xs">
                      <span className="font-bold capitalize">{m === 'stripe' ? '💳 Kat' : m === 'moncash' ? '📱 MonCash' : m === 'cash' ? '💵 Kach' : m}</span>
                      <span className="text-gray-light">${(amt as number).toLocaleString()} ({Math.round((amt as number)/grossRevenue*100)}%)</span>
                    </div>
                  ))}
                  {Object.keys(byMethod).length === 0 && <p className="text-gray-muted text-xs py-4 text-center">Pa gen done</p>}
                </div>

                {/* Top organizers */}
                <div className="bg-dark-card border border-border rounded-card p-4">
                  <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">🎪 TOP ÒGANIZATÈ</p>
                  {[...organizers].sort((a,b) => (b.totalRevenue||0)-(a.totalRevenue||0)).slice(0,5).map(o => (
                    <div key={o.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{o.businessName || `${o.firstName} ${o.lastName}`}</p>
                        <p className="text-[10px] text-gray-muted">{o.totalEvents} evèn</p>
                      </div>
                      <span className="text-xs font-bold text-orange">${(o.totalRevenue||0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ EVENTS ═══ */}
          {tab === 'events' && (
            <div>
              <input value={eventSearch} onChange={e => setEventSearch(e.target.value)}
                placeholder="Chèche pa non, òganizatè..."
                className="w-full px-4 py-3 rounded-xl bg-dark-card border border-border text-white text-sm outline-none focus:border-orange mb-4 placeholder:text-gray-muted" />
              <div className="space-y-2">
                {events.filter(e =>
                  !eventSearch || e.name?.toLowerCase().includes(eventSearch.toLowerCase()) ||
                  (e.organizerName||"").toLowerCase().includes(eventSearch.toLowerCase())
                ).map(e => (
                  <div key={e.id} className="bg-dark-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold truncate">{e.name}</p>
                        {e.isPrivate && <span className="text-[9px] bg-orange/20 text-orange px-1.5 py-0.5 rounded font-bold">PRIVE</span>}
                      </div>
                      <p className="text-[11px] text-gray-muted">{e.organizerName || '—'} · {e.startDate} · {e.venue?.name || '—'}</p>
                      <p className="text-[11px] text-gray-light mt-0.5">{(e as any).totalSold || 0} tikè · ${((e as any).revenue || 0).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={e.status} />
                      <button
                        onClick={() => toggleEventStatus(e.id!, e.status)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${e.status === 'cancelled' ? 'bg-green-dim text-green border border-green/30' : 'bg-red/10 text-red border border-red/30'}`}>
                        {e.status === 'cancelled' ? 'Reaktive' : 'Anile'}
                      </button>
                      <Link href={`/organizer/events/${e.id}`} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/[0.05] text-gray-light border border-border hover:text-white transition-all">
                        Wè →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ ORGANIZERS ═══ */}
          {tab === 'organizers' && (
            <div>
              <input value={orgSearch} onChange={e => setOrgSearch(e.target.value)}
                placeholder="Chèche pa non, biznis, email..."
                className="w-full px-4 py-3 rounded-xl bg-dark-card border border-border text-white text-sm outline-none focus:border-orange mb-4 placeholder:text-gray-muted" />
              <div className="space-y-2">
                {organizers.filter(o =>
                  !orgSearch ||
                  `${o.firstName} ${o.lastName} ${o.businessName} ${o.email}`.toLowerCase().includes(orgSearch.toLowerCase())
                ).map(o => (
                  <div key={o.id} className={`bg-dark-card border rounded-xl p-4 flex items-center gap-4 ${o.suspended ? 'border-red/30 bg-red/5' : 'border-border'}`}>
                    <div className="w-10 h-10 rounded-full bg-orange/20 flex items-center justify-center text-sm font-black text-orange flex-shrink-0">
                      {o.firstName?.[0]}{o.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{o.businessName || `${o.firstName} ${o.lastName}`}</p>
                      <p className="text-[11px] text-gray-muted">{o.email}</p>
                      <p className="text-[11px] text-gray-light mt-0.5">{o.totalEvents} evèn · ${(o.totalRevenue||0).toLocaleString()} revni total</p>
                    </div>
                    {o.suspended && <span className="text-[9px] bg-red/20 text-red px-2 py-0.5 rounded font-bold">SISPANN</span>}
                    <button
                      onClick={() => toggleSuspendUser(o.id, !!o.suspended)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${o.suspended ? 'bg-green-dim text-green border border-green/30' : 'bg-red/10 text-red border border-red/30'}`}>
                      {o.suspended ? 'Reaktive' : 'Sispann'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ USERS ═══ */}
          {tab === 'users' && (
            <div>
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                placeholder="Chèche pa non, email, telefòn..."
                className="w-full px-4 py-3 rounded-xl bg-dark-card border border-border text-white text-sm outline-none focus:border-orange mb-4 placeholder:text-gray-muted" />
              <div className="space-y-2">
                {users.filter(u =>
                  !userSearch ||
                  `${u.firstName} ${u.lastName} ${u.email} ${u.phone}`.toLowerCase().includes(userSearch.toLowerCase())
                ).map(u => (
                  <div key={u.id} className={`bg-dark-card border rounded-xl p-4 flex items-center gap-4 ${u.suspended ? 'border-red/30 bg-red/5' : 'border-border'}`}>
                    <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-sm font-black flex-shrink-0">
                      {u.firstName?.[0]}{u.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{u.firstName} {u.lastName}</p>
                      <p className="text-[11px] text-gray-muted">{u.email} {u.phone ? '· ' + u.phone : ''}</p>
                      <p className="text-[11px] text-gray-muted">{u.city} {u.country} · <span className="text-orange capitalize">{u.role}</span></p>
                    </div>
                    {u.suspended && <span className="text-[9px] bg-red/20 text-red px-2 py-0.5 rounded font-bold">SISPANN</span>}
                    <button
                      onClick={() => toggleSuspendUser(u.id, !!u.suspended)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${u.suspended ? 'bg-green-dim text-green border border-green/30' : 'bg-red/10 text-red border border-red/30'}`}>
                      {u.suspended ? 'Reaktive' : 'Sispann'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ REFUNDS ═══ */}
          {tab === 'refunds' && (
            <div className="space-y-3">
              {['pending', 'approved', 'denied'].map(status => {
                const list = refunds.filter(r => r.status === status);
                if (list.length === 0) return null;
                const colors: Record<string, string> = { pending: '#f59e0b', approved: '#22c55e', denied: '#ef4444' };
                const labels: Record<string, string> = { pending: '⏳ AN ATANT', approved: '✅ APWOUVE', denied: '🚫 REFIZE' };
                return (
                  <div key={status}>
                    <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: colors[status] }}>{labels[status]} ({list.length})</p>
                    {list.map(r => (
                      <div key={r.id} className="bg-dark-card border border-border rounded-xl p-4 mb-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-bold">{r.buyerName}</p>
                            <p className="text-[11px] text-gray-muted">{r.buyerPhone} · {r.eventName}</p>
                            <p className="text-[11px] text-gray-light mt-1 italic">"{r.reason}"</p>
                            {r.denialNote && <p className="text-[11px] text-red mt-1">🚫 {r.denialNote}</p>}
                          </div>
                          <p className="text-lg font-black text-orange">${r.amount}</p>
                        </div>
                        {status === 'pending' && (
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => approveRefund(r)}
                              className="flex-1 py-2 rounded-lg text-xs font-bold bg-green-dim text-green border border-green/30">
                              ✅ Apwouve
                            </button>
                            <button onClick={() => denyRefund(r)}
                              className="flex-1 py-2 rounded-lg text-xs font-bold bg-red/10 text-red border border-red/30">
                              🚫 Refize
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
              {refunds.length === 0 && <p className="text-gray-muted text-center py-20">Pa gen demann ranbousman.</p>}
            </div>
          )}

          {/* ═══ FINANCE ═══ */}
          {tab === 'finance' && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {[
                  { label: 'REVNI BRIT', val: '$' + grossRevenue.toLocaleString(), color: 'text-white', sub: 'Tout tikè vann' },
                  { label: 'FRÈ ANBYANS (9%)', val: '$' + platformFee.toLocaleString(), color: 'text-orange', sub: 'Revni platfòm' },
                  { label: 'TIKÈ VALID', val: validTickets.length, color: 'text-green', sub: 'Tikè aktif' },
                  { label: 'TIKÈ ANILE', val: allTickets.filter(t=>t.status==='cancelled').length, color: 'text-red', sub: '' },
                  { label: 'RANBOUSMAN', val: '$' + allTickets.filter(t=>t.status==='refunded').reduce((s,t)=>s+(t.price||0),0).toLocaleString(), color: 'text-yellow-400', sub: '' },
                  { label: 'EVÈNMAN TOTAL', val: events.length, color: 'text-cyan', sub: '' },
                ].map(k => (
                  <div key={k.label} className="bg-dark-card border border-border rounded-card p-4">
                    <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1">{k.label}</p>
                    <p className={`font-heading text-3xl ${k.color}`}>{k.val}</p>
                    {k.sub && <p className="text-[10px] text-gray-muted mt-1">{k.sub}</p>}
                  </div>
                ))}
              </div>

              <div className="bg-dark-card border border-border rounded-card p-5 mb-4">
                <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">💳 REVNI PA METÒD PEMAN</p>
                <div className="space-y-3">
                  {Object.entries(byMethod).sort((a,b) => (b[1] as number)-(a[1] as number)).map(([m, amt]) => (
                    <div key={m}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-bold capitalize">{m === 'stripe' ? '💳 Kat Kredi/Debi' : m === 'moncash' ? '📱 MonCash' : m === 'natcash' ? '💚 Natcash' : m === 'cash' ? '💵 Kach' : m}</span>
                        <span className="text-gray-muted">${(amt as number).toLocaleString()} ({Math.round((amt as number)/grossRevenue*100)}%)</span>
                      </div>
                      <div className="w-full bg-white/[0.05] rounded-full h-2">
                        <div className="bg-orange h-2 rounded-full" style={{ width: `${Math.round((amt as number)/grossRevenue*100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-dark-card border border-border rounded-card p-5">
                <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">🎪 REVNI PA ÒGANIZATÈ</p>
                {[...organizers].sort((a,b) => (b.totalRevenue||0)-(a.totalRevenue||0)).slice(0,10).map((o, i) => (
                  <div key={o.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                    <span className="text-[10px] font-black text-gray-muted w-5">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{o.businessName || `${o.firstName} ${o.lastName}`}</p>
                      <p className="text-[10px] text-gray-muted">{o.totalEvents} evèn · frè: ${Math.round((o.totalRevenue||0)*0.09).toLocaleString()}</p>
                    </div>
                    <p className="text-sm font-black text-orange">${(o.totalRevenue||0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* ═══ VENUES ═══ */}
          {tab === 'venues' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <input value={venueSearch} onChange={e => setVenueSearch(e.target.value)}
                  placeholder="Chèche sal..."
                  className="flex-1 px-4 py-3 rounded-xl bg-dark-card border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted" />
                <button onClick={() => { setVenueForm({ isVerified: true, gps: { lat: 0, lng: 0 } }); setVenueModal('create'); }}
                  className="px-4 py-3 rounded-xl bg-orange text-black text-xs font-bold whitespace-nowrap">
                  + Ajoute Sal
                </button>
                {venues.length === 0 && (
                  <button onClick={handleSeedVenues} disabled={venueLoading}
                    className="px-4 py-3 rounded-xl bg-white/[0.06] border border-border text-gray-light text-xs font-bold whitespace-nowrap hover:text-white transition-all">
                    🌱 Ensemanse
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {venues.filter(v => !venueSearch || v.name.toLowerCase().includes(venueSearch.toLowerCase()) || v.city.toLowerCase().includes(venueSearch.toLowerCase())).map(v => (
                  <div key={v.id} className="bg-dark-card border border-border rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold truncate">{v.name}</p>
                          {v.isVerified && <span className="text-[9px] bg-green-dim text-green px-1.5 py-0.5 rounded font-bold border border-green/20">✓ VERIFYE</span>}
                        </div>
                        <p className="text-[11px] text-gray-muted">{v.address}</p>
                        <p className="text-[11px] text-gray-muted">{v.city}, {v.country}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px] text-orange font-bold">👥 {v.capacity.toLocaleString()}</span>
                          {v.sections && v.sections.length > 0 && (
                            <span className="text-[11px] text-gray-muted">{v.sections.length} seksyon</span>
                          )}
                          {v.contact?.phone && <span className="text-[11px] text-gray-muted">📞 {v.contact.phone}</span>}
                        </div>
                        {v.amenities && v.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {v.amenities.map(a => (
                              <span key={a} className="text-[9px] bg-white/[0.05] text-gray-muted px-1.5 py-0.5 rounded">{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button onClick={() => { setEditingVenue(v); setVenueForm(v); setVenueModal('edit'); }}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/[0.05] border border-border text-gray-light hover:text-white transition-all">
                          ✏️ Modifye
                        </button>
                        <button onClick={() => handleDeleteVenue(v.id!)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red/10 border border-red/20 text-red hover:bg-red/20 transition-all">
                          🗑 Efase
                        </button>
                      </div>
                    </div>
                    {v.notes && <p className="text-[10px] text-gray-muted mt-2 italic border-t border-border pt-2">{v.notes}</p>}
                  </div>
                ))}
              </div>

              {venues.length === 0 && !venueLoading && (
                <div className="text-center py-20">
                  <p className="text-4xl mb-3">🏟️</p>
                  <p className="text-gray-muted text-sm mb-4">Pa gen sal nan baz done</p>
                  <button onClick={handleSeedVenues} className="px-6 py-3 rounded-xl bg-orange text-black text-sm font-bold">
                    🌱 Ajoute Sal Koni yo
                  </button>
                </div>
              )}

              {/* ── Modal ── */}
              {venueModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                  <div className="bg-dark-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-heading text-lg">{venueModal === 'create' ? 'Ajoute Sal' : 'Modifye Sal'}</h3>
                      <button onClick={() => { setVenueModal(null); setEditingVenue(null); setVenueForm({}); }} className="text-gray-muted hover:text-white text-xl">✕</button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-muted uppercase tracking-wider mb-1.5">Non Sal *</label>
                        <input value={venueForm.name || ''} onChange={e => setVenueForm(p => ({ ...p, name: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-muted uppercase tracking-wider mb-1.5">Adrès</label>
                        <input value={venueForm.address || ''} onChange={e => setVenueForm(p => ({ ...p, address: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-muted uppercase tracking-wider mb-1.5">Vil *</label>
                          <input value={venueForm.city || ''} onChange={e => setVenueForm(p => ({ ...p, city: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-muted uppercase tracking-wider mb-1.5">Peyi *</label>
                          <select value={venueForm.country || 'Haiti'} onChange={e => setVenueForm(p => ({ ...p, country: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-dark border border-border text-white text-sm outline-none focus:border-orange">
                            {['Haiti','USA','Canada','France','Rep. Dominiken','Gwiyàn','Martinik','Gwadloup'].map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-muted uppercase tracking-wider mb-1.5">Kapasité</label>
                          <input type="number" value={venueForm.capacity || ''} onChange={e => setVenueForm(p => ({ ...p, capacity: Number(e.target.value) }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-muted uppercase tracking-wider mb-1.5">Telefòn</label>
                          <input value={venueForm.contact?.phone || ''} onChange={e => setVenueForm(p => ({ ...p, contact: { ...p.contact, phone: e.target.value } }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-muted uppercase tracking-wider mb-1.5">Imel Sal</label>
                          <input type="email" value={venueForm.contact?.email || ''} onChange={e => setVenueForm(p => ({ ...p, contact: { ...p.contact, email: e.target.value } }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-muted uppercase tracking-wider mb-1.5">Sit Wèb</label>
                          <input value={venueForm.contact?.website || ''} onChange={e => setVenueForm(p => ({ ...p, contact: { ...p.contact, website: e.target.value } }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-muted uppercase tracking-wider mb-1.5">Amenite (separe pa vigil)</label>
                        <input value={(venueForm.amenities || []).join(', ')} onChange={e => setVenueForm(p => ({ ...p, amenities: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                          placeholder="Parking, AC, Bar, Wifi, Sekirite..."
                          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-muted uppercase tracking-wider mb-1.5">Nòt</label>
                        <textarea rows={2} value={venueForm.notes || ''} onChange={e => setVenueForm(p => ({ ...p, notes: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange resize-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-muted uppercase tracking-wider mb-1.5">URL Plan Sal</label>
                        <input value={venueForm.floorPlanUrl || ''} onChange={e => setVenueForm(p => ({ ...p, floorPlanUrl: e.target.value }))}
                          placeholder="https://..."
                          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted" />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={venueForm.isVerified ?? true} onChange={e => setVenueForm(p => ({ ...p, isVerified: e.target.checked }))}
                          className="w-4 h-4 accent-orange" />
                        <span className="text-xs text-gray-light">Sal Verifye pa Anbyans</span>
                      </label>
                    </div>
                    <div className="flex gap-2 mt-5">
                      <button onClick={() => { setVenueModal(null); setEditingVenue(null); setVenueForm({}); }}
                        className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-border text-gray-light text-sm font-bold hover:text-white transition-all">
                        Anile
                      </button>
                      <button onClick={handleSaveVenue} disabled={venueLoading || !venueForm.name || !venueForm.city}
                        className="flex-1 py-3 rounded-xl bg-orange text-black text-sm font-bold disabled:opacity-50">
                        {venueLoading ? 'Ap sove...' : 'Anrejistre'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ SETTINGS ═══ */}
          {tab === 'settings' && (
            <div className="max-w-lg space-y-4">
              <div className="bg-dark-card border border-border rounded-card p-5">
                <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-4">⚙️ KONFIGIRASYON PLATFÒM</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-light mb-1">Frè Platfòm (%)</label>
                    <input defaultValue="9" type="number" className="w-32 px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-light mb-1">Chargeback Reserve (%)</label>
                    <input defaultValue="20" type="number" className="w-32 px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-light mb-1">Payout Delay (jou)</label>
                    <input defaultValue="7" type="number" className="w-32 px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange" />
                  </div>
                </div>
                <button className="mt-4 px-5 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">Anrejistre</button>
              </div>

              <div className="bg-dark-card border border-border rounded-card p-5">
                <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">🔐 ADMIN AKSÈ</p>
                <p className="text-xs text-gray-muted">UID ou: <span className="font-mono text-white">{user.uid}</span></p>
                <p className="text-xs text-gray-muted mt-1">Wòl: <span className="text-orange font-bold">{user.role}</span></p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    published: { color: 'text-green bg-green-dim border-green/30', label: 'PIBLIYE' },
    live:       { color: 'text-cyan bg-cyan-dim border-cyan-border', label: 'LIVE' },
    draft:      { color: 'text-gray-muted bg-white/[0.05] border-border', label: 'BOUYON' },
    ended:      { color: 'text-gray-muted bg-white/[0.05] border-border', label: 'FINI' },
    cancelled:  { color: 'text-red bg-red/10 border-red/30', label: 'ANILE' },
  };
  const s = map[status] || map.draft;
  return <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${s.color}`}>{s.label}</span>;
}

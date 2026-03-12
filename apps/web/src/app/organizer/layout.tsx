'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { OrganizerEventProvider, useOrganizerEvent } from './OrganizerEventContext';

interface OrgProfile {
  name: string;
  bizName: string;
  initials: string;
}

// ─── Event Selector Dropdown ────────────────────────────────────

function EventSelector() {
  const { events, selectedEvent, setSelectedEvent, loading } = useOrganizerEvent();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (loading) return (
    <div className="h-8 w-40 bg-white/[0.04] border border-border rounded-lg animate-pulse" />
  );

  if (events.length === 0) return (
    <Link href="/organizer/events/create"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-orange/40 text-orange text-[11px] font-semibold hover:border-orange transition-all">
      ➕ {L('Kreye premye evènman ou', 'Create your first event', 'Créer votre premier événement')}
    </Link>
  );

  const statusColor: Record<string, string> = {
    published: '#22c55e',
    live: '#22c55e',
    draft: '#888',
    ended: '#555',
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border hover:border-white/20 transition-all max-w-[220px]">
        {selectedEvent ? (
          <>
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: statusColor[selectedEvent.status || 'draft'] || '#888' }}
            />
            <span className="text-[12px] font-semibold truncate text-white">{selectedEvent.name}</span>
          </>
        ) : (
          <span className="text-[12px] text-gray-muted">{L('Chwazi evènman', 'Select event', 'Choisir événement')}</span>
        )}
        <span className="text-gray-muted text-[10px] ml-1 flex-shrink-0">▼</span>
      </button>

      {open && (
        <div className="absolute top-[110%] left-0 w-64 bg-dark-card border border-border rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-muted px-3 py-2">
            {L('Evènman ou yo', 'Your Events', 'Vos Événements')}
          </p>
          {events.map(ev => (
            <button
              key={ev.id}
              onClick={() => { setSelectedEvent(ev); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-dark-hover transition-all ${selectedEvent?.id === ev.id ? 'bg-orange-dim' : ''}`}>
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: statusColor[ev.status || 'draft'] || '#888' }}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-semibold truncate ${selectedEvent?.id === ev.id ? 'text-orange' : 'text-white'}`}>
                  {ev.name}
                </p>
                <p className="text-[10px] text-gray-muted truncate">{ev.startDate}</p>
              </div>
              {selectedEvent?.id === ev.id && <span className="text-orange text-xs flex-shrink-0">✓</span>}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <Link
              href="/organizer/events/create"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-[11px] text-orange hover:bg-dark-hover transition-all">
              ➕ {L('Kreye nouvo evènman', 'Create new event', 'Créer un événement')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inner Layout (has access to context) ───────────────────────

function OrganizerLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { locale } = useT();

  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  const [sideOpen, setSideOpen] = useState(false);
  const [orgProfile, setOrgProfile] = useState<OrgProfile>({
    name: '',
    bizName: '',
    initials: '??',
  });

  const NAV_ITEMS = [
    { href: '/organizer/dashboard', icon: '📊', label: L('Dachbòd',  'Dashboard',  'Tableau de bord') },
    { href: '/organizer/events',    icon: '📅', label: L('Evènman',  'Events',     'Événements') },
    { href: '/organizer/vendors',   icon: '🏪', label: L('Revandè',  'Resellers',  'Revendeurs') },
    { href: '/organizer/revenue',   icon: '💰', label: L('Revni',    'Revenue',    'Revenus') },
    { href: '/organizer/analytics', icon: '📈', label: L('Analytics','Analytics',  'Analytique') },
    { href: '/organizer/staff',     icon: '👥', label: L('Staff',    'Staff',      'Personnel') },
    { href: '/organizer/settings',  icon: '⚙️', label: L('Paramèt', 'Settings',   'Paramètres') },
  ];

  useEffect(() => {
    if (!user?.uid) return;
    const loadProfile = async () => {
      const orgSnap = await getDocs(query(collection(db, 'organizers'), where('uid', '==', user.uid)));
      if (!orgSnap.empty) {
        const data = orgSnap.docs[0].data();
        const fullName = data.name || user.email || 'Òganizatè';
        setOrgProfile({
          name: fullName,
          bizName: data.businessName || data.bizName || '',
          initials: fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        });
        return;
      }
      const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
      if (!userSnap.empty) {
        const data = userSnap.docs[0].data();
        const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ') || user.email || 'Òganizatè';
        setOrgProfile({
          name: fullName,
          bizName: data.businessName || '',
          initials: fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        });
        return;
      }
      const fallback = (user as any).displayName || user.email || 'Òganizatè';
      setOrgProfile({
        name: fallback,
        bizName: '',
        initials: fallback.slice(0, 2).toUpperCase(),
      });
    };
    loadProfile().catch(console.error);
  }, [user?.uid]);

  const isActive = (href: string) => {
    if (href === '/organizer/dashboard') return pathname === href;
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await auth.signOut();
    router.push('/');
  };

  const pageTitle = (() => {
    if (pathname.startsWith('/organizer/events/create')) return L('Kreye Evènman', 'Create Event', 'Créer un événement');
    if (pathname.startsWith('/organizer/events'))    return L('Evènman',   'Events',    'Événements');
    if (pathname.startsWith('/organizer/vendors'))   return L('Revandè',   'Resellers', 'Revendeurs');
    if (pathname.startsWith('/organizer/revenue'))   return L('Revni',     'Revenue',   'Revenus');
    if (pathname.startsWith('/organizer/analytics')) return L('Analytics', 'Analytics', 'Analytique');
    if (pathname.startsWith('/organizer/staff'))     return L('Staff',     'Staff',     'Personnel');
    if (pathname.startsWith('/organizer/settings'))  return L('Paramèt',   'Settings',  'Paramètres');
    return L('Dachbòd', 'Dashboard', 'Tableau de bord');
  })();

  return (
    <div className="min-h-screen flex bg-dark">

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-[220px]
        bg-dark-card border-r border-border
        flex flex-col
        transition-transform duration-200
        md:translate-x-0 md:static
        ${sideOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 pb-5 border-b border-border flex-shrink-0">
          <Link href="/" onClick={() => setSideOpen(false)}>
            <img src="/logo.jpg" alt="Anbyans" className="h-10 rounded" />
          </Link>
        </div>

        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-muted px-3 mb-2">
            {L('Jeneral', 'General', 'Général')}
          </p>
          {NAV_ITEMS.map(n => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setSideOpen(false)}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] mb-0.5 transition-all
                ${isActive(n.href)
                  ? 'bg-orange-dim text-orange font-semibold'
                  : 'text-gray-light hover:bg-dark-hover hover:text-white'}
              `}>
              <span className="text-base w-5 text-center">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-orange flex items-center justify-center text-sm font-bold flex-shrink-0">
            {orgProfile.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold truncate">{orgProfile.name}</p>
            <p className="text-[9px] text-gray-muted truncate">{orgProfile.bizName || user?.email || ''}</p>
          </div>
          <button
            onClick={handleSignOut}
            title={L('Dekonekte', 'Sign out', 'Déconnexion')}
            className="text-gray-muted hover:text-red text-sm transition-colors">
            🚪
          </button>
        </div>
      </aside>

      {sideOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSideOpen(false)} />
      )}

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* HEADER */}
        <header className="sticky top-0 z-20 bg-dark border-b border-border px-5 flex items-center h-14 gap-3">
          <button
            onClick={() => setSideOpen(true)}
            className="md:hidden text-xl text-gray-light hover:text-white transition-colors">
            ☰
          </button>

          <h1 className="font-heading text-xl tracking-wide uppercase hidden sm:block">
            {pageTitle}
          </h1>

          <div className="flex-1" />

          {/* ── Event Selector ── */}
          <EventSelector />
        </header>

        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>

      </div>
    </div>
  );
}

// ─── Root Layout ─────────────────────────────────────────────────

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrganizerEventProvider>
      <OrganizerLayoutInner>{children}</OrganizerLayoutInner>
    </OrganizerEventProvider>
  );
}
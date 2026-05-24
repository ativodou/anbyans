'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';
import { auth, db } from '@/lib/firebase';
import { type EventData, getOrganizerLogo } from '@/lib/db';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { OrganizerEventProvider, useOrganizerEvent } from './OrganizerEventContext';

interface OrgProfile {
  name: string;
  bizName: string;
  initials: string;
}

// ─── Event Selector Dropdown ────────────────────────────────────

function EventSelector() {
  const { events, selectedEvent, setSelectedEvent, loading } = useOrganizerEvent();
  const { t } = useT();
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
      ➕ {t('org_create_first_event')}
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
          <span className="text-[12px] text-gray-muted">{t('org_select_event')}</span>
        )}
        <span className="text-gray-muted text-[10px] ml-1 flex-shrink-0">▼</span>
      </button>

      {open && (
        <div className="absolute top-[110%] left-0 w-64 bg-dark-card border border-border rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-muted px-3 py-2">
            {t('org_your_events')}
          </p>
          {events.map(ev => (
            <button
              key={ev.id}
              onClick={() => { setSelectedEvent(ev as any); setOpen(false); }}
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

        </div>
      )}
    </div>
  );
}

// ─── Inner Layout (has access to context) ───────────────────────

function OrganizerLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useT();

  const [mounted, setMounted] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrgProfile>({
    name: '',
    bizName: '',
    initials: '??',
  });

  useEffect(() => setMounted(true), []);

  // ── Live pending-ticket badge count ─────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'tickets'),
      where('organizerId', '==', user.uid),
      where('paymentStatus', 'in', ['pending_verification', 'pending_cash']),
    );
    const unsub = onSnapshot(q, (snap) => setPendingCount(snap.size));
    return () => unsub();
  }, [user?.uid]);

  const NAV_ITEMS = [
    { href: '/organizer/dashboard',        icon: '📊', label: t('org_nav_dashboard') },
    { href: '/organizer/events',           icon: '📅', label: t('org_nav_events') },
    { href: '/organizer/vendors',          icon: '🏪', label: t('org_nav_resellers') },
    { href: '/organizer/revenue',          icon: '💰', label: t('org_nav_revenue') },
    { href: '/organizer/analytics',        icon: '📈', label: t('org_nav_analytics') },
    { href: '/organizer/staff',            icon: '👥', label: t('org_nav_staff') },
    { href: '/organizer/pending-tickets',  icon: '⏳', label: t('org_nav_pending'),  badge: pendingCount },
    { href: '/organizer/issue-tickets',    icon: '🎟️', label: 'Issue Tickets' },
    { href: '/organizer/bar',              icon: '🍹', label: 'Bar POS' },
    { href: '/organizer/settings',         icon: '⚙️', label: t('org_nav_settings') },
  ];

  useEffect(() => {
    if (!user) return;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Òganizatè';
    setOrgProfile({
      name: fullName,
      bizName: (user as any).businessName || '',
      initials: fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
    });
    getOrganizerLogo(user.uid).then(url => setLogoSrc(url)).catch(() => setLogoSrc(null));
  }, [user?.uid]);

  const isActive = (href: string) => {
    if (href === '/organizer/dashboard') return pathname === href;
    return pathname.startsWith(href);
  };

  // ── Role guard ───────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user) return; // firebase briefly null during token refresh — wait
    if (user.role !== 'organizer' && user.role !== 'admin') router.push('/organizer/auth');
  }, [user, loading]);

  const handleSignOut = async () => {
    await auth.signOut();
    router.push('/');
  };

  const pageTitle = (() => {
    if (pathname.startsWith('/organizer/events/create'))       return t('org_page_create_event');
    if (pathname.startsWith('/organizer/events'))              return t('org_page_events');
    if (pathname.startsWith('/organizer/vendors'))             return t('org_page_vendors');
    if (pathname.startsWith('/organizer/revenue'))             return t('org_page_revenue');
    if (pathname.startsWith('/organizer/analytics'))           return t('org_page_analytics');
    if (pathname.startsWith('/organizer/staff'))               return t('org_page_staff');
    if (pathname.startsWith('/organizer/pending-tickets'))     return t('org_page_pending_tickets');
    if (pathname.startsWith('/organizer/settings'))            return t('org_page_settings');
    return t('org_nav_dashboard');
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
          <Link href="/events" onClick={() => setSideOpen(false)}>
            <img src="/logo.jpg" alt="Anbyans" className="h-10 rounded" />
          </Link>
        </div>

        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-muted px-3 mb-2">
            {t('org_section_general')}
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
              <span className="flex-1">{n.label}</span>
              {'badge' in n && (n as any).badge > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full bg-orange text-white text-[9px] font-bold min-w-[18px] text-center">
                  {(n as any).badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-orange flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
            {logoSrc
              ? <img src={logoSrc} alt="logo" className="w-full h-full object-cover" />
              : orgProfile.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold truncate">{orgProfile.name}</p>
            <p className="text-[9px] text-gray-muted truncate">{orgProfile.bizName || user?.email || ''}</p>
          </div>
          <button
            onClick={handleSignOut}
            title={t('org_signout')}
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
        <header className="sticky top-0 z-20 bg-dark border-b border-border px-5 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSideOpen(true)}
              className="md:hidden text-xl text-gray-light hover:text-white transition-colors">
              ☰
            </button>
            <h1 className="font-heading text-xl tracking-wide uppercase hidden sm:block">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
          {/* ── Event Selector ── */}
          <EventSelector />
          <LangSwitcher />

          {/* ── Profile ── */}
          {mounted && user && <div className="relative flex-shrink-0">
            <button onClick={() => setProfileOpen(p => !p)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 10px 4px 4px', borderRadius: 8,
              border: '1px solid ' + (profileOpen ? '#f97316' : '#1e1e2e'),
              background: profileOpen ? '#f9731610' : 'transparent', cursor: 'pointer',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 800, fontSize: 13, flexShrink: 0, overflow: 'hidden' }}>
                {logoSrc ? <img src={logoSrc} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (orgProfile.initials !== '??' ? orgProfile.initials : (user.email?.[0]?.toUpperCase() ?? '?'))}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{orgProfile.bizName || orgProfile.name || user.email?.split('@')[0] || '…'}</div>
                <div style={{ color: '#f97316', fontSize: 10 }}>Òganizatè</div>
              </div>
              <span style={{ color: '#555', fontSize: 10, marginLeft: 4 }}>▼</span>
            </button>

            {profileOpen && (
              <>
                <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                <div style={{ position: 'absolute', top: '110%', right: 0, width: 240, background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 10, padding: 6, zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #1e1e2e', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 800, fontSize: 18, flexShrink: 0, overflow: 'hidden' }}>
                        {logoSrc ? <img src={logoSrc} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (orgProfile.initials !== '??' ? orgProfile.initials : (user.email?.[0]?.toUpperCase() ?? '?'))}
                      </div>
                      <div>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{orgProfile.name || user.email?.split('@')[0]}</div>
                        {orgProfile.bizName && <div style={{ color: '#aaa', fontSize: 11 }}>{orgProfile.bizName}</div>}
                        <div style={{ display: 'inline-block', marginTop: 2, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#f9731622', color: '#f97316' }}>ÒGANIZATÈ</div>
                      </div>
                    </div>
                    <div style={{ color: '#555', fontSize: 10 }}>{user.email}</div>
                    <Link href="/organizer/settings" onClick={() => setProfileOpen(false)} style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>
                      ✏️ Chanje Logo
                    </Link>
                  </div>
                  <Link href="/events" onClick={() => setProfileOpen(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: '#ccc', fontSize: 12, textDecoration: 'none' }}>
                    {t('nav_browse_events' as any) || 'Jwenn Evenman'}
                  </Link>
                  <Link href="/organizer/settings" onClick={() => setProfileOpen(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: '#ccc', fontSize: 12, textDecoration: 'none' }}>
                    ⚙️ {t('org_nav_settings')}
                  </Link>
                  <div style={{ borderTop: '1px solid #1e1e2e', margin: '4px 0' }} />
                  <button onClick={handleSignOut} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: 'none', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                    {t('logout')}
                  </button>
                </div>
              </>
            )}
          </div>}
          </div>
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
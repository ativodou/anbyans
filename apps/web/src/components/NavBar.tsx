'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import LangSwitcher from './LangSwitcher';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale]);
  const [menuOpen, setMenuOpen] = useState(false);

  type Role = 'organizer' | 'reseller' | 'admin' | 'fan';
  const role = ((user as { role?: Role })?.role ?? 'fan');
  const displayName = (user as any)?.firstName || user?.email?.split('@')[0] || '';
  const initial = displayName.charAt(0).toUpperCase();

  // Role-based accent colors
  const accentMap: Record<string, string> = {
    organizer: '#f97316',
    reseller: '#a855f7',
    admin: '#ef4444',
    fan: '#06b6d4',
  };
  const accent = accentMap[role] || '#06b6d4';

  // --- Top bar links per role ---
  const links: { href: string; label: string }[] = [
  ];
  // Public events page only for fan/admin, not organizer (they use dashboard)
  if (role === 'fan' || role === 'admin') {
    links.push({ href: '/events', label: L('Evenman', 'Events', 'Evenements')! });
  }

  if (role === 'fan') {
    links.push(
      { href: '/buy', label: L('Achte Tike', 'Buy Tickets', 'Acheter Billets')! },
    );
  }

  if (role === 'organizer') {
    links.push(
      { href: '/organizer/dashboard', label: L('Dachbod', 'Dashboard', 'Tableau de bord')! },
    );
  }

  if (role === 'reseller') {
    links.push(
      { href: '/vendor/dashboard', label: L('Dachbod', 'Dashboard', 'Tableau de bord')! },
    );
  }

  if (role === 'admin') {
    links.push(
      { href: '/admin/dashboard', label: L('Dachbod', 'Dashboard', 'Tableau de bord')! },
      { href: '/tickets', label: L('Tikè Mwen', 'My Tickets', 'Mes Billets')! },
    );
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    await logout();
    setMenuOpen(false);
    window.location.href = '/';
  }

 const roleLabelMap: Record<string, string | undefined> = {
    organizer: L('Promote', 'Organizer', 'Organisateur'),
    reseller: L('Machann', 'Reseller', 'Vendeur'),
    admin: L('Admin', 'Admin', 'Admin'),
    fan: L('Fan', 'Fan', 'Fan'),
  };
  const roleLabel = roleLabelMap[role] || L('Fan', 'Fan', 'Fan');

  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e', padding: '0 16px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', height: 56, gap: 8 }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 2, color: '#fff' }}>ANBYANS</span>
        </Link>

        {/* Nav links */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16, overflowX: 'auto' }}>
          {links.map(link => (
            <Link key={link.href} href={link.href} style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              textDecoration: 'none', whiteSpace: 'nowrap',
              color: isActive(link.href) ? accent : '#888',
              background: isActive(link.href) ? accent + '15' : 'transparent',
              borderBottom: isActive(link.href) ? '2px solid ' + accent : '2px solid transparent',
            }}>{link.label}</Link>
          ))}
        </div>

      {/* Language Switcher */}
        <LangSwitcher />
        {/* Right side - not logged in */}
        {!user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Link href="/auth" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', border: '1px solid #06b6d4', color: '#06b6d4', background: 'transparent' }}>
              {L('Konekte', 'Sign In', 'Connexion')}
            </Link>
            <Link href="/auth" style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', border: 'none', color: '#000', background: '#06b6d4' }}>
              {L('Enskri', 'Sign Up', "S'inscrire")}
            </Link>
          </div>
        ) : (
          /* Right side - logged in */
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setMenuOpen(!menuOpen)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 10px 4px 4px', borderRadius: 8,
              border: '1px solid ' + (menuOpen ? accent : '#1e1e2e'),
              background: menuOpen ? accent + '10' : 'transparent',
              cursor: 'pointer',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 800, fontSize: 14 }}>{initial}</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{displayName}</div>
                <div style={{ color: accent, fontSize: 10, textTransform: 'capitalize' }}>{roleLabel}</div>
              </div>
              <span style={{ color: '#555', fontSize: 10, marginLeft: 4 }}>&#9660;</span>
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} />
                <div style={{ position: 'absolute', top: '110%', right: 0, width: 240, background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 10, padding: 6, zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>

                  {/* User info */}
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #1e1e2e', marginBottom: 4 }}>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{displayName}</div>
                    <div style={{
                      display: 'inline-block', marginTop: 4,
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: accent + '22', color: accent, textTransform: 'capitalize',
                    }}>{roleLabel}</div>
                    <div style={{ color: '#555', fontSize: 10, marginTop: 4 }}>{user.email}</div>
                  </div>

                  {/* Shared links — pas pou òganizatè */}
                  {role !== 'organizer' && (
                    <Link href="/events" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: '#ccc', fontSize: 12, textDecoration: 'none' }}>
                      {L('Jwenn Evenman', 'Browse Events', 'Parcourir')}
                    </Link>
                  )}

                  {/* Fan links */}
                  {role === 'fan' && (
                    <>
                      <div style={{ borderTop: '1px solid #1e1e2e', margin: '4px 0' }} />
                      <div style={{ padding: '4px 12px', color: '#555', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Fan</div>
                      <Link href="/buy" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: '#ccc', fontSize: 12, textDecoration: 'none' }}>
                        {L('Achte Tike', 'Buy Tickets', 'Acheter Billets')}
                      </Link>
                    </>
                  )}

                  {/* Organizer links */}
                  {role === 'organizer' && (
                    <>
                      <div style={{ borderTop: '1px solid #1e1e2e', margin: '4px 0' }} />
                      <div style={{ padding: '4px 12px', color: '#555', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {L('Oganizate', 'Organizer', 'Organisateur')}
                      </div>
                      <Link href="/organizer/dashboard" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: '#ccc', fontSize: 12, textDecoration: 'none' }}>
                        {L('Dachbod', 'Dashboard', 'Tableau de bord')}
                      </Link>
                      <Link href="/organizer/events/create" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: '#ccc', fontSize: 12, textDecoration: 'none' }}>
                        {L('+ Kreye Evenman', '+ Create Event', '+ Creer')}
                      </Link>
                      <Link href="/organizer/staff" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: '#ccc', fontSize: 12, textDecoration: 'none' }}>
                        {L('Staf', 'Staff', 'Staff')}
                      </Link>

                    </>
                  )}

                  {/* Reseller links */}
                  {role === 'reseller' && (
                    <>
                      <div style={{ borderTop: '1px solid #1e1e2e', margin: '4px 0' }} />
                      <div style={{ padding: '4px 12px', color: '#555', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {L('Machann', 'Reseller', 'Vendeur')}
                      </div>
                      <Link href="/vendor/dashboard" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: '#ccc', fontSize: 12, textDecoration: 'none' }}>
                        {L('Dachbod', 'Dashboard', 'Tableau de bord')}
                      </Link>
                    </>
                  )}

                  {/* Admin links */}
                  {role === 'admin' && (
                    <>
                      <div style={{ borderTop: '1px solid #1e1e2e', margin: '4px 0' }} />
                      <div style={{ padding: '4px 12px', color: '#555', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Admin</div>
                      <Link href="/admin/dashboard" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: '#ccc', fontSize: 12, textDecoration: 'none' }}>
                        {L('Dachbod', 'Dashboard', 'Tableau de bord')}
                      </Link>
                      <Link href="/tickets" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '8px 12px', borderRadius: 6, color: '#ccc', fontSize: 12, textDecoration: 'none' }}>
                        {L('Tike Mwen', 'My Tickets', 'Mes Billets')}
                      </Link>
                    </>
                  )}

                  {/* Sign out */}
                  <div style={{ borderTop: '1px solid #1e1e2e', marginTop: 4 }} />
                  <button onClick={handleSignOut} style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    border: 'none', background: 'transparent',
                    color: '#ef4444', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  }}>
                    {L('Dekonekte', 'Sign Out', 'Deconnexion')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

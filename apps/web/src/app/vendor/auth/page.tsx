'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/i18n';
import { signIn, signInWithGoogle, getUserProfile } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import LangSwitcher from '@/components/LangSwitcher';

type Tab = 'login' | 'join';

export default function VendorAuth() {
  const router = useRouter();
  const { t } = useT();

  // Redirect already-logged-in vendors
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async u => {
      unsub();
      if (!u) return;
      try {
        const profile = await getUserProfile(u.uid);
        if (profile?.role === 'reseller' || profile?.role === 'admin') {
          router.replace('/vendor/dashboard');
        }
      } catch { /* stay on page */ }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [tab, setTab]               = useState<Tab>('login');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Login fields — phone + PIN
  const [phone, setPhone]   = useState('');
  const [pin, setPin]       = useState('');

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid #1e1e2e', background: '#0a0a0f',
    color: '#fff', fontSize: 15, boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    color: '#888', fontSize: 10, marginBottom: 6, display: 'block',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const clean = phone.replace(/[^0-9]/g, '');
    if (!clean || pin.length < 4) {
      setError('Antre nimewo telefòn ak PIN ou.');
      return;
    }
    setLoading(true);
    try {
      // Vendors were created with phone@vendor.anbyans.events + PIN as password
      const email = `${clean}@vendor.anbyans.events`;
      await signIn(email, pin);
      router.push('/vendor/dashboard');
    } catch {
      setError('Nimewo oswa PIN ou pa kòrèk. Eseye ankò.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(''); setGoogleLoading(true);
    try {
      await signInWithGoogle('reseller');
      router.push('/vendor/dashboard');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1e1e2e' }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 16, letterSpacing: 3, color: '#fff', textDecoration: 'none' }}>ANBYANS</Link>
        <LangSwitcher />
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 420, background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 28 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <p style={{ fontSize: 40, margin: 0 }}>🏪</p>
            <h2 style={{ color: '#a855f7', fontSize: 20, fontWeight: 800, margin: '6px 0 2px' }}>ANBYANS</h2>
            <p style={{ color: '#666', fontSize: 12, margin: 0 }}>Pòtal Vandè / Reseller Portal</p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid #1e1e2e' }}>
            {(['login', 'join'] as Tab[]).map(tb => (
              <button key={tb} onClick={() => { setTab(tb); setError(''); }}
                style={{ flex: 1, padding: '11px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: tab === tb ? '#a855f7' : 'transparent', color: tab === tb ? '#fff' : '#888' }}>
                {tb === 'login' ? '🔐 Konekte' : '✋ Vin Vandè'}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: '#2a1525', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* ── LOGIN TAB ── */}
          {tab === 'login' && (
            <>
              {/* Google */}
              <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading}
                style={{ width: '100%', padding: 13, borderRadius: 8, border: '1px solid #333', background: '#1a1a2a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18, opacity: googleLoading ? 0.6 : 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {googleLoading ? 'Koneksyon...' : 'Kontinye ak Google'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
                <span style={{ color: '#555', fontSize: 12 }}>oswa</span>
                <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
              </div>

              <form onSubmit={handleLogin}>
                {/* Phone */}
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>📱 Nimewo Telefòn</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="3055040143"
                    inputMode="tel"
                    required
                    style={inp}
                  />
                  <p style={{ color: '#555', fontSize: 10, marginTop: 4 }}>
                    Nimewo ou te itilize lè ou te rejwenn.
                  </p>
                </div>

                {/* PIN */}
                <div style={{ marginBottom: 24 }}>
                  <label style={lbl}>🔐 PIN (4 chif)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="••••"
                    required
                    style={{ ...inp, letterSpacing: 8, fontSize: 20, textAlign: 'center' }}
                  />
                </div>

                <button type="submit" disabled={loading || !phone || pin.length < 4}
                  style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: '#a855f7', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !phone || pin.length < 4 ? 0.5 : 1 }}>
                  {loading ? 'Koneksyon...' : '🔐 Konekte'}
                </button>
              </form>
            </>
          )}

          {/* ── JOIN TAB ── */}
          {tab === 'join' && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 48, margin: '0 0 16px' }}>🤝</p>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
                Ou vle vann tikè pou Anbyans?
              </h3>
              <p style={{ color: '#888', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
                Vandè yo resevwa yon <strong style={{ color: '#fff' }}>envitasyon dirèk</strong> nan men yon organizatè.
                Pa gen enskripsyon lib — sa pwoteje evènman yo ak vandè yo.
              </p>

              <div style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'left' }}>
                <p style={{ color: '#a855f7', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Kouman sa travay</p>
                {[
                  ['1', 'Yon organizatè envite ou kòm vandè'],
                  ['2', 'Ou resevwa yon lyen WhatsApp ak kòd envitasyon'],
                  ['3', 'Ou kreye kont ou ak nimewo telefòn + PIN'],
                  ['4', 'Ou kòmanse vann tikè epi fè benefis'],
                ].map(([n, txt]) => (
                  <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                    <span style={{ background: '#a855f722', color: '#a855f7', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{n}</span>
                    <p style={{ color: '#ccc', fontSize: 12, margin: 0, lineHeight: 1.5 }}>{txt}</p>
                  </div>
                ))}
              </div>

              <p style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>
                Ou se yon organizatè epi ou vle ajoute yon vandè?
              </p>
              <a href="https://wa.me/13055040143?text=Mwen%20vle%20vin%20vandè%20pou%20Anbyans"
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', padding: '13px 20px', borderRadius: 10, background: '#25D366', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', marginBottom: 10 }}>
                📱 Kontakte nou sou WhatsApp
              </a>
              <a href="mailto:anbyanssa@gmail.com?subject=Vandè Anbyans"
                style={{ display: 'block', padding: '11px 20px', borderRadius: 10, border: '1px solid #1e1e2e', color: '#888', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                ✉️ anbyanssa@gmail.com
              </a>

              <p style={{ color: '#444', fontSize: 11, marginTop: 16 }}>
                Ou deja gen yon kont?{' '}
                <button onClick={() => setTab('login')} style={{ background: 'none', border: 'none', color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                  Konekte →
                </button>
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

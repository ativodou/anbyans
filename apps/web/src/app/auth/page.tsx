'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';
import { signUp, signIn, signInWithGoogle } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';

type RoleTab = 'fan' | 'organizer' | 'reseller';
type AuthTab = 'login' | 'register';

const ROLE_CONFIG = {
  fan:       { emoji: '🎫', accent: '#06b6d4', redirect: '/events' },
  organizer: { emoji: '🎤', accent: '#f97316', redirect: '/organizer/dashboard' },
  reseller:  { emoji: '🏪', accent: '#a855f7', redirect: '/vendor/dashboard' },
  admin:     { emoji: '⚙️', accent: '#ef4444', redirect: '/admin/dashboard' },
};

function AuthPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useT();
  const { user, loading: authLoading, logout } = useAuth();

  const initialRole = (params.get('tab') as RoleTab) || 'fan';
  const [roleTab, setRoleTab]   = useState<RoleTab>(initialRole);
  const [authTab, setAuthTab]   = useState<AuthTab>('login');
  const [step, setStep]         = useState(1);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass,  setLoginPass]  = useState('');

  // Register fields
  const [firstName, setFirstName]       = useState('');
  const [lastName,  setLastName]        = useState('');
  const [regEmail,  setRegEmail]        = useState('');
  const [phone,     setPhone]           = useState('');
  const [city,      setCity]            = useState('');
  const [state_,    setState_]          = useState('');
  const [country,   setCountry]         = useState('Haiti');
  const [regPass,   setRegPass]         = useState('');
  const [confirmPass, setConfirmPass]   = useState('');
  const [notifications, setNotifications] = useState<string[]>(['whatsapp']);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const cfg = ROLE_CONFIG[roleTab];

  function switchRole(r: RoleTab) {
    setRoleTab(r);
    setAuthTab('login');
    setError('');
    setStep(1);
  }

  function getStrength(p: string) {
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    const labels = [
      { text: '', color: '' },
      { text: t('auth_pw_weak'),         color: '#ef4444' },
      { text: t('auth_pw_medium'),      color: '#f59e0b' },
      { text: t('auth_pw_strong'),      color: '#22c55e' },
      { text: t('auth_pw_very_strong'), color: '#06b6d4' },
    ];
    return labels[s] || labels[0];
  }
  const strength = getStrength(regPass);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signIn(loginEmail, loginPass);
      router.push(cfg.redirect);
    } catch (err: any) {
      setError(err.code === 'auth/invalid-credential'
        ? t('err_invalid_credential')
        : err.message);
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!agreedToTerms) {
      setError(t('err_must_agree_terms'));
      return;
    }
    if (regPass !== confirmPass) {
      setError(t('err_pw_mismatch'));
      return;
    }
    if (regPass.length < 6) {
      setError(t('err_pw_too_short'));
      return;
    }
    setLoading(true);
    try {
      await signUp(regEmail, regPass, {
        firstName, lastName, phone, city, state: state_, country,
        role: roleTab, notifications,
      });
      setStep(3);
    } catch (err: any) {
      setError(err.code === 'auth/email-already-in-use'
        ? t('err_email_in_use')
        : err.message);
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setError(''); setGoogleLoading(true);
    try {
      const { role: actualRole } = await signInWithGoogle(roleTab);
      router.push(ROLE_CONFIG[actualRole as RoleTab]?.redirect ?? '/events');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') setError(err.message);
    } finally { setGoogleLoading(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: 10, borderRadius: 8,
    border: '1px solid #1e1e2e', background: '#0a0a0f',
    color: '#fff', fontSize: 13, boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    color: '#888', fontSize: 12, marginBottom: 4, display: 'block',
  };

  // ── Signed-in banner (non-blocking — form stays accessible) ─────
  const signedInBanner = user && step !== 3 ? (() => {
    const role = (user as any)?.role ?? 'fan';
    const dest = ROLE_CONFIG[role as RoleTab]?.redirect ?? '/events';
    const accent = ROLE_CONFIG[role as RoleTab]?.accent ?? '#06b6d4';
    const name = (user as any)?.firstName || user.email?.split('@')[0] || '';
    return (
      <div style={{ background: '#0f1a0f', border: '1px solid #1a3a1a', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000', flexShrink: 0 }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#aaa', fontSize: 12, margin: 0 }}>Signed in as <strong style={{ color: '#fff' }}>{name}</strong></p>
          <Link href={dest} style={{ fontSize: 11, color: accent, textDecoration: 'none' }}>Go to dashboard →</Link>
        </div>
        <button onClick={async () => { await logout(); }} style={{ background: 'transparent', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, flexShrink: 0 }}>
          Sign out
        </button>
      </div>
    );
  })() : null;

  // ── Success screen ──────────────────────────────────────────────
  if (step === 3) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h1 style={{ color: '#fff', fontSize: 28, marginBottom: 8 }}>
            {t('auth_welcome_title')}
          </h1>
          <p style={{ color: '#aaa', marginBottom: 32 }}>
            {t('auth_account_created')}
          </p>
          <Link href={cfg.redirect} style={{
            display: 'inline-block', padding: '14px 32px', background: cfg.accent,
            color: roleTab === 'fan' ? '#000' : '#fff', borderRadius: 8,
            fontWeight: 700, textDecoration: 'none', fontSize: 16,
          }}>
            {roleTab === 'fan'
              ? t('auth_find_events')
              : roleTab === 'organizer'
              ? t('auth_go_dashboard')
              : t('auth_go_my_space')}
          </Link>
        </div>
      </div>
    );
  }

  // ── Main auth card ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      {/* Mini nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1e1e2e' }}>
        <a href="/" style={{ color: '#666', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          ← {t('auth_back')}
        </a>
        <span style={{ color: '#06b6d4', fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>ANBYANS</span>
        <LangSwitcher />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 32 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <h2 style={{ color: cfg.accent, fontSize: 22, fontWeight: 800, margin: 0 }}>ANBYANS</h2>
          </Link>
          <p style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
            {t('auth_tagline_short')}
          </p>
        </div>

        {signedInBanner}

        {/* Role tabs */}
        <div style={{ display: 'flex', marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid #1e1e2e' }}>
          {(['fan', 'organizer', 'reseller'] as RoleTab[]).map(r => {
            const rc = ROLE_CONFIG[r];
            const active = roleTab === r;
            return (
              <button key={r} onClick={() => switchRole(r)}
                style={{
                  flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, transition: 'all .2s',
                  background: active ? rc.accent : 'transparent',
                  color: active ? (r === 'fan' ? '#000' : '#fff') : '#666',
                }}>
                {rc.emoji}{' '}
                {r === 'fan'
                  ? t('auth_role_fan')
                  : r === 'organizer'
                  ? t('auth_role_organizer')
                  : t('auth_role_reseller')}
              </button>
            );
          })}
        </div>

        {/* Login / Register sub-tabs */}
        <div style={{ display: 'flex', marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid #1e1e2e' }}>
          {(['login', 'register'] as AuthTab[]).map(at => (
            <button key={at} onClick={() => { setAuthTab(at); setError(''); }}
              style={{
                flex: 1, padding: '11px 0', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: authTab === at ? cfg.accent : 'transparent',
                color: authTab === at ? (roleTab === 'fan' ? '#000' : '#fff') : '#666',
              }}>
              {at === 'login'
                ? t('auth_tab_signin')
                : t('auth_tab_signup')}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#2a1515', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Google sign-in */}
        <>
          <button onClick={handleGoogle} disabled={googleLoading}
            style={{
              width: '100%', padding: 13, borderRadius: 8, border: '1px solid #333',
              background: '#1a1a2a', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: googleLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              marginBottom: 18, opacity: googleLoading ? 0.6 : 1,
            }}>
            {googleLoading ? t('auth_connecting') : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t('auth_google')}
              </>
            )}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
            <span style={{ color: '#555', fontSize: 12 }}>{t('auth_or')}</span>
            <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
          </div>
        </>

        {/* LOGIN FORM */}
        {authTab === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>{t('email')}</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>{t('password')}</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required style={inputStyle} />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: cfg.accent, color: roleTab === 'fan' ? '#000' : '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? t('auth_signing_in') : t('auth_sign_in')}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {authTab === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={labelStyle}>{t('auth_first_name')}</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} required style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('auth_last_name')}</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} required style={inputStyle} /></div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>{t('email')}</label>
              <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>{t('phone')}</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+509..." style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={labelStyle}>{t('city')}</label>
                <input value={city} onChange={e => setCity(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('auth_state')}</label>
                <input value={state_} onChange={e => setState_(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('auth_country')}</label>
                <select value={country} onChange={e => setCountry(e.target.value)} style={inputStyle}>
                  <option>Haiti</option><option>USA</option>
                  <option>Canada</option><option>France</option>
                  <option>Rep. Dominiken</option>
                </select></div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>{t('password')}</label>
              <input type="password" value={regPass} onChange={e => setRegPass(e.target.value)} required style={inputStyle} />
              {regPass && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 4, background: '#1e1e2e', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: strength.color, width: `${(regPass.length > 0 ? 25 : 0) + (regPass.length >= 6 ? 25 : 0) + (regPass.length >= 10 ? 25 : 0) + (/[A-Z]/.test(regPass) && /\d/.test(regPass) ? 25 : 0)}%`, transition: 'width .3s' }} />
                  </div>
                  <span style={{ color: strength.color, fontSize: 11, fontWeight: 600 }}>{strength.text}</span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>{t('auth_confirm_password')}</label>
              <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>{t('auth_notifications_label')}</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {['WhatsApp', 'SMS', 'Email'].map(n => (
                  <label key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ccc', fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={notifications.includes(n.toLowerCase())}
                      onChange={e => {
                        const v = n.toLowerCase();
                        setNotifications(e.target.checked ? [...notifications, v] : notifications.filter(x => x !== v));
                      }} />
                    {n}
                  </label>
                ))}
              </div>
            </div>
            {/* Legal agreement */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: cfg.accent }}
              />
              <span style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                {t('auth_read_agree')}{' '}
                <a href="/legal?tab=tos" target="_blank" style={{ color: cfg.accent, textDecoration: 'underline' }}>
                  {t('auth_tos')}
                </a>
                {' '}{t('auth_and')}{' '}
                <a href="/legal?tab=privacy" target="_blank" style={{ color: cfg.accent, textDecoration: 'underline' }}>
                  {t('auth_privacy')}
                </a>
                {' '}{t('auth_of_company')}
              </span>
            </label>
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: cfg.accent, color: roleTab === 'fan' ? '#000' : '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? t('auth_creating') : t('auth_create_account')}
            </button>
          </form>
        )}

      </div>
      </div>
    </div>
  );
}

export default function AuthPageWrapper() {
  return (
    <Suspense>
      <AuthPage />
    </Suspense>
  );
}

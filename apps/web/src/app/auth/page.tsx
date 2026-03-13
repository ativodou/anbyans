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
};

function AuthPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { locale } = useT();
  const { user } = useAuth();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale] ?? ht);

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
  const [firstName, setFirstName]     = useState('');
  const [lastName,  setLastName]      = useState('');
  const [regEmail,  setRegEmail]      = useState('');
  const [phone,     setPhone]         = useState('');
  const [city,      setCity]          = useState('');
  const [state_,    setState_]        = useState('');
  const [country,   setCountry]       = useState('Haiti');
  const [regPass,   setRegPass]       = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [notifications, setNotifications] = useState<string[]>(['whatsapp']);

  const cfg = ROLE_CONFIG[roleTab];

  useEffect(() => {
    if (user) {
      const role = (user as any)?.role ?? 'fan';
      router.push(ROLE_CONFIG[role as RoleTab]?.redirect ?? '/events');
    }
  }, [user]);

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
      { text: L('Feb', 'Weak', 'Faible'),             color: '#ef4444' },
      { text: L('Mwayen', 'Medium', 'Moyen'),          color: '#f59e0b' },
      { text: L('Fo', 'Strong', 'Fort'),               color: '#22c55e' },
      { text: L('Tre fo', 'Very strong', 'Tres fort'), color: '#06b6d4' },
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
        ? L('Imel oswa modpas pa korek', 'Invalid email or password', 'E-mail ou mot de passe invalide')
        : err.message);
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (regPass !== confirmPass) {
      setError(L('Modpas yo pa matche', 'Passwords do not match', 'Les mots de passe ne correspondent pas'));
      return;
    }
    if (regPass.length < 6) {
      setError(L('Modpas dwe gen 6+ karakte', 'Password must be 6+ characters', 'Le mot de passe doit contenir 6+ caracteres'));
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
        ? L('Imel sa a deja itilize', 'Email already in use', 'Cet e-mail est deja utilise')
        : err.message);
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setError(''); setGoogleLoading(true);
    try {
      await signInWithGoogle(roleTab);
      router.push(cfg.redirect);
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

  // ── Success screen ───────────────────────────────────────────────
  if (step === 3) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h1 style={{ color: '#fff', fontSize: 28, marginBottom: 8 }}>
            {L('Byenveni nan Anbyans!', 'Welcome to Anbyans!', 'Bienvenue chez Anbyans!')}
          </h1>
          <p style={{ color: '#aaa', marginBottom: 32 }}>
            {L('Kont ou kreye. Ale jwenn evenman!', 'Account created. Go find events!', 'Compte cree. Trouvez des evenements!')}
          </p>
          <Link href={cfg.redirect} style={{
            display: 'inline-block', padding: '14px 32px', background: cfg.accent,
            color: roleTab === 'fan' ? '#000' : '#fff', borderRadius: 8,
            fontWeight: 700, textDecoration: 'none', fontSize: 16,
          }}>
            {roleTab === 'fan'
              ? L('Jwenn Evenman', 'Find Events', 'Trouver des evenements')
              : roleTab === 'organizer'
              ? L('Ale nan Dachbod', 'Go to Dashboard', 'Aller au tableau de bord')
              : L('Ale nan Espas Mwen', 'Go to My Space', 'Aller a mon espace')}
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
          ← {L('Retounen', 'Back', 'Retour')}
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
              {L('Evenman pou nou, pa nou', 'Events for us, by us', 'Evenements pour nous, par nous')}
            </p>
          </div>

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
                    ? L('Fan', 'Fan', 'Fan')
                    : r === 'organizer'
                    ? L('Òganizatè', 'Organizer', 'Organisateur')
                    : L('Revandè', 'Reseller', 'Revendeur')}
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
                  ? L('Konekte', 'Sign In', 'Connexion')
                  : L('Kreye Kont', 'Sign Up', "Creer un compte")}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#2a1515', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Google button — all tabs */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              width: '100%', padding: 13, borderRadius: 8, border: '1px solid #333',
              background: '#1a1a2a', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: googleLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              marginBottom: 18, opacity: googleLoading ? 0.6 : 1,
            }}>
            {googleLoading ? L('Ap konekte...', 'Connecting...', 'Connexion...') : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {L('Kontinye ak Google', 'Continue with Google', 'Continuer avec Google')}
              </>
            )}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
            <span style={{ color: '#555', fontSize: 12 }}>{L('oswa', 'or', 'ou')}</span>
            <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
          </div>

          {/* LOGIN FORM */}
          {authTab === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{L('Imel', 'Email', 'E-mail')}</label>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>{L('Modpas', 'Password', 'Mot de passe')}</label>
                <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required style={inputStyle} />
              </div>
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: cfg.accent, color: roleTab === 'fan' ? '#000' : '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? L('Ap konekte...', 'Signing in...', 'Connexion...') : L('Konekte', 'Sign In', 'Se connecter')}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {authTab === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label style={labelStyle}>{L('Prenon', 'First Name', 'Prenom')}</label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} required style={inputStyle} /></div>
                <div><label style={labelStyle}>{L('Non', 'Last Name', 'Nom')}</label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} required style={inputStyle} /></div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{L('Imel', 'Email', 'E-mail')}</label>
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{L('Telefon', 'Phone', 'Telephone')}</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+509..." style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div><label style={labelStyle}>{L('Vil', 'City', 'Ville')}</label>
                  <input value={city} onChange={e => setCity(e.target.value)} style={inputStyle} /></div>
                <div><label style={labelStyle}>{L('Eta', 'State', 'Etat')}</label>
                  <input value={state_} onChange={e => setState_(e.target.value)} style={inputStyle} /></div>
                <div><label style={labelStyle}>{L('Peyi', 'Country', 'Pays')}</label>
                  <select value={country} onChange={e => setCountry(e.target.value)} style={inputStyle}>
                    <option>Haiti</option><option>USA</option>
                    <option>Canada</option><option>France</option>
                    <option>Rep. Dominiken</option>
                  </select></div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{L('Modpas', 'Password', 'Mot de passe')}</label>
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
                <label style={labelStyle}>{L('Konfime Modpas', 'Confirm Password', 'Confirmer le mot de passe')}</label>
                <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>{L('Notifikasyon', 'Notifications', 'Notifications')}</label>
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
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: cfg.accent, color: roleTab === 'fan' ? '#000' : '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? L('Ap kreye...', 'Creating...', 'Creation...') : L('Kreye Kont', 'Create Account', "Creer un compte")}
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
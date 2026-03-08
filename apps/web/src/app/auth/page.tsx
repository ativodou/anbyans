'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/i18n';
import { signUp, signIn, signInWithGoogle } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';

export default function FanAuth() {
  const router = useRouter();
  const { locale } = useT();
  const { user } = useAuth();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale]);

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState(1);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [city, setCity] = useState('');
  const [state_, setState_] = useState('');
  const [country, setCountry] = useState('Haiti');
  const [notifications, setNotifications] = useState(['whatsapp']);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  if (user) { router.push('/events'); return null; }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signIn(loginEmail, loginPass);
      router.push('/events');
    } catch (err: any) {
      setError(err.code === 'auth/invalid-credential'
        ? L('Imel oswa modpas pa korek', 'Invalid email or password', 'E-mail ou mot de passe invalide')!
        : err.message);
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (regPass !== confirmPass) { setError(L('Modpas yo pa matche', 'Passwords do not match', 'Les mots de passe ne correspondent pas')!); return; }
    if (regPass.length < 6) { setError(L('Modpas dwe gen 6+ karakte', 'Password must be 6+ characters', 'Le mot de passe doit contenir 6+ caracteres')!); return; }
    setLoading(true);
    try {
      await signUp(regEmail, regPass, {
        firstName, lastName, phone, city, state: state_, country,
        role: 'fan', notifications,
      });
      setStep(3);
    } catch (err: any) {
      setError(err.code === 'auth/email-already-in-use'
        ? L('Imel sa a deja itilize', 'Email already in use', 'Cet e-mail est deja utilise')!
        : err.message);
    } finally { setLoading(false); }
  }

  async function handleGoogleSignIn() {
    setError(''); setGoogleLoading(true);
    try {
      await signInWithGoogle('fan');
      router.push('/events');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') setError(err.message);
    } finally { setGoogleLoading(false); }
  }

  function getStrength(p: string) {
    let s = 0;
    if (p.length >= 6) s++; if (p.length >= 10) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++;
    const labels = [
      { text: '', color: '' },
      { text: L('Feb', 'Weak', 'Faible'), color: '#ef4444' },
      { text: L('Mwayen', 'Medium', 'Moyen'), color: '#f59e0b' },
      { text: L('Fo', 'Strong', 'Fort'), color: '#22c55e' },
      { text: L('Tre fo', 'Very strong', 'Tres fort'), color: '#06b6d4' },
    ];
    return labels[s] || labels[0];
  }
  const strength = getStrength(regPass);

  const inputStyle: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13, boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { color: '#888', fontSize: 12, marginBottom: 4, display: 'block' };

  if (step === 3) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>&#x1F389;</div>
          <h1 style={{ color: '#fff', fontSize: 28, marginBottom: 8 }}>
            {L('Byenveni nan Anbyans!', 'Welcome to Anbyans!', 'Bienvenue chez Anbyans!')}
          </h1>
          <p style={{ color: '#aaa', marginBottom: 32 }}>
            {L('Kont ou kreye. Ale jwenn evenman!', 'Account created. Go find events!', 'Compte cree. Trouvez des evenements!')}
          </p>
          <Link href="/events" style={{
            display: 'inline-block', padding: '14px 32px', background: '#06b6d4',
            color: '#000', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 16
          }}>
            {L('Jwenn Evenman', 'Find Events', 'Trouver des evenements')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ color: '#06b6d4', fontSize: 22, fontWeight: 800 }}>ANBYANS</h2>
          <p style={{ color: '#666', fontSize: 13 }}>{L('Evenman pou nou, pa nou', 'Events for us, by us', 'Evenements pour nous, par nous')}</p>
        </div>

        <div style={{ display: 'flex', marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid #1e1e2e' }}>
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                background: tab === t ? '#06b6d4' : 'transparent',
                color: tab === t ? '#000' : '#888',
              }}>
              {t === 'login' ? L('Konekte', 'Login', 'Connexion') : L('Kreye Kont', 'Sign Up', 'Creer un compte')}
            </button>
          ))}
        </div>

        {error && <div style={{ background: '#2a1515', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>{error}</div>}

        <button onClick={handleGoogleSignIn} disabled={googleLoading}
          style={{
            width: '100%', padding: 14, borderRadius: 8, border: '1px solid #333',
            background: '#1a1a2a', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: googleLoading ? 'not-allowed' : 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20,
            opacity: googleLoading ? 0.6 : 1,
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
          <span style={{ color: '#555', fontSize: 12 }}>{L('oswa', 'or', 'ou')}</span>
          <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
        </div>

        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{L('Imel', 'Email', 'E-mail')}</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>{L('Modpas', 'Password', 'Mot de passe')}</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required style={inputStyle} />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#06b6d4', color: '#000', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? L('Ap konekte...', 'Signing in...', 'Connexion...') : L('Konekte', 'Sign In', 'Se connecter')}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><label style={labelStyle}>{L('Prenon', 'First Name', 'Prenom')}</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} required style={inputStyle} /></div>
              <div><label style={labelStyle}>{L('Non', 'Last Name', 'Nom')}</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} required style={inputStyle} /></div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>{L('Imel', 'Email', 'E-mail')}</label>
              <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>{L('Telefon', 'Phone', 'Telephone')}</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+509..." style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div><label style={labelStyle}>{L('Vil', 'City', 'Ville')}</label>
                <input value={city} onChange={e => setCity(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>{L('Eta', 'State', 'Etat')}</label>
                <input value={state_} onChange={e => setState_(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>{L('Peyi', 'Country', 'Pays')}</label>
                <select value={country} onChange={e => setCountry(e.target.value)} style={inputStyle}>
                  <option value="Haiti">Haiti</option><option value="USA">USA</option>
                  <option value="Canada">Canada</option><option value="France">France</option>
                  <option value="Rep. Dominiken">Rep. Dominiken</option>
                </select></div>
            </div>
            <div style={{ marginBottom: 14 }}>
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
            <div style={{ marginBottom: 20 }}>
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
              style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#06b6d4', color: '#000', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? L('Ap kreye...', 'Creating...', 'Creation...') : L('Kreye Kont', 'Create Account', 'Creer un compte')}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#555' }}>
          {L('Ou se pwomote?', 'Are you a promoter?', 'Etes-vous un promoteur?')}{' '}
          <Link href="/organizer/auth" style={{ color: '#f97316' }}>
            {L('Konekte kom organizate', 'Sign in as organizer', "Connexion en tant qu'organisateur")}
          </Link>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: '#555' }}>
          {L('Ou se revandè?', 'Are you a reseller?', 'Etes-vous un revendeur?')}{' '}
          <Link href="/vendor/login" style={{ color: '#a855f7' }}>
            {L('Konekte kom revande', 'Sign in as reseller', 'Connexion en tant que revendeur')}
          </Link>
        </div>
      </div>
    </div>
  );
}
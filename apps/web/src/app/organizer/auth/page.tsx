'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/i18n';
import { signUp, signIn, signInWithGoogle, startGoogleRedirect, handleGoogleRedirectResult, getUserProfile } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';

export default function OrganizerAuth() {
  const router = useRouter();
  const { t } = useT();
  const { user } = useAuth();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState(1);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [city, setCity] = useState('');
  const [state_, setState_] = useState('');
  const [country, setCountry] = useState('Haiti');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutDetails, setPayoutDetails] = useState('');
  const [regPass, setRegPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (user && (user.role === 'organizer' || user.role === 'admin')) {
      router.replace('/organizer/dashboard');
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle return from Google redirect (mobile)
  useEffect(() => {
    handleGoogleRedirectResult('organizer').then(result => {
      if (!result) return;
      router.replace('/organizer/dashboard');
    }).catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const fbUser = await signIn(loginEmail, loginPass);
      const profile = await getUserProfile(fbUser.uid);
      if (profile?.role !== 'organizer' && profile?.role !== 'admin') {
        setError('Kont sa a pa yon kont òganizatè / This is not an organizer account');
        return;
      }
      router.push('/organizer/dashboard');
    } catch (err: any) {
      setError(err.code === 'auth/invalid-credential'
        ? t('err_invalid_credential')
        : err.message);
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (regPass !== confirmPass) { setError(t('err_pw_mismatch')); return; }
    if (!agreedToTerms) { setError(t('err_must_agree_terms')); return; }
    if (regPass.length < 6) { setError(t('err_pw_too_short')); return; }
    setLoading(true);
    try {
      await signUp(regEmail, regPass, {
        firstName, lastName, phone, city, state: state_, country,
        role: 'organizer', businessName, businessType, payoutMethod, payoutDetails,
      });
      setStep(3);
    } catch (err: any) {
      setError(err.code === 'auth/email-already-in-use'
        ? t('err_email_in_use')
        : err.message);
    } finally { setLoading(false); }
  }

  async function handleGoogleSignIn() {
    setError(''); setGoogleLoading(true);
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
      await startGoogleRedirect();
      return;
    }
    try {
      await signInWithGoogle('organizer');
      router.push('/organizer/dashboard');
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
      { text: t('auth_pw_weak'), color: '#ef4444' },
      { text: t('auth_pw_medium'), color: '#f59e0b' },
      { text: t('auth_pw_strong'), color: '#22c55e' },
      { text: t('auth_pw_very_strong'), color: '#06b6d4' },
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
            {t('org_auth_welcome_org')}
          </h1>
          <p style={{ color: '#aaa', marginBottom: 32 }}>
            {t('org_auth_account_ready')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/organizer/dashboard" style={{ padding: '14px 28px', background: '#f97316', color: '#000', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>
              {t('dashboard')}
            </Link>
            <Link href="/organizer/events/create" style={{ padding: '14px 28px', border: '1px solid #f97316', color: '#f97316', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>
              {t('create_event')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ color: '#f97316', fontSize: 22, fontWeight: 800 }}>ANBYANS</h2>
          <p style={{ color: '#666', fontSize: 13 }}>{t('org_auth_portal_sub')}</p>
        </div>

        <div style={{ display: 'flex', marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid #1e1e2e' }}>
          {(['login', 'register'] as const).map(tb => (
            <button key={tb} onClick={() => { setTab(tb); setError(''); }}
              style={{
                flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                background: tab === tb ? '#f97316' : 'transparent',
                color: tab === tb ? '#000' : '#888',
              }}>
              {tb === 'login' ? t('org_auth_login_label') : t('org_auth_register_label')}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
          <span style={{ color: '#555', fontSize: 12 }}>{t('auth_or')}</span>
          <div style={{ flex: 1, height: 1, background: '#1e1e2e' }} />
        </div>

        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('email')}</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>{t('password')}</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required style={inputStyle} />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#f97316', color: '#000', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? t('auth_signing_in') : t('auth_sign_in')}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={labelStyle}>{t('auth_first_name')}</label><input value={firstName} onChange={e => setFirstName(e.target.value)} required style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('auth_last_name')}</label><input value={lastName} onChange={e => setLastName(e.target.value)} required style={inputStyle} /></div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>{t('org_auth_biz_name')}</label>
              <input value={businessName} onChange={e => setBusinessName(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>{t('org_auth_biz_type')}</label>
              <select value={businessType} onChange={e => setBusinessType(e.target.value)} required style={inputStyle}>
                <option value="">{t('org_auth_select')}</option>
                <option value="promoter">{t('org_auth_promoter')}</option>
                <option value="venue">{t('org_auth_venue')}</option>
                <option value="artist">{t('org_auth_artist')}</option>
                <option value="sports">{t('org_auth_sports')}</option>
                <option value="nonprofit">{t('org_auth_nonprofit')}</option>
                <option value="religious">{t('org_auth_religious')}</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={labelStyle}>{t('email')}</label><input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('phone')}</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="+509..." /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={labelStyle}>{t('city')}</label><input value={city} onChange={e => setCity(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('auth_state')}</label><input value={state_} onChange={e => setState_(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>{t('auth_country')}</label>
                <select value={country} onChange={e => setCountry(e.target.value)} style={inputStyle}>
                  <option value="Haiti">Haiti</option><option value="USA">USA</option>
                  <option value="Canada">Canada</option><option value="France">France</option>
                  <option value="Rep. Dominiken">Rep. Dominiken</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>{t('org_auth_payout_method')}</label>
                <select value={payoutMethod} onChange={e => setPayoutMethod(e.target.value)} style={inputStyle}>
                  <option value="">{t('org_auth_select')}</option>
                  <option value="moncash">MonCash</option>
                  <option value="natcash">Natcash</option>
                  <option value="stripe">Stripe</option>
                  <option value="bank">{t('org_auth_bank')}</option>
                  <option value="zelle">Zelle</option>
                  <option value="paypal">PayPal</option>
                  <option value="cashapp">Cash App</option>
                </select>
              </div>
              <div><label style={labelStyle}>{t('org_auth_account_details')}</label><input value={payoutDetails} onChange={e => setPayoutDetails(e.target.value)} style={inputStyle} /></div>
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
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>{t('auth_confirm_password')}</label>
              <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required style={inputStyle} />
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18, cursor: 'pointer' }}>
              <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} style={{ marginTop: 2, flexShrink: 0, accentColor: '#f97316' }} />
              <span style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                {t('auth_read_agree')}{' '}
                <a href="/legal?tab=tos" target="_blank" style={{ color: '#f97316', textDecoration: 'underline' }}>{t('auth_tos')}</a>
                {' '}{t('auth_and')}{' '}
                <a href="/legal?tab=privacy" target="_blank" style={{ color: '#f97316', textDecoration: 'underline' }}>{t('auth_privacy')}</a>
                {' '}{t('auth_of_company')}
              </span>
            </label>
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#f97316', color: '#000', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? t('auth_creating') : t('org_auth_create_btn')}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#555' }}>
          {t('org_auth_fan_link_text')}{' '}
          <Link href="/auth" style={{ color: '#06b6d4' }}>{t('org_auth_fan_signin')}</Link>
        </div>
      </div>
    </div>
  );
}

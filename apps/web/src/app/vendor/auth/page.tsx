'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/i18n';
import { signUp, signIn, signInWithGoogle, getUserProfile } from '@/lib/auth';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, limit, serverTimestamp } from 'firebase/firestore';
import LangSwitcher from '@/components/LangSwitcher';

type Tab = 'login' | 'register';
export default function VendorAuth() {
  const router = useRouter();
  const { t } = useT();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async u => {
      unsub();
      if (!u) return;
      try {
        const profile = await getUserProfile(u.uid);
        if (profile?.role === 'reseller' || profile?.role === 'admin') {
          router.replace('/vendor/dashboard');
        }
      } catch { /* stay on page if profile fetch fails */ }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [tab, setTab] = useState<Tab>('login');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Haiti');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutDetails, setPayoutDetails] = useState('');
  const [regPass, setRegPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);


  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13, boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { color: '#888', fontSize: 11, marginBottom: 4, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try { await signIn(loginEmail, loginPass); router.push('/vendor/dashboard'); }
    catch { setError(t('vend_auth_wrong_creds')); }
    finally { setLoading(false); }
  }

  async function handleGoogleSignIn() {
    setError(''); setGoogleLoading(true);
    try {
      const { user } = await signInWithGoogle('reseller');
      // ensure a vendors doc exists — Google sign-in skips the registration form
      const existing = await getDocs(query(collection(db, 'vendors'), where('uid', '==', user.uid), limit(1)));
      if (existing.empty) {
        const displayName = user.displayName || user.email?.split('@')[0] || 'Vande';
        await addDoc(collection(db, 'vendors'), {
          uid: user.uid,
          name: displayName,
          contact: user.email || '',
          phone: user.phoneNumber || '',
          city: '', country: '',
          organizerId: '', payMethod: '', payAccount: '',
          status: 'pending',
          joinedDate: new Date().toISOString().slice(0, 10),
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      }
      router.push('/vendor/dashboard');
    }
    catch (err: any) { if (err.code !== 'auth/popup-closed-by-user') setError(err.message); }
    finally { setGoogleLoading(false); }
  }

  async function handleStep1Next() {
    setError('');
    if (!firstName.trim()) { setError(t('vend_auth_enter_first')); return; }
    if (!businessName.trim()) { setError(t('vend_auth_enter_biz')); return; }
    if (!regEmail.trim()) { setError(t('vend_auth_enter_email')); return; }
    if (regPass.length < 6) { setError(t('vend_auth_pw_short')); return; }
    if (regPass !== confirmPass) { setError(t('vend_auth_pw_mismatch')); return; }
    if (!agreedToTerms) { setError(t('vend_auth_must_agree')); return; }
    await handleRegister();
  }

  async function handleRegister() {
    setError(''); setLoading(true);
    try {
      const user = await signUp(regEmail, regPass, { firstName, lastName, phone, city, country, role: 'reseller', businessName, payoutMethod, payoutDetails });
      await addDoc(collection(db, 'vendors'), {
        uid: user.uid,
        name: businessName.trim() || `${firstName} ${lastName}`.trim(),
        contact: regEmail.trim(), phone: phone.trim(), city: city.trim(), country,
        organizerId: '', payMethod: payoutMethod, payAccount: payoutDetails,
        status: 'pending',
        joinedDate: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setDone(true);
    } catch (err: any) {
      setError(err.code === 'auth/email-already-in-use'
        ? t('vend_auth_email_in_use') : err.message);
    } finally { setLoading(false); }
  }

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <p style={{ fontSize: 64, margin: 0 }}>🏪</p>
      <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: 0 }}>{t('vend_auth_account_created')}</h1>
      <p style={{ color: '#aaa', fontSize: 14, maxWidth: 340, margin: 0 }}>
        {t('vend_auth_pending_msg')}
      </p>

      <Link href="/vendor/dashboard" style={{ display: 'inline-block', padding: '14px 32px', background: '#a855f7', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
        {t('vend_auth_go_dashboard')}
      </Link>
    </div>
  );

  const googleBtn = (label: string) => (
    <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading}
      style={{ width: '100%', padding: 13, borderRadius: 8, border: '1px solid #333', background: '#1a1a2a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18, opacity: googleLoading ? 0.6 : 1 }}>
      <svg width="16" height="16" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {googleLoading ? t('auth_connecting') : label}
    </button>
  );

  const divider = <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}><div style={{ flex: 1, height: 1, background: '#1e1e2e' }} /><span style={{ color: '#555', fontSize: 12 }}>{t('auth_or')}</span><div style={{ flex: 1, height: 1, background: '#1e1e2e' }} /></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1e1e2e' }}>
        <Link href="/" style={{ fontWeight: 800, fontSize: 16, letterSpacing: 3, color: '#fff', textDecoration: 'none' }}>ANBYANS</Link>
        <LangSwitcher />
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, paddingTop: 24 }}>
        <div style={{ width: '100%', maxWidth: 460, background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 28 }}>

          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <p style={{ fontSize: 36, margin: 0 }}>🏪</p>
            <h2 style={{ color: '#a855f7', fontSize: 20, fontWeight: 800, margin: '6px 0 2px' }}>ANBYANS</h2>
            <p style={{ color: '#666', fontSize: 12, margin: 0 }}>{t('vend_auth_portal_sub')}</p>
          </div>

          {(
            <div style={{ display: 'flex', marginBottom: 22, borderRadius: 8, overflow: 'hidden', border: '1px solid #1e1e2e' }}>
              {(['login', 'register'] as Tab[]).map(tb => (
                <button key={tb} onClick={() => { setTab(tb); setError(''); }}
                  style={{ flex: 1, padding: '11px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: tab === tb ? '#a855f7' : 'transparent', color: tab === tb ? '#fff' : '#888' }}>
                  {tb === 'login' ? t('vend_auth_login_label') : t('vend_auth_register_label')}
                </button>
              ))}
            </div>
          )}



          {error && <div style={{ background: '#2a1525', border: '1px solid #ef4444', borderRadius: 8, padding: '9px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>{error}</div>}

          {/* LOGIN */}
          {tab === 'login' && (
            <>
              {googleBtn(t('vend_auth_google_login'))}
              {divider}
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 14 }}><label style={lbl}>{t('email')}</label><input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={inp} /></div>
                <div style={{ marginBottom: 22 }}><label style={lbl}>{t('password')}</label><input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required style={inp} /></div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#a855f7', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {loading ? t('auth_signing_in') : t('auth_sign_in')}
                </button>
              </form>
            </>
          )}

          {/* REGISTER STEP 1 */}
          {tab === 'register' && (
            <div>
              {googleBtn(t('vend_auth_google_signup'))}
              {divider}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div><label style={lbl}>{t('vend_auth_first_req')}</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inp} /></div>
                <div><label style={lbl}>{t('auth_last_name')}</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inp} /></div>
              </div>
              <div style={{ marginBottom: 12 }}><label style={lbl}>{t('vend_auth_biz_shop')}</label><input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Ex: Tike Rapid" style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div><label style={lbl}>{t('email')} *</label><input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} style={inp} /></div>
                <div><label style={lbl}>WhatsApp</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+509 XXXX XXXX" style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div><label style={lbl}>{t('city')}</label><input value={city} onChange={e => setCity(e.target.value)} style={inp} /></div>
                <div><label style={lbl}>{t('auth_country')}</label>
                  <select value={country} onChange={e => setCountry(e.target.value)} style={inp}>
                    <option value="Haiti">Haiti</option><option value="USA">USA</option><option value="Canada">Canada</option><option value="France">France</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div><label style={lbl}>{t('vend_auth_payout_method')}</label>
                  <select value={payoutMethod} onChange={e => setPayoutMethod(e.target.value)} style={inp}>
                    <option value="">{t('org_auth_select')}</option>
                    <option value="moncash">MonCash</option><option value="natcash">Natcash</option>
                    <option value="zelle">Zelle</option><option value="paypal">PayPal</option>
                    <option value="cashapp">Cash App</option><option value="bank">{t('vend_auth_bank')}</option>
                  </select>
                </div>
                <div><label style={lbl}>{t('vend_auth_account_details')}</label><input value={payoutDetails} onChange={e => setPayoutDetails(e.target.value)} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                <div><label style={lbl}>{t('vend_auth_pw_req')}</label><input type="password" value={regPass} onChange={e => setRegPass(e.target.value)} style={inp} /></div>
                <div><label style={lbl}>{t('vend_auth_confirm_req')}</label><input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} style={{ ...inp, borderColor: confirmPass && regPass !== confirmPass ? '#ef4444' : '#1e1e2e' }} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
                <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} style={{ marginTop: 2, flexShrink: 0, accentColor: '#a855f7' }} />
                <span style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                  {t('auth_read_agree')}{' '}
                  <a href="/legal?tab=tos" target="_blank" style={{ color: '#a855f7', textDecoration: 'underline' }}>{t('auth_tos')}</a>
                  {' '}{t('auth_and')}{' '}
                  <a href="/legal?tab=privacy" target="_blank" style={{ color: '#a855f7', textDecoration: 'underline' }}>{t('auth_privacy')}</a>
                  {' '}{t('auth_of_company')}
                </span>
              </label>
              <button onClick={handleStep1Next} style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#a855f7', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {loading ? t('auth_creating') : t('vend_auth_register_label')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

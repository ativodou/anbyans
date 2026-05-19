'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';

type VendorInvite = { id: string; contact: string; organizerId: string; status: string };

function VendorJoinInner() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';

  const [invite, setInvite] = useState<VendorInvite | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setLoadState('invalid'); return; }
    (async () => {
      try {
        const q = query(collection(db, 'vendors'), where('inviteToken', '==', token), where('status', '==', 'pending'));
        const snap = await getDocs(q);
        if (snap.empty) { setLoadState('invalid'); return; }
        const d = snap.docs[0];
        setInvite({ id: d.id, ...(d.data() as any) });
        setPhone((d.data() as any).contact || '');
        setLoadState('valid');
      } catch {
        setLoadState('invalid');
      }
    })();
  }, [token]);

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) { setError(t('vend_join_name_err')); return; }
    if (!phone.trim()) { setError(t('vend_join_phone_err')); return; }
    if (pin.length < 4) { setError(t('vend_join_pin_short')); return; }
    if (pin !== pinConfirm) { setError(t('vend_join_pin_mismatch')); return; }
    if (!invite) return;
    setSubmitting(true);
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const email = `${cleanPhone}@vendor.anbyans.events`;
      const cred = await createUserWithEmailAndPassword(auth, email, pin);
      await updateDoc(doc(db, 'vendors', invite.id), {
        uid: cred.user.uid,
        name: name.trim(),
        phone: phone.trim(),
        email,
        status: 'active',
        activatedAt: new Date().toISOString(),
        inviteToken: null,
      });
      setDone(true);
      setTimeout(() => router.push('/vendor/dashboard'), 2000);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError(t('vend_join_phone_in_use'));
      } else {
        setError(err.message || t('vend_join_error'));
      }
    }
    setSubmitting(false);
  };

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center gap-4">
      <div className="text-6xl">🎉</div>
      <h2 className="font-heading text-3xl tracking-wide">{t('vend_join_activated')}</h2>
      <p className="text-gray-light text-sm">{t('vend_join_redirecting')}</p>
    </div>
  );

  if (loadState === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-cyan border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (loadState === 'invalid') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center gap-4">
      <div className="text-5xl">⚠️</div>
      <h2 className="font-heading text-2xl tracking-wide">{t('vend_join_invalid_inv')}</h2>
      <p className="text-gray-light text-sm max-w-sm">{t('vend_join_inv_expired')}</p>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 bg-dark border-b border-border px-5">
        <div className="max-w-[480px] mx-auto flex items-center h-[52px] gap-3">
          <span className="font-heading text-sm tracking-widest flex-1">ANBYANS</span>
          <LangSwitcher />
        </div>
      </nav>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🏪</div>
            <h1 className="font-heading text-3xl tracking-wide mb-1">{t('vend_join_title')}</h1>
            <p className="text-xs text-gray-light">{t('vend_join_invited')}</p>
          </div>
          <div className="bg-dark-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-[11px] text-gray-light font-bold mb-1.5 block">{t('vend_join_biz_name')}</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={t('vend_join_biz_ph')}
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" />
            </div>
            <div>
              <label className="text-[11px] text-gray-light font-bold mb-1.5 block">{t('vend_join_phone_label')}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                placeholder="+509 XXXX XXXX"
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" />
            </div>
            <div>
              <label className="text-[11px] text-gray-light font-bold mb-1.5 block">{t('vend_join_pin_label')}</label>
              <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))} type="password" inputMode="numeric"
                placeholder="••••••"
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" />
            </div>
            <div>
              <label className="text-[11px] text-gray-light font-bold mb-1.5 block">{t('vend_join_pin_confirm')}</label>
              <input value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g,'').slice(0,6))} type="password" inputMode="numeric"
                placeholder="••••••"
                className={`w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border text-white text-[13px] outline-none placeholder:text-gray-muted ${pinConfirm && pin !== pinConfirm ? 'border-red' : 'border-border focus:border-cyan'}`} />
            </div>
            {error && <p className="text-[11px] text-red">{error}</p>}
            <button onClick={handleSubmit} disabled={submitting}
              className={`w-full py-3 rounded-[10px] font-bold text-sm transition-all ${submitting ? 'bg-white/[0.04] text-gray-muted cursor-not-allowed' : 'bg-cyan text-dark hover:bg-white'}`}>
              {submitting ? t('vend_join_creating') : t('vend_join_activate_btn')}
            </button>
            <p className="text-[10px] text-gray-muted text-center">{t('vend_join_pin_hint')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VendorJoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VendorJoinInner />
    </Suspense>
  );
}

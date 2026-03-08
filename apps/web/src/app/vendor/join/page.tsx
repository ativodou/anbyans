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
  const { locale } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale as 'ht' | 'en' | 'fr'] ?? ht);

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
    if (!name.trim()) { setError(L('Mete non ou.', 'Enter your name.', 'Entrez votre nom.')); return; }
    if (!phone.trim()) { setError(L('Mete nimewo telefon ou.', 'Enter your phone number.', 'Entrez votre numero.')); return; }
    if (pin.length < 4) { setError(L('PIN dwe gen 4 chif omwen.', 'PIN must be at least 4 digits.', 'Le PIN doit avoir au moins 4 chiffres.')); return; }
    if (pin !== pinConfirm) { setError(L('PIN yo pa menm.', 'PINs do not match.', 'Les PIN ne correspondent pas.')); return; }
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
        setError(L('Nimewo sa a deja itilize. Konekte nan paj login a.', 'This phone is already registered. Please log in.', 'Ce numero est deja enregistre. Connectez-vous.'));
      } else {
        setError(err.message || L('Ere. Eseye anko.', 'Error. Try again.', 'Erreur. Reessayez.'));
      }
    }
    setSubmitting(false);
  };

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center gap-4">
      <div className="text-6xl">🎉</div>
      <h2 className="font-heading text-3xl tracking-wide">{L('KOT OU AKTIVE!', 'ACCOUNT ACTIVATED!', 'COMPTE ACTIVE !')}</h2>
      <p className="text-gray-light text-sm">{L("Y ap redirije ou...", 'Redirecting you...', 'Redirection en cours...')}</p>
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
      <h2 className="font-heading text-2xl tracking-wide">{L('ENVITASYON PA VALID', 'INVALID INVITATION', 'INVITATION INVALIDE')}</h2>
      <p className="text-gray-light text-sm max-w-sm">{L("Lyen sa a ekspire oswa deja itilize. Kontakte ogatizate a.", 'This link has expired or already been used. Contact the organizer.', "Ce lien a expire ou a deja ete utilise. Contactez l'organisateur.")}</p>
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
            <h1 className="font-heading text-3xl tracking-wide mb-1">{L('KREYE KOT VANDE', 'CREATE VENDOR ACCOUNT', 'CREER UN COMPTE VENDEUR')}</h1>
            <p className="text-xs text-gray-light">{L('Ou te envite kom vande sou Anbyans.', 'You were invited as a vendor on Anbyans.', 'Vous avez ete invite comme vendeur sur Anbyans.')}</p>
          </div>
          <div className="bg-dark-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-[11px] text-gray-light font-bold mb-1.5 block">{L('Non Biznis / Non Ou', 'Business / Your Name', "Nom de l'entreprise / Votre nom")}</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={L('Ex: Tike Rapid', 'Ex: Quick Tickets', 'Ex: Billets Rapides') ?? ''}
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" />
            </div>
            <div>
              <label className="text-[11px] text-gray-light font-bold mb-1.5 block">{L('Nimewo WhatsApp / Telefon', 'WhatsApp / Phone Number', 'Numero WhatsApp / Telephone')}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                placeholder="+509 XXXX XXXX"
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" />
            </div>
            <div>
              <label className="text-[11px] text-gray-light font-bold mb-1.5 block">{L('Kreye PIN (4-6 chif)', 'Create PIN (4-6 digits)', 'Creer un PIN (4-6 chiffres)')}</label>
              <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))} type="password" inputMode="numeric"
                placeholder="••••••"
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" />
            </div>
            <div>
              <label className="text-[11px] text-gray-light font-bold mb-1.5 block">{L('Konfime PIN', 'Confirm PIN', 'Confirmer le PIN')}</label>
              <input value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g,'').slice(0,6))} type="password" inputMode="numeric"
                placeholder="••••••"
                className={`w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border text-white text-[13px] outline-none placeholder:text-gray-muted ${pinConfirm && pin !== pinConfirm ? 'border-red' : 'border-border focus:border-cyan'}`} />
            </div>
            {error && <p className="text-[11px] text-red">{error}</p>}
            <button onClick={handleSubmit} disabled={submitting}
              className={`w-full py-3 rounded-[10px] font-bold text-sm transition-all ${submitting ? 'bg-white/[0.04] text-gray-muted cursor-not-allowed' : 'bg-cyan text-dark hover:bg-white'}`}>
              {submitting ? L('Ap kreye kot...', 'Creating account...', 'Creation du compte...') : L('Aktive Kot Vande', 'Activate Vendor Account', 'Activer le compte vendeur')}
            </button>
            <p className="text-[10px] text-gray-muted text-center">{L('PIN ou se modpas ou pou antre nan dashboard ou.', 'Your PIN is your password to access your vendor dashboard.', 'Votre PIN est votre mot de passe pour votre tableau de bord.')}</p>
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

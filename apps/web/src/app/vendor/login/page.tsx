'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';

export default function VendorLoginPage() {
  const router = useRouter();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale as 'ht' | 'en' | 'fr'] ?? ht);

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) { setError(L('Nimewo telefòn pa valid', 'Invalid phone number', 'Numéro invalide')); return; }
    if (pin.length !== 4) { setError(L('PIN dwe gen 4 chif', 'PIN must be 4 digits', 'Le PIN doit avoir 4 chiffres')); return; }
    setLoading(true);
    try {
      const email = `${cleanPhone}@vendor.anbyans.events`;
      await signInWithEmailAndPassword(auth, email, pin);
      router.push('/vendor/dashboard');
    } catch {
      setError(L('Telefòn oswa PIN pa kòrèk', 'Wrong phone or PIN', 'Téléphone ou PIN incorrect'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <Link href="/" className="font-heading text-xl tracking-widest text-white">ANBYANS</Link>
        <LangSwitcher />
      </header>

      <div className="flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🏪</div>
            <h1 className="font-heading text-2xl tracking-wide text-white mb-1">
              {L('Espas Revandè', 'Reseller Portal', 'Espace Revendeur')}
            </h1>
            <p className="text-sm text-gray-muted">
              {L('Konekte ak nimewo telefòn ak PIN ou', 'Sign in with your phone and PIN', 'Connectez-vous avec votre téléphone et PIN')}
            </p>
          </div>

          <div className="bg-dark-card border border-border rounded-card p-6 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">
                {L('Nimewo Telefòn', 'Phone Number', 'Numéro de téléphone')}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+509 XXXX XXXX"
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted tracking-widest text-center text-lg"
              />
            </div>

            {error && <p className="text-red text-xs text-center">{error}</p>}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-orange text-white font-bold text-sm hover:bg-orange/90 transition-all disabled:opacity-50"
            >
              {loading ? L('Ap konekte...', 'Signing in...', 'Connexion...') : L('Konekte', 'Sign In', 'Se connecter')}
            </button>
          </div>

          <p className="text-center text-[11px] text-gray-muted mt-5">
            {L('Ou pa gen aksè?', "Don't have access?", "Pas encore accès ?")}{' '}
            <Link href="/" className="text-orange hover:underline">
              {L('Kontakte yon òganizatè', 'Contact an organizer', 'Contacter un organisateur')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

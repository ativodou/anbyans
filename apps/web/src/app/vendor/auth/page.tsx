'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';

type Screen = 'login' | 'invite' | 'register' | 'welcome';

export default function VendorAuthPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale]);
  const [screen, setScreen] = useState<Screen>('login');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteValid, setInviteValid] = useState(false);

  const checkInvite = () => {
    if (inviteCode.length >= 4) { setInviteValid(true); setScreen('register'); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-5">
          <Link href="/"><img src="/logo.jpg" alt="Anbyans" className="h-[50px] rounded-md mx-auto" /></Link>
          <p className="text-[11px] text-gray-light italic mt-1.5">{t('landing_tagline')}.</p>
          <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md text-[10px] font-bold border bg-purple-dim text-purple border-purple-border">🏪 {t('vend_auth_title')}</span>
          <div className="mt-2 flex justify-center"><LangSwitcher /></div>
        </div>

        {(screen === 'login' || screen === 'invite') && (
          <div className="flex rounded-xl overflow-hidden border border-purple-border mb-5">
            <button onClick={() => setScreen('login')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'login' ? 'bg-purple-dim text-purple shadow-[inset_0_-2px_0] shadow-purple' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>🔑 {t('vend_auth_login_tab')}</button>
            <button onClick={() => setScreen('invite')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'invite' ? 'bg-purple-dim text-purple shadow-[inset_0_-2px_0] shadow-purple' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>📨 {t('vend_auth_invite_tab')}</button>
          </div>
        )}

        <div className="bg-dark-card border border-purple-border rounded-2xl p-7">

          {screen === 'login' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">{t('login').toUpperCase()} — {L('VANDÈ','VENDOR','VENDEUR')}</h2>
            <p className="text-xs text-gray-light mb-5">{t('vend_auth_subtitle')}</p>
            <div className="space-y-3.5">
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_email_phone')}</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="email@example.com" /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('password')}</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="••••••••" /></div>
              <a href="#" className="block text-right text-[11px] text-purple hover:underline -mt-1">{t('auth_forgot')}</a>
            </div>
            <button onClick={() => setScreen('welcome')} className="w-full mt-4 py-3 rounded-[10px] bg-purple text-white font-bold text-sm hover:bg-purple/80 transition-all">{t('auth_login_btn')}</button>
            <p className="text-center text-xs text-gray-light mt-4">{L('Ou gen yon kòd envitasyon?','Have an invitation code?','Vous avez un code d\'invitation ?')} <button onClick={() => setScreen('invite')} className="text-purple font-semibold hover:underline">{L('Itilize li','Use it','Utilisez-le')}</button></p>
          </>}

          {screen === 'invite' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">{t('vend_auth_invite_code').toUpperCase()}</h2>
            <p className="text-xs text-gray-light mb-5">{L('Tape kòd envitasyon òganizatè a ba ou a, oswa klike sou lyen WhatsApp la.','Enter the invitation code from the organizer, or click the WhatsApp link.','Entrez le code d\'invitation de l\'organisateur, ou cliquez sur le lien WhatsApp.')}</p>
            <div className="space-y-3.5">
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('vend_auth_invite_code')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted font-mono tracking-widest text-center text-lg" placeholder={t('vend_auth_invite_placeholder')} value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} maxLength={9} /></div>
            </div>
            <button onClick={checkInvite} className="w-full mt-4 py-3 rounded-[10px] bg-purple text-white font-bold text-sm hover:bg-purple/80 transition-all">{t('vend_auth_verify')}</button>
            <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-border text-center">
              <p className="text-[10px] text-gray-muted">{L('Pa gen kòd? Mande òganizatè evènman an voye yon envitasyon ba ou sou WhatsApp.','No code? Ask the event organizer to send you a WhatsApp invitation.','Pas de code ? Demandez à l\'organisateur de vous envoyer une invitation WhatsApp.')}</p>
            </div>
          </>}

          {screen === 'register' && <>
            <div className="text-center mb-4">
              <span className="inline-block px-3 py-1 rounded-lg bg-green-dim text-green text-[10px] font-bold">✓ {L('Kòd Valid — Envitasyon Mega Events Haiti','Valid Code — Invitation from Mega Events Haiti','Code valide — Invitation de Mega Events Haiti')}</span>
            </div>
            <h2 className="font-heading text-2xl tracking-wide mb-1">{L('KREYE KONT VANDÈ','CREATE VENDOR ACCOUNT','CRÉER UN COMPTE VENDEUR')}</h2>
            <p className="text-xs text-gray-light mb-5">{L('Ranpli enfòmasyon ou pou kòmanse vann tikè.','Fill in your information to start selling tickets.','Remplissez vos informations pour commencer à vendre des billets.')}</p>
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_first_name')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="Ex: Jean" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_last_name')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="Ex: Pierre" /></div>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('vend_auth_biz_name')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="Ex: Ti Jak Boutik" /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Telefòn WhatsApp','WhatsApp Phone','Téléphone WhatsApp')} *</label>
                <div className="flex gap-2">
                  <select className="w-[100px] px-2 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple"><option>🇭🇹 +509</option><option>🇺🇸 +1</option></select>
                  <input type="tel" className="flex-1 px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="3412 0000" />
                </div>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('email')}</label><input type="email" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="email@example.com" /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('city')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="Ex: Pétion-Ville" /></div>
              <div className="border-t border-border pt-3.5"><p className="text-[10px] uppercase tracking-widest text-purple font-bold mb-3">{t('org_auth_payment_section')}</p></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('vend_auth_payment_method')} *</label>
                <select className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple"><option className="bg-dark-card">📱 MonCash</option><option className="bg-dark-card">💚 Natcash</option><option className="bg-dark-card">🏦 {L('Kont Bank','Bank Account','Compte bancaire')}</option><option className="bg-dark-card">💳 Stripe</option><option className="bg-dark-card">⚡ Zelle</option><option className="bg-dark-card">🅿️ PayPal</option><option className="bg-dark-card">💲 Cash App</option></select>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('vend_auth_payment_account')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder={L('Nimewo kont, imèl, oswa $cashtag','Account number, email, or $cashtag','Numéro de compte, email ou $cashtag')!} /></div>
              <div className="border-t border-border pt-3.5"><p className="text-[10px] uppercase tracking-widest text-purple font-bold mb-3">{t('password')}</p></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('password')} *</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder={L('Omwen 8 karaktè...','At least 8 characters...','Au moins 8 caractères...')!} /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_confirm_password')} *</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder={L('Tape modpas la ankò','Re-enter password','Retapez le mot de passe')!} /></div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="accent-purple w-4 h-4 mt-0.5" />
                <span className="text-[11px] text-gray-light">{t('auth_terms')}</span>
              </label>
            </div>
            <button onClick={() => setScreen('welcome')} className="w-full mt-5 py-3 rounded-[10px] bg-purple text-white font-bold text-sm hover:bg-purple/80 transition-all">{t('vend_auth_create_btn')}</button>
          </>}

          {screen === 'welcome' && (
            <div className="text-center py-4">
              <div className="text-6xl mb-3">🏪</div>
              <h2 className="font-heading text-3xl tracking-wide mb-1">{L('BYENVENI, VANDÈ!','WELCOME, VENDOR!','BIENVENUE, VENDEUR !')}</h2>
              <p className="text-xs text-gray-light mb-6">{L('Kont ou pare. Ou ka kòmanse vann tikè kounye a.','Your account is ready. You can start selling tickets now.','Votre compte est prêt. Vous pouvez commencer à vendre des billets.')}</p>
              <div className="flex flex-col gap-2.5">
                <Link href="/vendor/dashboard" className="w-full py-3 rounded-lg bg-purple text-white font-bold text-sm hover:bg-purple/80 transition-all text-center">🎫 {L('Ale nan Pòtay Vant','Go to Sales Portal','Aller au portail de vente')}</Link>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-5 p-3.5 rounded-xl border border-border bg-white/[0.01]">
          <p className="text-[11px] text-gray-muted">{t('vend_auth_org_link')}</p>
          <Link href="/organizer/auth" className="text-orange font-semibold text-xs hover:underline">{t('landing_org_cta')}</Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';

function getStrength(pwd: string) {
  if (!pwd) return { score: 0, label: '', color: 'text-gray-muted' };
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^a-zA-Z0-9]/.test(pwd)) s++;
  return [
    { score:0, label:'', color:'text-gray-muted' },
    { score:1, label:'Weak', color:'text-red' },
    { score:2, label:'Weak', color:'text-red' },
    { score:3, label:'Medium', color:'text-orange' },
    { score:4, label:'Strong 💪', color:'text-green' },
  ][s];
}

const BAR_C = ['bg-white/[0.06]','bg-red','bg-red','bg-orange','bg-green'];

function SocialBtns() {
  return (
    <div className="flex gap-2">
      {['Google','🍎 Apple','Facebook'].map(l => (
        <button key={l} className="flex-1 py-2.5 rounded-[10px] border border-border bg-white/[0.02] text-white text-xs font-semibold hover:border-white/[0.15] hover:bg-dark-hover transition-all">{l}</button>
      ))}
    </div>
  );
}

type Screen = 'login' | 'register' | 'otp' | 'welcome';

export default function FanAuthPage() {
  const { t, locale } = useT();
  const [screen, setScreen] = useState<Screen>('login');
  const [pwd, setPwd] = useState('');
  const [otp, setOtp] = useState(['','','','','','']);
  const str = getStrength(pwd);

  const otpChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) document.getElementById(`otp-${i+1}`)?.focus();
    if (next.every(x => x)) setScreen('welcome');
  };

  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-5">
          <Link href="/"><img src="/logo.jpg" alt="Anbyans" className="h-[50px] rounded-md mx-auto" /></Link>
          <p className="text-[11px] text-gray-light italic mt-1.5">{t('landing_tagline')}.</p>
          <div className="mt-2 flex justify-center"><LangSwitcher /></div>
        </div>

        {(screen === 'login' || screen === 'register') && (
          <div className="flex rounded-xl overflow-hidden border border-border mb-5">
            <button onClick={() => setScreen('login')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'login' ? 'bg-cyan-dim text-cyan shadow-[inset_0_-2px_0] shadow-cyan' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>🔑 {t('auth_login_tab')}</button>
            <button onClick={() => setScreen('register')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'register' ? 'bg-cyan-dim text-cyan shadow-[inset_0_-2px_0] shadow-cyan' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>✨ {t('auth_signup_tab')}</button>
          </div>
        )}

        <div className="bg-dark-card border border-border rounded-2xl p-7">

          {screen === 'login' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">{t('auth_login_tab').toUpperCase()}</h2>
            <p className="text-xs text-gray-light mb-5">{L('Antre nan kont ou pou wè tikè ou yo.', 'Sign in to your account to view your tickets.', 'Connectez-vous à votre compte pour voir vos billets.')}</p>
            <SocialBtns />
            <div className="flex items-center gap-3 my-4"><div className="flex-1 h-px bg-border" /><span className="text-[11px] text-gray-muted">{t('auth_or')}</span><div className="flex-1 h-px bg-border" /></div>
            <div className="space-y-3.5">
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_email_phone')}</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="email@example.com" /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_password')}</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="••••••••" /></div>
              <a href="#" className="block text-right text-[11px] text-cyan hover:underline -mt-1">{t('auth_forgot')}</a>
            </div>
            <button onClick={() => setScreen('welcome')} className="w-full mt-4 py-3 rounded-[10px] bg-cyan text-dark font-bold text-sm hover:bg-white transition-all">{t('auth_login_btn')}</button>
            <p className="text-center text-xs text-gray-light mt-4">{L('Pa gen kont?', 'No account?', 'Pas de compte ?')} <button onClick={() => setScreen('register')} className="text-cyan font-semibold hover:underline">{L('Kreye youn gratis', 'Create one free', 'Créez-en un gratuitement')}</button></p>
          </>}

          {screen === 'register' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">{t('auth_signup_tab').toUpperCase()}</h2>
            <p className="text-xs text-gray-light mb-5">{L('Enskri pou achte tikè, chwazi plas ou, ak plis ankò.', 'Sign up to buy tickets, choose your seats, and more.', 'Inscrivez-vous pour acheter des billets, choisir vos places, et plus encore.')}</p>
            <SocialBtns />
            <div className="flex items-center gap-3 my-4"><div className="flex-1 h-px bg-border" /><span className="text-[11px] text-gray-muted">{L('oswa ranpli fòm nan', 'or fill the form', 'ou remplissez le formulaire')}</span><div className="flex-1 h-px bg-border" /></div>
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_first_name')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="Ex: Marie" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_last_name')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="Ex: Pierre" /></div>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('email')} *</label><input type="email" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="email@example.com" /></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('phone')} *</label>
                <div className="flex gap-2">
                  <select className="w-[100px] px-2 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan"><option>🇭🇹 +509</option><option>🇺🇸 +1</option><option>🇨🇦 +1</option><option>🇩🇴 +1</option><option>🇫🇷 +33</option></select>
                  <input type="tel" className="flex-1 px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="3412 0000" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_password')} *</label>
                <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder={L('Omwen 8 karaktè...', 'At least 8 characters...', 'Au moins 8 caractères...')!} />
                <div className="flex gap-1 mt-1.5">{[1,2,3,4].map(i => <div key={i} className={`flex-1 h-[3px] rounded-full ${i <= str.score ? BAR_C[str.score] : 'bg-white/[0.06]'}`} />)}</div>
                <p className={`text-[10px] mt-1 ${str.color}`}>{str.label}</p>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_confirm_password')} *</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder={L('Tape modpas la ankò', 'Re-enter password', 'Retapez le mot de passe')!} /></div>
              <div className="grid grid-cols-3 gap-2.5">
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('city')}</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="Pòtoprens" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Eta / Depatman', 'State / Dept', 'État / Dépt')}</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder={L('Lwès', 'Ouest', 'Ouest')!} /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Peyi', 'Country', 'Pays')}</label><select className="w-full px-2 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan"><option>🇭🇹 Ayiti</option><option>🇺🇸 USA</option><option>🇨🇦 Canada</option><option>🇩🇴 RD</option><option>🇫🇷 France</option></select></div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Notifikasyon', 'Notifications', 'Notifications')}</label>
                <div className="flex gap-4">{['WhatsApp','SMS',t('email')].map(n => <label key={n} className="flex items-center gap-1.5 text-[11px] text-gray-light cursor-pointer"><input type="checkbox" defaultChecked className="accent-cyan w-4 h-4" />{n}</label>)}</div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="accent-cyan w-4 h-4 mt-0.5" />
                <span className="text-[11px] text-gray-light">{t('auth_terms')}</span>
              </label>
            </div>
            <button onClick={() => setScreen('otp')} className="w-full mt-5 py-3 rounded-[10px] bg-cyan text-dark font-bold text-sm hover:bg-white transition-all">{t('auth_signup_btn')}</button>
            <p className="text-center text-xs text-gray-light mt-4">{L('Deja gen kont?', 'Already have an account?', 'Vous avez déjà un compte ?')} <button onClick={() => setScreen('login')} className="text-cyan font-semibold hover:underline">{t('auth_login_tab')}</button></p>
          </>}

          {screen === 'otp' && (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">📱</div>
              <h3 className="text-lg font-bold mb-1.5">{L('Verifye Nimewo Ou', 'Verify Your Number', 'Vérifiez votre numéro')}</h3>
              <p className="text-xs text-gray-light mb-5">{L('Nou voye yon kòd 6 chif sou', 'We sent a 6-digit code to', 'Nous avons envoyé un code à 6 chiffres au')} <strong className="text-white">+509 3412 ****</strong></p>
              <div className="flex gap-2 justify-center">
                {otp.map((v, i) => <input key={i} id={`otp-${i}`} type="text" maxLength={1} value={v} onChange={e => otpChange(i, e.target.value)} className="w-[46px] h-[52px] rounded-[10px] bg-white/[0.04] border border-border text-white font-heading text-2xl text-center outline-none focus:border-cyan" />)}
              </div>
              <button onClick={() => setScreen('welcome')} className="w-full mt-5 py-3 rounded-[10px] bg-cyan text-dark font-bold text-sm hover:bg-white transition-all">{L('Verifye →', 'Verify →', 'Vérifier →')}</button>
              <p className="text-[11px] text-gray-muted mt-3">{L("Pa resevwa kòd la?", "Didn't receive the code?", "Vous n'avez pas reçu le code ?")} <button className="text-cyan hover:underline">{L('Voye ankò', 'Resend', 'Renvoyer')}</button></p>
            </div>
          )}

          {screen === 'welcome' && (
            <div className="text-center py-4">
              <div className="text-6xl mb-3">🎉</div>
              <h2 className="font-heading text-3xl tracking-wide mb-1">{L('BYENVENI SOU ANBYANS!', 'WELCOME TO ANBYANS!', 'BIENVENUE SUR ANBYANS !')}</h2>
              <p className="text-xs text-gray-light mb-6">{L('Kont ou pare. Kòmanse chèche evènman epi achte tikè.', 'Your account is ready. Start browsing events and buying tickets.', 'Votre compte est prêt. Commencez à parcourir les événements et à acheter des billets.')}</p>
              <div className="flex gap-2.5 justify-center">
                <Link href="/events" className="px-6 py-3 rounded-lg bg-cyan text-dark font-bold text-sm hover:bg-white transition-all">🎫 {t('landing_browse')}</Link>
                <Link href="#" className="px-6 py-3 rounded-lg border border-border text-gray-light font-bold text-sm hover:text-white transition-all">👤 {t('profile')}</Link>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-5 p-3.5 rounded-xl border border-border bg-white/[0.01]">
          <p className="text-[11px] text-gray-muted">{t('auth_organizer_link')}</p>
          <Link href="/organizer/auth" className="text-orange font-semibold text-xs hover:underline">{t('landing_org_cta')}</Link>
        </div>
      </div>
    </div>
  );
}

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
type Screen = 'login' | 'register' | 'otp' | 'welcome';

export default function OrganizerAuthPage() {
  const { t, locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale]);
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

  const bizTypes = locale === 'en'
    ? ['Event Promoter','Nightclub','Concert Hall / Theater','Church / Organization','Sports / Team','Other']
    : locale === 'fr'
    ? ['Promoteur d\'événements','Boîte de nuit','Salle de concert / Théâtre','Église / Organisation','Sports / Équipe','Autre']
    : ['Promotè Evènman','Bwat de Nwi / Klèb','Sal Konsè / Teyat','Legliz / Òganizasyon','Espò / Ekip','Lòt'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-5">
          <Link href="/"><img src="/logo.jpg" alt="Anbyans" className="h-[50px] rounded-md mx-auto" /></Link>
          <p className="text-[11px] text-gray-light italic mt-1.5">{t('landing_tagline')}.</p>
          <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md text-[10px] font-bold border bg-orange-dim text-orange border-orange-border">🎤 {t('org_auth_title')}</span>
          <div className="mt-2 flex justify-center"><LangSwitcher /></div>
        </div>

        {(screen === 'login' || screen === 'register') && (
          <div className="flex rounded-xl overflow-hidden border border-orange-border mb-5">
            <button onClick={() => setScreen('login')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'login' ? 'bg-orange-dim text-orange shadow-[inset_0_-2px_0] shadow-orange' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>🔑 {t('org_auth_login_tab')}</button>
            <button onClick={() => setScreen('register')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'register' ? 'bg-orange-dim text-orange shadow-[inset_0_-2px_0] shadow-orange' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>✨ {t('org_auth_signup_tab')}</button>
          </div>
        )}

        <div className="bg-dark-card border border-orange-border rounded-2xl p-7">

          {screen === 'login' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">{t('org_auth_login_tab').toUpperCase()} — {L('ÒGANIZATÈ','ORGANIZER','ORGANISATEUR')}</h2>
            <p className="text-xs text-gray-light mb-5">{t('org_auth_subtitle')}</p>
            <div className="space-y-3.5">
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('email')}</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="email@example.com" /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('password')}</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="••••••••" /></div>
              <a href="#" className="block text-right text-[11px] text-orange hover:underline -mt-1">{t('auth_forgot')}</a>
            </div>
            <button onClick={() => setScreen('welcome')} className="w-full mt-4 py-3 rounded-[10px] bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">{t('auth_login_btn')}</button>
            <p className="text-center text-xs text-gray-light mt-4">{L('Pa gen kont?','No account?','Pas de compte ?')} <button onClick={() => setScreen('register')} className="text-orange font-semibold hover:underline">{L('Kreye youn gratis','Create one free','Créez-en un gratuitement')}</button></p>
          </>}

          {screen === 'register' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">{L('KREYE KONT ÒGANIZATÈ','CREATE ORGANIZER ACCOUNT','CRÉER UN COMPTE ORGANISATEUR')}</h2>
            <p className="text-xs text-gray-light mb-5">{t('org_auth_subtitle')}</p>
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_first_name')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Ex: Jean" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_last_name')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Ex: Baptiste" /></div>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('email')} *</label><input type="email" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="email@example.com" /></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('phone')} *</label>
                <div className="flex gap-2">
                  <select className="w-[100px] px-2 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange"><option>🇭🇹 +509</option><option>🇺🇸 +1</option><option>🇨🇦 +1</option><option>🇩🇴 +1</option><option>🇫🇷 +33</option></select>
                  <input type="tel" className="flex-1 px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="3412 0000" />
                </div>
              </div>
              <div className="border-t border-border pt-3.5"><p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">{L('Enfòmasyon Biznis','Business Info','Infos entreprise')}</p></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('org_auth_biz_name')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Ex: Mega Events Haiti" /></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('org_auth_biz_type')} *</label>
                <select className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%278%27%20height%3D%275%27%20viewBox%3D%270%200%2010%206%27%20fill%3D%27none%27%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%3E%3Cpath%20d%3D%27M1%201l4%204%204-4%27%20stroke%3D%27%239999AD%27%20stroke-width%3D%271.5%27%20stroke-linecap%3D%27round%27/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_12px_center] pr-8">
                  <option value="" className="bg-dark-card">{L('Chwazi...','Choose...','Choisir...')}</option>
                  {bizTypes.map(b => <option key={b} className="bg-dark-card">{b}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('city')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Pòtoprens" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Eta/Dept','State','Dépt')}</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder={L('Lwès','Ouest','Ouest')!} /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Peyi','Country','Pays')} *</label><select className="w-full px-2 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange"><option>🇭🇹 Ayiti</option><option>🇺🇸 USA</option><option>🇨🇦 Canada</option></select></div>
              </div>
              <div className="border-t border-border pt-3.5"><p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">{t('org_auth_payment_section')}</p></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('org_auth_primary_payment')} *</label>
                <select className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%278%27%20height%3D%275%27%20viewBox%3D%270%200%2010%206%27%20fill%3D%27none%27%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%3E%3Cpath%20d%3D%27M1%201l4%204%204-4%27%20stroke%3D%27%239999AD%27%20stroke-width%3D%271.5%27%20stroke-linecap%3D%27round%27/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_12px_center] pr-8">
                  <option value="" className="bg-dark-card">{L('Chwazi...','Choose...','Choisir...')}</option>
                  <option className="bg-dark-card">📱 MonCash</option>
                  <option className="bg-dark-card">💚 Natcash</option>
                  <option className="bg-dark-card">🏦 {L('Kont Bank','Bank Account','Compte bancaire')}</option>
                  <option className="bg-dark-card">💳 Stripe</option>
                  <option className="bg-dark-card">⚡ Zelle</option>
                  <option className="bg-dark-card">🅿️ PayPal</option>
                  <option className="bg-dark-card">💲 Cash App</option>
                </select>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('org_auth_payment_account')} *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder={L('Nimewo kont, imèl, oswa $cashtag','Account number, email, or $cashtag','Numéro de compte, email ou $cashtag')!} /></div>
              <div className="border-t border-border pt-3.5"><p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">{t('password')}</p></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('password')} *</label>
                <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder={L('Omwen 8 karaktè...','At least 8 characters...','Au moins 8 caractères...')!} />
                <div className="flex gap-1 mt-1.5">{[1,2,3,4].map(i => <div key={i} className={`flex-1 h-[3px] rounded-full ${i <= str.score ? BAR_C[str.score] : 'bg-white/[0.06]'}`} />)}</div>
                <p className={`text-[10px] mt-1 ${str.color}`}>{str.label}</p>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('auth_confirm_password')} *</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder={L('Tape modpas la ankò','Re-enter password','Retapez le mot de passe')!} /></div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="accent-orange w-4 h-4 mt-0.5" />
                <span className="text-[11px] text-gray-light">{t('auth_terms')}</span>
              </label>
            </div>
            <button onClick={() => setScreen('otp')} className="w-full mt-5 py-3 rounded-[10px] bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">{t('org_auth_create_btn')}</button>
            <p className="text-center text-xs text-gray-light mt-4">{L('Deja gen kont?','Already have an account?','Vous avez déjà un compte ?')} <button onClick={() => setScreen('login')} className="text-orange font-semibold hover:underline">{t('login')}</button></p>
          </>}

          {screen === 'otp' && (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">📱</div>
              <h3 className="text-lg font-bold mb-1.5">{L('Verifye Nimewo Ou','Verify Your Number','Vérifiez votre numéro')}</h3>
              <p className="text-xs text-gray-light mb-5">{L('Nou voye yon kòd 6 chif sou','We sent a 6-digit code to','Nous avons envoyé un code à 6 chiffres au')} <strong className="text-white">+509 3412 ****</strong></p>
              <div className="flex gap-2 justify-center">
                {otp.map((v, i) => <input key={i} id={`otp-${i}`} type="text" maxLength={1} value={v} onChange={e => otpChange(i, e.target.value)} className="w-[46px] h-[52px] rounded-[10px] bg-white/[0.04] border border-border text-white font-heading text-2xl text-center outline-none focus:border-orange" />)}
              </div>
              <button onClick={() => setScreen('welcome')} className="w-full mt-5 py-3 rounded-[10px] bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">{L('Verifye →','Verify →','Vérifier →')}</button>
              <p className="text-[11px] text-gray-muted mt-3">{L("Pa resevwa kòd la?","Didn't receive the code?","Vous n'avez pas reçu le code ?")} <button className="text-orange hover:underline">{L('Voye ankò','Resend','Renvoyer')}</button></p>
            </div>
          )}

          {screen === 'welcome' && (
            <div className="text-center py-4">
              <div className="text-6xl mb-3">🎉</div>
              <h2 className="font-heading text-3xl tracking-wide mb-1">{L('BYENVENI, PROMOTÈ!','WELCOME, PROMOTER!','BIENVENUE, PROMOTEUR !')}</h2>
              <p className="text-xs text-gray-light mb-6">{L('Kont ou pare. Kòmanse kreye evènman ak envite vandè.','Your account is ready. Start creating events and inviting vendors.','Votre compte est prêt. Commencez à créer des événements et inviter des vendeurs.')}</p>
              <div className="flex flex-col gap-2.5">
                <Link href="/organizer/dashboard" className="w-full py-3 rounded-lg bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all text-center">📊 {L('Ale nan Dachbòd','Go to Dashboard','Aller au tableau de bord')}</Link>
                <Link href="/organizer/events/create" className="w-full py-3 rounded-lg border border-orange-border text-orange font-bold text-sm hover:bg-orange-dim transition-all text-center">📅 {L('Kreye Premye Evènman','Create First Event','Créer le premier événement')}</Link>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-5 p-3.5 rounded-xl border border-border bg-white/[0.01]">
          <p className="text-[11px] text-gray-muted">{t('org_auth_fan_link')}</p>
          <Link href="/auth" className="text-cyan font-semibold text-xs hover:underline">{t('landing_fan_cta')}</Link>
        </div>
      </div>
    </div>
  );
}

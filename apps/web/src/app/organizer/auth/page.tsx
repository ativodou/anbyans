'use client';

import Link from 'next/link';
import { useState } from 'react';

function getStrength(pwd: string) {
  if (!pwd) return { score: 0, label: '', color: 'text-gray-muted' };
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^a-zA-Z0-9]/.test(pwd)) s++;
  return [
    { score:0, label:'', color:'text-gray-muted' },
    { score:1, label:'Fèb', color:'text-red' },
    { score:2, label:'Fèb', color:'text-red' },
    { score:3, label:'Mwayen', color:'text-orange' },
    { score:4, label:'Fò 💪', color:'text-green' },
  ][s];
}

const BAR_C = ['bg-white/[0.06]','bg-red','bg-red','bg-orange','bg-green'];
type Screen = 'login' | 'register' | 'otp' | 'welcome';

export default function OrganizerAuthPage() {
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-5">
          <Link href="/"><img src="/logo.jpg" alt="Anbyans" className="h-[50px] rounded-md mx-auto" /></Link>
          <p className="text-[11px] text-gray-light italic mt-1.5">Evènman pou nou, pa nou.</p>
          <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md text-[10px] font-bold border bg-orange-dim text-orange border-orange-border">🎤 Pòtay Òganizatè / Promotè</span>
        </div>

        {(screen === 'login' || screen === 'register') && (
          <div className="flex rounded-xl overflow-hidden border border-orange-border mb-5">
            <button onClick={() => setScreen('login')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'login' ? 'bg-orange-dim text-orange shadow-[inset_0_-2px_0] shadow-orange' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>🔑 Konekte</button>
            <button onClick={() => setScreen('register')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'register' ? 'bg-orange-dim text-orange shadow-[inset_0_-2px_0] shadow-orange' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>✨ Kreye Kont</button>
          </div>
        )}

        <div className="bg-dark-card border border-orange-border rounded-2xl p-7">

          {screen === 'login' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">KONEKTE — ÒGANIZATÈ</h2>
            <p className="text-xs text-gray-light mb-5">Jere evènman ou yo, swiv vant, kontwole vandè.</p>
            <div className="space-y-3.5">
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Imèl</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="email@example.com" /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Modpas</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="••••••••" /></div>
              <a href="#" className="block text-right text-[11px] text-orange hover:underline -mt-1">Bliye modpas ou?</a>
            </div>
            <button onClick={() => setScreen('welcome')} className="w-full mt-4 py-3 rounded-[10px] bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">Konekte →</button>
            <p className="text-center text-xs text-gray-light mt-4">Pa gen kont? <button onClick={() => setScreen('register')} className="text-orange font-semibold hover:underline">Kreye youn gratis</button></p>
          </>}

          {screen === 'register' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">KREYE KONT ÒGANIZATÈ</h2>
            <p className="text-xs text-gray-light mb-5">Enskri pou kreye evènman, vann tikè, ak jere vandè.</p>
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Prenon *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Ex: Jean" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Non *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Ex: Baptiste" /></div>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Imèl *</label><input type="email" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="email@example.com" /></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Telefòn *</label>
                <div className="flex gap-2">
                  <select className="w-[100px] px-2 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange"><option>🇭🇹 +509</option><option>🇺🇸 +1</option><option>🇨🇦 +1</option><option>🇩🇴 +1</option><option>🇫🇷 +33</option></select>
                  <input type="tel" className="flex-1 px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="3412 0000" />
                </div>
              </div>
              <div className="border-t border-border pt-3.5"><p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">Enfòmasyon Biznis</p></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Non Biznis / Non Promotè *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Ex: Mega Events Haiti" /></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Tip Biznis *</label>
                <select className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%278%27%20height%3D%275%27%20viewBox%3D%270%200%2010%206%27%20fill%3D%27none%27%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%3E%3Cpath%20d%3D%27M1%201l4%204%204-4%27%20stroke%3D%27%239999AD%27%20stroke-width%3D%271.5%27%20stroke-linecap%3D%27round%27/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_12px_center] pr-8">
                  <option value="" className="bg-dark-card">Chwazi...</option>
                  <option className="bg-dark-card">Promotè Evènman</option>
                  <option className="bg-dark-card">Bwat de Nwi / Klèb</option>
                  <option className="bg-dark-card">Sal Konsè / Teyat</option>
                  <option className="bg-dark-card">Legliz / Òganizasyon</option>
                  <option className="bg-dark-card">Espò / Ekip</option>
                  <option className="bg-dark-card">Lòt</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Vil *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Pòtoprens" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Eta / Dept.</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Lwès" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Peyi *</label><select className="w-full px-2 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange"><option>🇭🇹 Ayiti</option><option>🇺🇸 Etazini</option><option>🇨🇦 Kanada</option></select></div>
              </div>
              <div className="border-t border-border pt-3.5"><p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">Kont Peman</p></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Metòd Peman Prensipal *</label>
                <select className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%278%27%20height%3D%275%27%20viewBox%3D%270%200%2010%206%27%20fill%3D%27none%27%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%3E%3Cpath%20d%3D%27M1%201l4%204%204-4%27%20stroke%3D%27%239999AD%27%20stroke-width%3D%271.5%27%20stroke-linecap%3D%27round%27/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_12px_center] pr-8">
                  <option value="" className="bg-dark-card">Chwazi...</option>
                  <option className="bg-dark-card">📱 MonCash</option>
                  <option className="bg-dark-card">💚 Natcash</option>
                  <option className="bg-dark-card">🏦 Kont Bank</option>
                  <option className="bg-dark-card">💳 Stripe</option>
                  <option className="bg-dark-card">⚡ Zelle</option>
                  <option className="bg-dark-card">🅿️ PayPal</option>
                  <option className="bg-dark-card">💲 Cash App</option>
                </select>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Nimewo Kont / Telefòn Peman *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Nimewo kont, imèl, oswa $cashtag" /></div>
              <div className="border-t border-border pt-3.5"><p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">Modpas</p></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Modpas *</label>
                <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Omwen 8 karaktè..." />
                <div className="flex gap-1 mt-1.5">{[1,2,3,4].map(i => <div key={i} className={`flex-1 h-[3px] rounded-full ${i <= str.score ? BAR_C[str.score] : 'bg-white/[0.06]'}`} />)}</div>
                <p className={`text-[10px] mt-1 ${str.color}`}>{str.label}</p>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Konfime Modpas *</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Tape modpas la ankò" /></div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="accent-orange w-4 h-4 mt-0.5" />
                <span className="text-[11px] text-gray-light">Mwen aksepte <a href="#" className="text-orange hover:underline">Kondisyon Itilizasyon</a>, <a href="#" className="text-orange hover:underline">Politik Konfidansyalite</a>, ak <a href="#" className="text-orange hover:underline">Kontra Òganizatè</a>.</span>
              </label>
            </div>
            <button onClick={() => setScreen('otp')} className="w-full mt-5 py-3 rounded-[10px] bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">Kreye Kont Mwen →</button>
            <p className="text-center text-xs text-gray-light mt-4">Deja gen kont? <button onClick={() => setScreen('login')} className="text-orange font-semibold hover:underline">Konekte</button></p>
          </>}

          {screen === 'otp' && (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">📱</div>
              <h3 className="text-lg font-bold mb-1.5">Verifye Nimewo Ou</h3>
              <p className="text-xs text-gray-light mb-5">Nou voye yon kòd 6 chif sou <strong className="text-white">+509 3412 ****</strong></p>
              <div className="flex gap-2 justify-center">
                {otp.map((v, i) => <input key={i} id={`otp-${i}`} type="text" maxLength={1} value={v} onChange={e => otpChange(i, e.target.value)} className="w-[46px] h-[52px] rounded-[10px] bg-white/[0.04] border border-border text-white font-heading text-2xl text-center outline-none focus:border-orange" />)}
              </div>
              <button onClick={() => setScreen('welcome')} className="w-full mt-5 py-3 rounded-[10px] bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">Verifye →</button>
              <p className="text-[11px] text-gray-muted mt-3">Pa resevwa kòd la? <button className="text-orange hover:underline">Voye ankò</button> · <button className="text-orange hover:underline">Eseye pa imèl</button></p>
            </div>
          )}

          {screen === 'welcome' && (
            <div className="text-center py-4">
              <div className="text-6xl mb-3">🎉</div>
              <h2 className="font-heading text-3xl tracking-wide mb-1">BYENVENI, PROMOTÈ!</h2>
              <p className="text-xs text-gray-light mb-6">Kont ou pare. Kòmanse kreye evènman ak envite vandè.</p>
              <div className="flex flex-col gap-2.5">
                <Link href="/organizer/dashboard" className="w-full py-3 rounded-lg bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all text-center">📊 Ale nan Dachbòd</Link>
                <Link href="/organizer/events/create" className="w-full py-3 rounded-lg border border-orange-border text-orange font-bold text-sm hover:bg-orange-dim transition-all text-center">📅 Kreye Premye Evènman</Link>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-5 p-3.5 rounded-xl border border-border bg-white/[0.01]">
          <p className="text-[11px] text-gray-muted">Ou vle achte tikè pito?</p>
          <Link href="/auth" className="text-cyan font-semibold text-xs hover:underline">Kreye yon kont fan →</Link>
        </div>
      </div>
    </div>
  );
}

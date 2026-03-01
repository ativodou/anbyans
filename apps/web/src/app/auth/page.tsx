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
        </div>

        {(screen === 'login' || screen === 'register') && (
          <div className="flex rounded-xl overflow-hidden border border-border mb-5">
            <button onClick={() => setScreen('login')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'login' ? 'bg-cyan-dim text-cyan shadow-[inset_0_-2px_0] shadow-cyan' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>🔑 Konekte</button>
            <button onClick={() => setScreen('register')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'register' ? 'bg-cyan-dim text-cyan shadow-[inset_0_-2px_0] shadow-cyan' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>✨ Kreye Kont</button>
          </div>
        )}

        <div className="bg-dark-card border border-border rounded-2xl p-7">

          {screen === 'login' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">KONEKTE</h2>
            <p className="text-xs text-gray-light mb-5">Antre nan kont ou pou wè tikè ou yo.</p>
            <SocialBtns />
            <div className="flex items-center gap-3 my-4"><div className="flex-1 h-px bg-border" /><span className="text-[11px] text-gray-muted">oswa</span><div className="flex-1 h-px bg-border" /></div>
            <div className="space-y-3.5">
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Imèl oswa Telefòn</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="email@example.com oswa +509..." /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Modpas</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="••••••••" /></div>
              <a href="#" className="block text-right text-[11px] text-cyan hover:underline -mt-1">Bliye modpas ou?</a>
            </div>
            <button onClick={() => setScreen('welcome')} className="w-full mt-4 py-3 rounded-[10px] bg-cyan text-dark font-bold text-sm hover:bg-white transition-all">Konekte →</button>
            <p className="text-center text-xs text-gray-light mt-4">Pa gen kont? <button onClick={() => setScreen('register')} className="text-cyan font-semibold hover:underline">Kreye youn gratis</button></p>
          </>}

          {screen === 'register' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">KREYE KONT</h2>
            <p className="text-xs text-gray-light mb-5">Enskri pou achte tikè, chwazi plas ou, ak plis ankò.</p>
            <SocialBtns />
            <div className="flex items-center gap-3 my-4"><div className="flex-1 h-px bg-border" /><span className="text-[11px] text-gray-muted">oswa ranpli fòm nan</span><div className="flex-1 h-px bg-border" /></div>
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Prenon *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="Ex: Marie" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Non *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="Ex: Pierre" /></div>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Imèl *</label><input type="email" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="email@example.com" /></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Telefòn *</label>
                <div className="flex gap-2">
                  <select className="w-[100px] px-2 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan"><option>🇭🇹 +509</option><option>🇺🇸 +1</option><option>🇨🇦 +1</option><option>🇩🇴 +1</option><option>🇫🇷 +33</option></select>
                  <input type="tel" className="flex-1 px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="3412 0000" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Modpas *</label>
                <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="Omwen 8 karaktè..." />
                <div className="flex gap-1 mt-1.5">{[1,2,3,4].map(i => <div key={i} className={`flex-1 h-[3px] rounded-full ${i <= str.score ? BAR_C[str.score] : 'bg-white/[0.06]'}`} />)}</div>
                <p className={`text-[10px] mt-1 ${str.color}`}>{str.label}</p>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Konfime Modpas *</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="Tape modpas la ankò" /></div>
              <div className="grid grid-cols-3 gap-2.5">
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Vil</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="Pòtoprens" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Eta / Depatman</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan placeholder:text-gray-muted" placeholder="Lwès" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Peyi</label><select className="w-full px-2 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-cyan"><option>🇭🇹 Ayiti</option><option>🇺🇸 Etazini</option><option>🇨🇦 Kanada</option><option>🇩🇴 Dominikani</option><option>🇫🇷 Frans</option></select></div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Notifikasyon</label>
                <div className="flex gap-4">{['WhatsApp','SMS','Imèl'].map(n => <label key={n} className="flex items-center gap-1.5 text-[11px] text-gray-light cursor-pointer"><input type="checkbox" defaultChecked className="accent-cyan w-4 h-4" />{n}</label>)}</div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="accent-cyan w-4 h-4 mt-0.5" />
                <span className="text-[11px] text-gray-light">Mwen aksepte <a href="#" className="text-cyan hover:underline">Kondisyon Itilizasyon</a> ak <a href="#" className="text-cyan hover:underline">Politik Konfidansyalite</a>.</span>
              </label>
            </div>
            <button onClick={() => setScreen('otp')} className="w-full mt-5 py-3 rounded-[10px] bg-cyan text-dark font-bold text-sm hover:bg-white transition-all">Kreye Kont Mwen →</button>
            <p className="text-center text-xs text-gray-light mt-4">Deja gen kont? <button onClick={() => setScreen('login')} className="text-cyan font-semibold hover:underline">Konekte</button></p>
          </>}

          {screen === 'otp' && (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">📱</div>
              <h3 className="text-lg font-bold mb-1.5">Verifye Nimewo Ou</h3>
              <p className="text-xs text-gray-light mb-5">Nou voye yon kòd 6 chif sou <strong className="text-white">+509 3412 ****</strong></p>
              <div className="flex gap-2 justify-center">
                {otp.map((v, i) => <input key={i} id={`otp-${i}`} type="text" maxLength={1} value={v} onChange={e => otpChange(i, e.target.value)} className="w-[46px] h-[52px] rounded-[10px] bg-white/[0.04] border border-border text-white font-heading text-2xl text-center outline-none focus:border-cyan" />)}
              </div>
              <button onClick={() => setScreen('welcome')} className="w-full mt-5 py-3 rounded-[10px] bg-cyan text-dark font-bold text-sm hover:bg-white transition-all">Verifye →</button>
              <p className="text-[11px] text-gray-muted mt-3">Pa resevwa kòd la? <button className="text-cyan hover:underline">Voye ankò</button> · <button className="text-cyan hover:underline">Eseye pa imèl</button></p>
            </div>
          )}

          {screen === 'welcome' && (
            <div className="text-center py-4">
              <div className="text-6xl mb-3">🎉</div>
              <h2 className="font-heading text-3xl tracking-wide mb-1">BYENVENI SOU ANBYANS!</h2>
              <p className="text-xs text-gray-light mb-6">Kont ou pare. Kòmanse chèche evènman epi achte tikè.</p>
              <div className="flex gap-2.5 justify-center">
                <Link href="/events" className="px-6 py-3 rounded-lg bg-cyan text-dark font-bold text-sm hover:bg-white transition-all">🎫 Jwenn Evènman</Link>
                <Link href="#" className="px-6 py-3 rounded-lg border border-border text-gray-light font-bold text-sm hover:text-white transition-all">👤 Pwofil Mwen</Link>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-5 p-3.5 rounded-xl border border-border bg-white/[0.01]">
          <p className="text-[11px] text-gray-muted">Ou se yon promotè oswa òganizatè evènman?</p>
          <Link href="/organizer/auth" className="text-orange font-semibold text-xs hover:underline">Kreye yon kont promotè →</Link>
        </div>
      </div>
    </div>
  );
}

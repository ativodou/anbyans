'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Screen = 'login' | 'invite' | 'register' | 'welcome';

export default function VendorAuthPage() {
  const router = useRouter();
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
          <p className="text-[11px] text-gray-light italic mt-1.5">Evènman pou nou, pa nou.</p>
          <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md text-[10px] font-bold border bg-purple-dim text-purple border-purple-border">🏪 Pòtay Vandè</span>
        </div>

        {(screen === 'login' || screen === 'invite') && (
          <div className="flex rounded-xl overflow-hidden border border-purple-border mb-5">
            <button onClick={() => setScreen('login')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'login' ? 'bg-purple-dim text-purple shadow-[inset_0_-2px_0] shadow-purple' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>🔑 Konekte</button>
            <button onClick={() => setScreen('invite')} className={`flex-1 py-3 text-[13px] font-bold transition-all ${screen === 'invite' ? 'bg-purple-dim text-purple shadow-[inset_0_-2px_0] shadow-purple' : 'bg-white/[0.02] text-gray-light hover:bg-dark-hover'}`}>📨 Envitasyon</button>
          </div>
        )}

        <div className="bg-dark-card border border-purple-border rounded-2xl p-7">

          {/* LOGIN */}
          {screen === 'login' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">KONEKTE — VANDÈ</h2>
            <p className="text-xs text-gray-light mb-5">Konekte nan kont vandè ou pou vann tikè ak swiv envantè.</p>
            <div className="space-y-3.5">
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Imèl oswa Telefòn</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="email@example.com oswa +509..." /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Modpas</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="••••••••" /></div>
              <a href="#" className="block text-right text-[11px] text-purple hover:underline -mt-1">Bliye modpas ou?</a>
            </div>
            <button onClick={() => setScreen('welcome')} className="w-full mt-4 py-3 rounded-[10px] bg-purple text-white font-bold text-sm hover:bg-purple/80 transition-all">Konekte →</button>
            <p className="text-center text-xs text-gray-light mt-4">Ou gen yon kòd envitasyon? <button onClick={() => setScreen('invite')} className="text-purple font-semibold hover:underline">Itilize li</button></p>
          </>}

          {/* INVITE CODE */}
          {screen === 'invite' && <>
            <h2 className="font-heading text-2xl tracking-wide mb-1">KÒD ENVITASYON</h2>
            <p className="text-xs text-gray-light mb-5">Tape kòd envitasyon òganizatè a ba ou a, oswa klike sou lyen WhatsApp la.</p>
            <div className="space-y-3.5">
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Kòd Envitasyon *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted font-mono tracking-widest text-center text-lg" placeholder="XXXX-XXXX" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} maxLength={9} /></div>
            </div>
            <button onClick={checkInvite} className="w-full mt-4 py-3 rounded-[10px] bg-purple text-white font-bold text-sm hover:bg-purple/80 transition-all">Verifye Kòd →</button>
            <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-border text-center">
              <p className="text-[10px] text-gray-muted">Pa gen kòd? Mande òganizatè evènman an voye yon envitasyon ba ou sou WhatsApp.</p>
            </div>
          </>}

          {/* REGISTER */}
          {screen === 'register' && <>
            <div className="text-center mb-4">
              <span className="inline-block px-3 py-1 rounded-lg bg-green-dim text-green text-[10px] font-bold">✓ Kòd Valid — Envitasyon Mega Events Haiti</span>
            </div>
            <h2 className="font-heading text-2xl tracking-wide mb-1">KREYE KONT VANDÈ</h2>
            <p className="text-xs text-gray-light mb-5">Ranpli enfòmasyon ou pou kòmanse vann tikè.</p>
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Prenon *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="Ex: Jean" /></div>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Non *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="Ex: Pierre" /></div>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Non Biznis / Boutik *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="Ex: Ti Jak Boutik" /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Telefòn WhatsApp *</label>
                <div className="flex gap-2">
                  <select className="w-[100px] px-2 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple"><option>🇭🇹 +509</option><option>🇺🇸 +1</option></select>
                  <input type="tel" className="flex-1 px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="3412 0000" />
                </div>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Imèl</label><input type="email" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="email@example.com" /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Vil *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="Ex: Pétion-Ville" /></div>
              <div className="border-t border-border pt-3.5"><p className="text-[10px] uppercase tracking-widest text-purple font-bold mb-3">Kont Peman</p></div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Metòd Peman *</label>
                <select className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple"><option className="bg-dark-card">📱 MonCash</option><option className="bg-dark-card">💚 Natcash</option><option className="bg-dark-card">🏦 Kont Bank</option><option className="bg-dark-card">💳 Stripe</option><option className="bg-dark-card">⚡ Zelle</option><option className="bg-dark-card">🅿️ PayPal</option><option className="bg-dark-card">💲 Cash App</option></select>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Nimewo Kont Peman *</label><input className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="Nimewo kont, imèl, oswa $cashtag" /></div>
              <div className="border-t border-border pt-3.5"><p className="text-[10px] uppercase tracking-widest text-purple font-bold mb-3">Modpas</p></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Modpas *</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="Omwen 8 karaktè..." /></div>
              <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Konfime Modpas *</label><input type="password" className="w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-purple placeholder:text-gray-muted" placeholder="Tape modpas la ankò" /></div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="accent-purple w-4 h-4 mt-0.5" />
                <span className="text-[11px] text-gray-light">Mwen aksepte <a href="#" className="text-purple hover:underline">Kondisyon Vandè</a> ak <a href="#" className="text-purple hover:underline">Politik Konfidansyalite</a>.</span>
              </label>
            </div>
            <button onClick={() => setScreen('welcome')} className="w-full mt-5 py-3 rounded-[10px] bg-purple text-white font-bold text-sm hover:bg-purple/80 transition-all">Kreye Kont Mwen →</button>
          </>}

          {/* WELCOME */}
          {screen === 'welcome' && (
            <div className="text-center py-4">
              <div className="text-6xl mb-3">🏪</div>
              <h2 className="font-heading text-3xl tracking-wide mb-1">BYENVENI, VANDÈ!</h2>
              <p className="text-xs text-gray-light mb-6">Kont ou pare. Ou ka kòmanse vann tikè kounye a.</p>
              <div className="flex flex-col gap-2.5">
                <Link href="/vendor/dashboard" className="w-full py-3 rounded-lg bg-purple text-white font-bold text-sm hover:bg-purple/80 transition-all text-center">🎫 Ale nan Pòtay Vant</Link>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-5 p-3.5 rounded-xl border border-border bg-white/[0.01]">
          <p className="text-[11px] text-gray-muted">Ou se yon òganizatè?</p>
          <Link href="/organizer/auth" className="text-orange font-semibold text-xs hover:underline">Ale nan pòtay òganizatè →</Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';

/* ══════════════════════════════════════════════════════════════════
   TYPES & DATA
   ══════════════════════════════════════════════════════════════════ */

interface Section {
  id: string;
  name: string;
  color: string;
  seats: number;
  description: string;
}

interface Tier {
  id: string;
  sectionId: string;
  name: string;
  color: string;
  emoji: string;
  price: number;
  qty: number;
}

interface PromoCode {
  code: string;
  discount: number;
}

type Chip = { group: string; label: string };

const RESTRICTIONS: { group: string; emoji: string; chips: string[] }[] = [
  { group:'Kòd Abiman', emoji:'👔', chips:['Casual','Semi-Formal','Formal','Tèm / Kostim','Tout Blan','Tout Nwa'] },
  { group:'Manje & Bwason', emoji:'🍽️', chips:['Pa gen manje deyò','Pa gen bwason deyò','BYOB','Manje enkli','Bwason enkli','Ba peyan'] },
  { group:'Kamera & Anrejistreman', emoji:'📵', chips:['Pa gen kamera','Pa gen anrejistreman','Pa gen telefòn','Foto pèmèt'] },
  { group:'Politik Sak', emoji:'👜', chips:['Pa gen sak','Ti sak sèlman','Sak transparan sèlman','Verifikasyon sak nan antre'] },
  { group:'Sekirite', emoji:'🔒', chips:['Pa gen zam','Pa gen kouto / objè tranchan','Fouy nan antre','Detektè metal','Pyès idantite obligatwa','Pa gen reantre'] },
  { group:'Aksesibilite', emoji:'♿', chips:['Aksè chèz woulant','Entèprèt lang siy','Pakin aksesib','Asansè disponib'] },
  { group:'Sante', emoji:'🏥', chips:['Vaksen obligatwa','Mask obligatwa','Tcheke tanperati','Medsen sou plas'] },
];

const DEFAULT_SECTIONS: Section[] = [
  { id:'vvip', name:'VVIP', color:'#FFD700', seats:50, description:'Pi pre sènn lan' },
  { id:'vip', name:'VIP', color:'#FF6B35', seats:150, description:'Dezyèm ranje, aksè bar VIP' },
  { id:'ga', name:'GA', color:'#00D4FF', seats:1000, description:'Aksè jeneral' },
];

const LAYOUTS = [
  { icon:'🎤', name:'Konsè', desc:'Seksyon kanpe + chèz' },
  { icon:'🎭', name:'Teyat', desc:'Ranje ak chèz fiks' },
  { icon:'🍽️', name:'Bankè', desc:'Tab wonn' },
  { icon:'🎪', name:'Jeneral', desc:'Pa gen chèz fikse' },
];

/* ══════════════════════════════════════════════════════════════════
   FORM INPUT COMPONENTS
   ══════════════════════════════════════════════════════════════════ */

const inputCls = "w-full px-3.5 py-3 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted";
const selectCls = inputCls + " appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%278%27%20height%3D%275%27%20viewBox%3D%270%200%2010%206%27%20fill%3D%27none%27%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%3E%3Cpath%20d%3D%27M1%201l4%204%204-4%27%20stroke%3D%27%239999AD%27%20stroke-width%3D%271.5%27%20stroke-linecap%3D%27round%27/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_12px_center] pr-8";
const labelCls = "block text-[11px] font-semibold text-gray-light mb-1.5";

/* ══════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════ */

export default function CreateEventPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);

  // Step 1
  const [evName, setEvName] = useState('');
  const [evCat, setEvCat] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evLang, setEvLang] = useState('Kreyòl');
  const [evAge, setEvAge] = useState('Tout laj');
  const [selectedChips, setSelectedChips] = useState<Chip[]>([]);
  const [customRestrict, setCustomRestrict] = useState('');

  // Step 2
  const [evDateStart, setEvDateStart] = useState('');
  const [evDateEnd, setEvDateEnd] = useState('');
  const [evTimeStart, setEvTimeStart] = useState('');
  const [evTimeEnd, setEvTimeEnd] = useState('');
  const [evVenue, setEvVenue] = useState('');
  const [evAddr, setEvAddr] = useState('');
  const [evCity, setEvCity] = useState('');
  const [evState, setEvState] = useState('');
  const [evCountry, setEvCountry] = useState('🇭🇹 Ayiti');
  const [evCap, setEvCap] = useState('');

  // Step 3
  const [seatMode, setSeatMode] = useState<'build'|'upload'>('build');
  const [layout, setLayout] = useState(0);
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS);

  // Step 4
  const [tiers, setTiers] = useState<Tier[]>([
    { id:'t1', sectionId:'vvip', name:'VVIP', color:'#FFD700', emoji:'🟡', price:150, qty:50 },
    { id:'t2', sectionId:'vip', name:'VIP', color:'#FF6B35', emoji:'🟠', price:75, qty:150 },
    { id:'t3', sectionId:'ga', name:'General Admission', color:'#00D4FF', emoji:'🔵', price:15, qty:1000 },
  ]);
  const [promos, setPromos] = useState<PromoCode[]>([{ code:'', discount:0 }]);

  // Step 5
  const [imagePreview, setImagePreview] = useState<string|null>(null);

  const STEPS = ['Enfòmasyon','Dat & Kote','Plan Sal','Tikè & Pri','Imaj','Revize'];

  const toggleChip = (group: string, label: string) => {
    setSelectedChips(prev => {
      const exists = prev.find(c => c.group === group && c.label === label);
      return exists ? prev.filter(c => !(c.group === group && c.label === label)) : [...prev, { group, label }];
    });
  };

  const addSection = () => {
    const id = `sec-${Date.now()}`;
    setSections(prev => [...prev, { id, name:'Nouvo Seksyon', color:'#9999AD', seats:100, description:'Deskripsyon...' }]);
    setTiers(prev => [...prev, { id:`t-${Date.now()}`, sectionId:id, name:'Nouvo Seksyon', color:'#9999AD', emoji:'⬜', price:0, qty:100 }]);
  };

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
    setTiers(prev => prev.filter(t => t.sectionId !== id));
  };

  const updateSection = (id: string, field: keyof Section, val: string|number) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
    if (field === 'name') setTiers(prev => prev.map(t => t.sectionId === id ? { ...t, name: val as string } : t));
    if (field === 'seats') setTiers(prev => prev.map(t => t.sectionId === id ? { ...t, qty: val as number } : t));
  };

  const updateTier = (id: string, field: keyof Tier, val: string|number) => {
    setTiers(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t));
  };

  const addTier = () => {
    setTiers(prev => [...prev, { id:`t-${Date.now()}`, sectionId:'', name:'Nouvo Nivo', color:'#9999AD', emoji:'⬜', price:0, qty:0 }]);
  };

  const removeTier = (id: string) => setTiers(prev => prev.filter(t => t.id !== id));

  const totalTix = tiers.reduce((a, t) => a + (t.qty || 0), 0);
  const totalRev = tiers.reduce((a, t) => a + (t.qty || 0) * (t.price || 0), 0);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const goTo = (s: number) => { setStep(s); window.scrollTo(0, 0); };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-dark">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-dark border-b border-border px-5">
        <div className="max-w-[720px] mx-auto flex items-center h-14 gap-3">
          <button onClick={() => router.back()} className="text-gray-light text-xs hover:text-white transition-colors">← Retou</button>
          <div className="w-px h-5 bg-border" />
          <span className="font-heading text-xl tracking-wide flex-1">KREYE EVÈNMAN</span>
        </div>
      </nav>

      <div className="max-w-[720px] mx-auto px-5 py-6">

        {/* ═══ STEPS BAR ═══ */}
        {!done && (
          <div className="flex items-center gap-0 mb-7 flex-wrap">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <button onClick={() => goTo(i+1)} className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all border ${
                  step === i+1 ? 'bg-orange text-white border-orange' : step > i+1 ? 'bg-green text-white border-green' : 'bg-white/[0.04] text-gray-muted border-border'
                }`}>
                  {step > i+1 ? '✓' : i+1}
                </button>
                <span className={`text-[10px] transition-colors ${step === i+1 ? 'text-white font-semibold' : step > i+1 ? 'text-green' : 'text-gray-muted'}`}>{s}</span>
                {i < STEPS.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>
        )}

        {/* ═══ STEP 1: ENFÒMASYON ═══ */}
        {step === 1 && !done && (
          <div>
            <h2 className="font-heading text-xl tracking-wide mb-1">ENFÒMASYON EVÈNMAN</h2>
            <p className="text-xs text-gray-light mb-5">Bay detay debaz sou evènman ou an.</p>

            <div className="space-y-4">
              <div><label className={labelCls}>Non Evènman *</label><input className={inputCls} placeholder="Ex: Kompa Fest 2026" value={evName} onChange={e => setEvName(e.target.value)} /></div>
              <div>
                <label className={labelCls}>Kategori *</label>
                <select className={selectCls} value={evCat} onChange={e => setEvCat(e.target.value)}>
                  <option value="" className="bg-dark-card">Chwazi kategori...</option>
                  {['Mizik / Konsè','Fèt / Party','Teyat / Comedy','Espò','Konferans / Seminè','Festival','Relijye','Gala / Benefis','Lòt'].map(c => <option key={c} className="bg-dark-card">{c}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Deskripsyon</label><textarea className={inputCls + " min-h-[80px] resize-y"} placeholder="Dekri evènman ou an..." value={evDesc} onChange={e => setEvDesc(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Lang Prensipal</label><select className={selectCls} value={evLang} onChange={e => setEvLang(e.target.value)}>{['Kreyòl','Anglè','Fransè','Panyòl'].map(l => <option key={l} className="bg-dark-card">{l}</option>)}</select></div>
                <div><label className={labelCls}>Laj Minimòm</label><select className={selectCls} value={evAge} onChange={e => setEvAge(e.target.value)}>{['Tout laj','12+','16+','18+','21+'].map(a => <option key={a} className="bg-dark-card">{a}</option>)}</select></div>
              </div>

              {/* Restrictions */}
              <div className="bg-white/[0.02] border border-border rounded-xl p-4">
                <p className="text-xs font-bold mb-3">Restriksyon & Règ Evènman</p>
                {RESTRICTIONS.map(r => (
                  <div key={r.group} className="mb-3.5 last:mb-0">
                    <p className="text-[11px] font-bold text-gray-light mb-2">{r.emoji} {r.group}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.chips.map(c => {
                        const active = selectedChips.some(sc => sc.group === r.group && sc.label === c);
                        return (
                          <button key={c} onClick={() => toggleChip(r.group, c)}
                            className={`px-3 py-1.5 rounded-full text-[11px] border transition-all ${active ? 'bg-orange-dim border-orange-border text-orange font-semibold' : 'bg-white/[0.04] border-border text-gray-light hover:border-white/[0.15]'}`}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="mt-3"><p className="text-[11px] font-bold text-gray-light mb-2">📝 Lòt Restriksyon</p><textarea className={inputCls + " min-h-[50px] resize-y"} placeholder="Ajoute nenpòt lòt règ..." value={customRestrict} onChange={e => setCustomRestrict(e.target.value)} /></div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => goTo(2)} className="flex-1 py-3 rounded-[10px] bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">Kontinye →</button>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: DAT & KOTE ═══ */}
        {step === 2 && !done && (
          <div>
            <h2 className="font-heading text-xl tracking-wide mb-1">DAT & KOTE</h2>
            <p className="text-xs text-gray-light mb-5">Ki lè ak ki kote evènman an ap fèt?</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Dat Kòmanse *</label><input type="date" className={inputCls} value={evDateStart} onChange={e => setEvDateStart(e.target.value)} /></div>
                <div><label className={labelCls}>Dat Fini (opsyonèl)</label><input type="date" className={inputCls} value={evDateEnd} onChange={e => setEvDateEnd(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Lè Kòmanse *</label><input type="time" className={inputCls} value={evTimeStart} onChange={e => setEvTimeStart(e.target.value)} /></div>
                <div><label className={labelCls}>Lè Fini</label><input type="time" className={inputCls} value={evTimeEnd} onChange={e => setEvTimeEnd(e.target.value)} /></div>
              </div>
              <div>
                <label className={labelCls}>Non Sal / Kote *</label>
                <div className="flex gap-2">
                  <input className={inputCls + " flex-1"} placeholder="Ex: Karibe Hotel" value={evVenue} onChange={e => setEvVenue(e.target.value)} />
                  <button className="px-4 py-3 rounded-[10px] border border-orange-border bg-orange-dim text-orange text-xs font-bold whitespace-nowrap hover:bg-orange hover:text-white transition-all">📍 GPS</button>
                </div>
              </div>
              <div><label className={labelCls}>Adrès</label><input className={inputCls} placeholder="Adrès konplè..." value={evAddr} onChange={e => setEvAddr(e.target.value)} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={labelCls}>Vil *</label><input className={inputCls} placeholder="Pòtoprens" value={evCity} onChange={e => setEvCity(e.target.value)} /></div>
                <div><label className={labelCls}>Eta / Dept.</label><input className={inputCls} placeholder="Lwès" value={evState} onChange={e => setEvState(e.target.value)} /></div>
                <div><label className={labelCls}>Peyi *</label><select className={selectCls} value={evCountry} onChange={e => setEvCountry(e.target.value)}>{['🇭🇹 Ayiti','🇺🇸 Etazini','🇨🇦 Kanada','🇩🇴 Dominikani','🇫🇷 Frans'].map(c => <option key={c} className="bg-dark-card">{c}</option>)}</select></div>
              </div>
              <div><label className={labelCls}>Kapasite Total *</label><input type="number" className={inputCls} placeholder="Ex: 1200" value={evCap} onChange={e => setEvCap(e.target.value)} /></div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => goTo(1)} className="px-6 py-3 rounded-[10px] border border-border text-gray-light font-bold text-sm hover:text-white transition-all">← Retou</button>
              <button onClick={() => goTo(3)} className="flex-1 py-3 rounded-[10px] bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">Kontinye →</button>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: PLAN SAL ═══ */}
        {step === 3 && !done && (
          <div>
            <h2 className="font-heading text-xl tracking-wide mb-1">PLAN SAL</h2>
            <p className="text-xs text-gray-light mb-5">Defini seksyon sal la. Tikè ak pri ap baze sou seksyon sa yo.</p>

            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[{id:'build' as const, icon:'🔧', name:'Bati Plan', desc:'Kreye seksyon manyèlman'}, {id:'upload' as const, icon:'📄', name:'Telechaje Plan', desc:'Ou gen yon imaj plan sal'}].map(m => (
                <button key={m.id} onClick={() => setSeatMode(m.id)}
                  className={`p-4 rounded-xl border text-center transition-all ${seatMode === m.id ? 'border-orange bg-orange-dim' : 'border-border bg-white/[0.02] hover:border-white/[0.15]'}`}>
                  <div className="text-3xl mb-1">{m.icon}</div>
                  <p className="text-xs font-bold">{m.name}</p>
                  <p className="text-[9px] text-gray-muted">{m.desc}</p>
                </button>
              ))}
            </div>

            {/* BUILD MODE */}
            {seatMode === 'build' && (
              <>
                <label className={labelCls}>Tip Aransman</label>
                <div className="grid grid-cols-4 gap-2.5 mb-5">
                  {LAYOUTS.map((l, i) => (
                    <button key={i} onClick={() => setLayout(i)}
                      className={`p-3 rounded-xl border text-center transition-all ${layout === i ? 'border-orange bg-orange-dim' : 'border-border bg-white/[0.02] hover:border-white/[0.15]'}`}>
                      <div className="text-2xl mb-1">{l.icon}</div>
                      <p className="text-[11px] font-bold">{l.name}</p>
                      <p className="text-[8px] text-gray-muted">{l.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="bg-dark-card border border-border rounded-2xl p-5 mb-4">
                  <div className="bg-gradient-to-r from-orange/15 to-orange/5 border border-dashed border-orange rounded-lg text-center py-2.5 mb-4">
                    <span className="font-heading text-base tracking-widest text-orange">🎤 SÈNN</span>
                  </div>
                  <div className="space-y-2.5">
                    {sections.map(s => (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-white/[0.1] transition-all" style={{borderLeftColor:s.color, borderLeftWidth:3}}>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background:s.color}} />
                        <div className="flex-1 min-w-0">
                          <input value={s.name} onChange={e => updateSection(s.id, 'name', e.target.value)} className="bg-transparent text-xs font-bold text-white outline-none w-full" />
                          <input value={s.description} onChange={e => updateSection(s.id, 'description', e.target.value)} className="bg-transparent text-[10px] text-gray-light outline-none w-full mt-0.5" />
                        </div>
                        <div className="text-right flex-shrink-0 flex items-center gap-2">
                          <div>
                            <input type="number" value={s.seats} onChange={e => updateSection(s.id, 'seats', Number(e.target.value))} className="bg-transparent font-heading text-xl text-right outline-none w-16" />
                            <p className="text-[9px] text-gray-muted text-right">plas</p>
                          </div>
                          {sections.length > 1 && <button onClick={() => removeSection(s.id)} className="text-gray-muted hover:text-red text-sm">✕</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={addSection} className="w-full mt-3 py-3 rounded-xl border-2 border-dashed border-border text-gray-light text-xs font-semibold hover:border-orange hover:text-orange transition-all">+ Ajoute Seksyon</button>
                  <div className="flex gap-4 mt-3 pt-3 border-t border-border">
                    {sections.map(s => <div key={s.id} className="flex items-center gap-1.5 text-[10px] text-gray-light"><span className="w-2 h-2 rounded-full inline-block" style={{background:s.color}} />{s.name}</div>)}
                  </div>
                </div>
              </>
            )}

            {/* UPLOAD MODE */}
            {seatMode === 'upload' && (
              <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-orange transition-all cursor-pointer">
                <div className="text-4xl mb-2">🗺️</div>
                <p className="text-xs text-gray-light"><span className="text-orange font-semibold">Klike pou chwazi</span> oswa trennen plan sal la isit</p>
                <p className="text-[10px] text-gray-muted mt-1.5">JPG, PNG · Max 5MB</p>
                <p className="text-[10px] text-gray-muted mt-3 bg-white/[0.02] rounded-lg p-2">📌 Apre telechaje, ou ka make seksyon yo dirèkteman sou plan an</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => goTo(2)} className="px-6 py-3 rounded-[10px] border border-border text-gray-light font-bold text-sm hover:text-white transition-all">← Retou</button>
              <button onClick={() => goTo(4)} className="flex-1 py-3 rounded-[10px] bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">Kontinye →</button>
            </div>
          </div>
        )}

        {/* ═══ STEP 4: TIKÈ & PRI ═══ */}
        {step === 4 && !done && (
          <div>
            <h2 className="font-heading text-xl tracking-wide mb-1">TIKÈ & PRI</h2>
            <p className="text-xs text-gray-light mb-5">Fikse pri pou chak seksyon ou defini nan Plan Sal la.</p>

            <div className="space-y-3">
              {tiers.map(t => (
                <div key={t.id} className="bg-white/[0.02] border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full inline-block" style={{background:t.color}} />
                      {t.name}
                    </h4>
                    {tiers.length > 1 && <button onClick={() => removeTier(t.id)} className="text-gray-muted hover:text-red text-sm">✕</button>}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={labelCls}>Non Nivo</label><input className={inputCls} value={t.name} onChange={e => updateTier(t.id, 'name', e.target.value)} /></div>
                    <div><label className={labelCls}>Pri (USD)</label><input type="number" className={inputCls} value={t.price || ''} onChange={e => updateTier(t.id, 'price', Number(e.target.value))} /></div>
                    <div><label className={labelCls}>Kantite</label><input type="number" className={inputCls} value={t.qty || ''} onChange={e => updateTier(t.id, 'qty', Number(e.target.value))} /></div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addTier} className="w-full mt-3 py-3 rounded-xl border-2 border-dashed border-border text-gray-light text-xs font-semibold hover:border-orange hover:text-orange transition-all">+ Ajoute Yon Nivo</button>

            {/* Summary */}
            <div className="mt-4 bg-dark-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div><p className="text-[10px] text-gray-muted uppercase">Total Tikè</p><p className="font-heading text-2xl">{totalTix.toLocaleString()}</p></div>
              <div className="text-right"><p className="text-[10px] text-gray-muted uppercase">Revni Potansyèl</p><p className="font-heading text-2xl text-green">${totalRev.toLocaleString()}</p></div>
            </div>

            {/* Promo */}
            <div className="mt-4">
              <label className={labelCls}>Kòd Pwomo (opsyonèl)</label>
              {promos.map((p, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 mb-2">
                  <input className={inputCls} placeholder="Ex: KOMPA10" value={p.code} onChange={e => { const next = [...promos]; next[i].code = e.target.value; setPromos(next); }} />
                  <div className="flex gap-2">
                    <input type="number" className={inputCls} placeholder="% rabè" value={p.discount || ''} onChange={e => { const next = [...promos]; next[i].discount = Number(e.target.value); setPromos(next); }} />
                    {promos.length > 1 && <button onClick={() => setPromos(prev => prev.filter((_, j) => j !== i))} className="text-gray-muted hover:text-red text-sm px-2">✕</button>}
                  </div>
                </div>
              ))}
              <button onClick={() => setPromos(prev => [...prev, { code:'', discount:0 }])} className="text-[11px] text-orange hover:underline">+ Ajoute kòd pwomo</button>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => goTo(3)} className="px-6 py-3 rounded-[10px] border border-border text-gray-light font-bold text-sm hover:text-white transition-all">← Retou</button>
              <button onClick={() => goTo(5)} className="flex-1 py-3 rounded-[10px] bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">Kontinye →</button>
            </div>
          </div>
        )}

        {/* ═══ STEP 5: IMAJ ═══ */}
        {step === 5 && !done && (
          <div>
            <h2 className="font-heading text-xl tracking-wide mb-1">IMAJ EVÈNMAN</h2>
            <p className="text-xs text-gray-light mb-5">Ajoute yon afich oswa foto pou evènman ou an.</p>

            {!imagePreview ? (
              <label className="block border-2 border-dashed border-border rounded-2xl p-10 text-center hover:border-orange transition-all cursor-pointer">
                <div className="text-5xl mb-3">📸</div>
                <p className="text-xs text-gray-light"><span className="text-orange font-semibold">Klike pou chwazi</span> oswa trennen yon imaj isit</p>
                <p className="text-[10px] text-gray-muted mt-1.5">JPG, PNG · Max 5MB · Rekòmande: 1200×630px</p>
                <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
              </label>
            ) : (
              <div className="text-center">
                <img src={imagePreview} alt="Preview" className="max-w-full max-h-[250px] rounded-xl border border-border mx-auto" />
                <button onClick={() => setImagePreview(null)} className="text-red text-[11px] mt-2 hover:underline">✕ Retire imaj</button>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => goTo(4)} className="px-6 py-3 rounded-[10px] border border-border text-gray-light font-bold text-sm hover:text-white transition-all">← Retou</button>
              <button onClick={() => goTo(6)} className="flex-1 py-3 rounded-[10px] bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">Kontinye →</button>
            </div>
          </div>
        )}

        {/* ═══ STEP 6: REVIZE ═══ */}
        {step === 6 && !done && (
          <div>
            <h2 className="font-heading text-xl tracking-wide mb-1">REVIZE & PIBLIYE</h2>
            <p className="text-xs text-gray-light mb-5">Verifye tout detay yo anvan ou pibliye.</p>

            {/* Info */}
            <div className="bg-dark-card border border-border rounded-xl p-5 mb-3">
              <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-2.5">Enfòmasyon</p>
              {[['Non', evName],['Kategori', evCat],['Deskripsyon', evDesc || '—'],['Lang', evLang],['Laj', evAge]].map(([l,v]) => (
                <div key={l as string} className="flex justify-between py-1.5 text-xs"><span className="text-gray-light">{l}:</span><span className="font-semibold">{v || '—'}</span></div>
              ))}
            </div>

            {/* Restrictions */}
            {selectedChips.length > 0 && (
              <div className="bg-dark-card border border-border rounded-xl p-5 mb-3">
                <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-2.5">Restriksyon</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedChips.map((c, i) => <span key={i} className="px-2.5 py-1 rounded-full text-[10px] bg-orange-dim border border-orange-border text-orange">{c.label}</span>)}
                </div>
              </div>
            )}

            {/* Date & Venue */}
            <div className="bg-dark-card border border-border rounded-xl p-5 mb-3">
              <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-2.5">Dat & Kote</p>
              {[['Dat', evDateStart + (evDateEnd ? ` → ${evDateEnd}` : '')],['Lè', evTimeStart + (evTimeEnd ? ` → ${evTimeEnd}` : '')],['Kote', evVenue],['Adrès', evAddr],['Vil', evCity],['Eta/Dept.', evState],['Peyi', evCountry],['Kapasite', evCap]].map(([l,v]) => (
                <div key={l as string} className="flex justify-between py-1.5 text-xs"><span className="text-gray-light">{l}:</span><span className="font-semibold">{v || '—'}</span></div>
              ))}
            </div>

            {/* Tickets */}
            <div className="bg-dark-card border border-border rounded-xl p-5 mb-3">
              <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-2.5">Tikè</p>
              {tiers.map(t => (
                <div key={t.id} className="flex justify-between py-1.5 text-xs border-b border-border last:border-0">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{background:t.color}} />{t.name}</span>
                  <span className="font-semibold">{t.qty} tikè × ${t.price} = <span className="text-green">${(t.qty * t.price).toLocaleString()}</span></span>
                </div>
              ))}
              <div className="flex justify-between pt-2.5 mt-1 text-xs font-bold">
                <span>Total:</span><span className="text-green">{totalTix.toLocaleString()} tikè · ${totalRev.toLocaleString()}</span>
              </div>
            </div>

            {/* Promos */}
            {promos.some(p => p.code) && (
              <div className="bg-dark-card border border-border rounded-xl p-5 mb-3">
                <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-2.5">Kòd Pwomo</p>
                {promos.filter(p => p.code).map((p, i) => (
                  <div key={i} className="flex justify-between py-1.5 text-xs"><span className="font-mono text-orange">{p.code}</span><span className="font-semibold">{p.discount}% rabè</span></div>
                ))}
              </div>
            )}

            {/* Image */}
            {imagePreview && (
              <div className="bg-dark-card border border-border rounded-xl p-5 mb-3">
                <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-2.5">Imaj</p>
                <img src={imagePreview} alt="Event" className="max-h-[150px] rounded-lg border border-border" />
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => goTo(5)} className="px-6 py-3 rounded-[10px] border border-border text-gray-light font-bold text-sm hover:text-white transition-all">← Retou</button>
              <button className="px-6 py-3 rounded-[10px] border border-border text-gray-light font-bold text-sm hover:text-white transition-all">💾 Sove Bouyon</button>
              <button onClick={() => setDone(true)} className="flex-1 py-3 rounded-[10px] bg-green text-white font-bold text-sm hover:bg-green/80 transition-all">🚀 Pibliye Evènman</button>
            </div>
          </div>
        )}

        {/* ═══ SUCCESS ═══ */}
        {done && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="font-heading text-3xl tracking-wide mb-2">EVÈNMAN PIBLIYE!</h2>
            <p className="text-xs text-gray-light mb-6 max-w-sm mx-auto">Evènman ou an disponib kounye a. Moun ka kòmanse achte tikè.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/organizer/dashboard" className="px-6 py-3 rounded-lg bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">📊 Dachbòd</Link>
              <Link href="/organizer/vendors" className="px-6 py-3 rounded-lg border border-orange-border text-orange font-bold text-sm hover:bg-orange-dim transition-all">🏪 Envite Vandè</Link>
              <button onClick={() => { setDone(false); setStep(1); setEvName(''); setEvCat(''); setEvDesc(''); }} className="px-6 py-3 rounded-lg border border-border text-gray-light font-bold text-sm hover:text-white transition-all">➕ Kreye Yon Lòt</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

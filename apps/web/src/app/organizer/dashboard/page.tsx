'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getOrganizerEvents, type EventData } from '@/lib/db';

const EMOJIS = ['🎶','🎧','🥁','🎺','🎭','🎷','🎵','🎤','🪘','🎹'];

/* ══════════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════════ */

const EVENTS = [
  { id:1, name:'Kompa Fest 2026', date:'15 Mars', status:'live', sold:842, cap:1200, revenue:22650, emoji:'🎶', resellers:3 },
  { id:2, name:'DJ Stéphane Live', date:'22 Mars', status:'upcoming', sold:305, cap:500, revenue:10175, emoji:'🎧', resellers:2 },
  { id:3, name:'Rara Lakay 2026', date:'5 Avr', status:'upcoming', sold:100, cap:2000, revenue:3500, emoji:'🥁', resellers:5 },
  { id:4, name:'Gala Solidarite 2025', date:'12 Nov', status:'past', sold:280, cap:300, revenue:21000, emoji:'✨', resellers:1 },
];

const RESELLERS = [
  { id:1, name:'Ti Jak Boutik', contact:'Jean-Marc Pierre', phone:'+509 3412 1111', city:'Pétion-Ville', events:2, assigned:80, sold:52, owed:780, status:'active' },
  { id:2, name:'Farmasi Lespwa', contact:'Marie Julien', phone:'+509 3412 2222', city:'Pòtoprens', events:1, assigned:50, sold:35, owed:525, status:'active' },
  { id:3, name:'Babo Barbershop', contact:'Roberto Charles', phone:'+509 3412 3333', city:'Delmas', events:2, assigned:60, sold:60, owed:0, status:'settled' },
  { id:4, name:'Lakay Mizik', contact:'Sophia Bien-Aimé', phone:'+509 3412 4444', city:'Jacmel', events:1, assigned:40, sold:12, owed:180, status:'active' },
  { id:5, name:'Quick Stop PV', contact:'Patrick Duval', phone:'+509 3412 5555', city:'Pétion-Ville', events:3, assigned:100, sold:78, owed:1170, status:'active' },
];

const RECENT_SALES = [
  { time:'2 min', reseller:'Ti Jak Boutik', event:'Kompa Fest 2026', qty:2, section:'VIP', amount:150 },
  { time:'8 min', reseller:'Online', event:'Kompa Fest 2026', qty:1, section:'GA', amount:15 },
  { time:'15 min', reseller:'Quick Stop PV', event:'DJ Stéphane Live', qty:3, section:'GA', amount:75 },
  { time:'22 min', reseller:'Online', event:'Kompa Fest 2026', qty:2, section:'VVIP', amount:300 },
  { time:'35 min', reseller:'Farmasi Lespwa', event:'Rara Lakay 2026', qty:4, section:'GA', amount:40 },
];

type Tab = 'dashboard' | 'events' | 'resellers' | 'revenue' | 'scanner' | 'settings';

const NAV_ITEMS: { id: Tab; icon: string; label: string; badge?: number }[] = [
  { id:'dashboard', icon:'📊', label:'Dachbòd' },
  { id:'events', icon:'📅', label:'Evènman', badge:3 },
  { id:'resellers', icon:'🏪', label:'Revandè', badge:5 },
  { id:'revenue', icon:'💰', label:'Revni' },
  { id:'scanner', icon:'📱', label:'Eskanè' },
  { id:'settings', icon:'⚙️', label:'Paramèt' },
];

/* ══════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════ */

export default function OrganizerDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [sideOpen, setSideOpen] = useState(false);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    getOrganizerEvents(user.uid).then(evs => {
      setEvents(evs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.uid]);

  const totalRevenue = events.reduce((a, e) => a + ((e as any).revenue || 0), 0);
  const totalSold = events.reduce((a, e) => a + ((e as any).totalSold || 0), 0);
  const activeEvents = events.filter(e => e.status === 'published' || e.status === 'live').length;
  const totalResellerOwed = RESELLERS.reduce((a, v) => a + v.owed, 0);

  return (
    <div className="min-h-screen flex bg-dark">
      {/* ═══ SIDEBAR ═══ */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[220px] bg-dark-card border-r border-border flex flex-col transition-transform md:translate-x-0 md:static ${sideOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 pb-5 border-b border-border">
          <Link href="/"><img src="/logo.jpg" alt="Anbyans" className="h-10 rounded" /></Link>
        </div>
        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-muted px-3 mb-2">Jeneral</p>
          {NAV_ITEMS.map(n => (
            <button key={n.id} onClick={() => { if (n.id === 'resellers') { router.push('/organizer/vendors'); return; } setTab(n.id); setSideOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] mb-0.5 transition-all ${tab === n.id ? 'bg-orange-dim text-orange font-semibold' : 'text-gray-light hover:bg-dark-hover hover:text-white'}`}>
              <span className="text-base w-5 text-center">{n.icon}</span>
              {n.label}
              {n.badge && <span className="ml-auto bg-orange text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-orange flex items-center justify-center text-sm font-bold">JB</div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold truncate">Jean Baptiste</p>
            <p className="text-[9px] text-gray-muted">Mega Events Haiti</p>
          </div>
          <Link href="/" className="text-gray-muted hover:text-red text-sm">🚪</Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sideOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSideOpen(false)} />}

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* HEADER */}
        <header className="sticky top-0 z-20 bg-dark border-b border-border px-5 flex items-center h-14 gap-3">
          <button onClick={() => setSideOpen(true)} className="md:hidden text-xl">☰</button>
          <h1 className="font-heading text-xl tracking-wide flex-1">
            {tab === 'dashboard' && 'DACHBÒD'}
            {tab === 'events' && 'EVÈNMAN'}
            {tab === 'resellers' && 'REVANDÈ'}
            {tab === 'revenue' && 'REVNI'}
            {tab === 'scanner' && 'ESKANÈ'}
            {tab === 'settings' && 'PARAMÈT'}
          </h1>
          <Link href="/organizer/events/create" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
            ➕ Kreye Evènman
          </Link>
          <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-border flex items-center justify-center text-sm cursor-pointer relative">
            🔔<div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red rounded-full" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">

          {/* ═══ DASHBOARD TAB ═══ */}
          {tab === 'dashboard' && <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              {[
                { label:'REVNI TOTAL', value:`$${totalRevenue.toLocaleString()}`, change:'+18%', up:true },
                { label:'TIKÈ VANN', value:totalSold.toLocaleString(), change:'+24%', up:true },
                { label:'EVÈNMAN AKTIF', value:'3', change:'', up:true },
                { label:'REVANDÈ DWE', value:`$${totalResellerOwed.toLocaleString()}`, change:'', up:false },
              ].map((s, i) => (
                <div key={i} className="bg-dark-card border border-border rounded-card p-4">
                  <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">{s.label}</p>
                  <p className="font-heading text-3xl tracking-wide">{s.value}</p>
                  {s.change && <p className={`text-[10px] mt-1 ${s.up ? 'text-green' : 'text-red'}`}>{s.change} semèn sa a</p>}
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <button onClick={() => setTab('events')} className="bg-dark-card border border-border rounded-card p-4 flex items-center gap-3 hover:border-orange-border hover:bg-dark-hover transition-all text-left">
                <span className="text-2xl">📅</span>
                <div><p className="text-xs font-bold">Kreye Evènman</p><p className="text-[10px] text-gray-light">Kreye yon nouvo evènman ak seksyon tikè</p></div>
              </button>
              <button onClick={() => router.push('/organizer/vendors')} className="bg-dark-card border border-border rounded-card p-4 flex items-center gap-3 hover:border-orange-border hover:bg-dark-hover transition-all text-left">
                <span className="text-2xl">🏪</span>
              </button>
              <Link href="/organizer/scanner" className="bg-dark-card border border-border rounded-card p-4 flex items-center gap-3 hover:border-orange-border hover:bg-dark-hover transition-all">
                <span className="text-2xl">📱</span>
                <div><p className="text-xs font-bold">Ouvri Eskanè</p><p className="text-[10px] text-gray-light">Eskane QR tikè nan antre evènman</p></div>
              </Link>
              <button onClick={() => setTab('revenue')} className="bg-dark-card border border-border rounded-card p-4 flex items-center gap-3 hover:border-orange-border hover:bg-dark-hover transition-all text-left">
                <span className="text-2xl">📈</span>
                <div><p className="text-xs font-bold">Wè Rapò</p><p className="text-[10px] text-gray-light">Analiz vant, revni, ak pèfòmans revandè</p></div>
              </button>
            </div>

            {/* Events Overview */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-lg tracking-wide">EVÈNMAN</h2>
                <button onClick={() => setTab('events')} className="text-[11px] text-orange hover:underline">Wè tout →</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-[10px] text-gray-muted uppercase tracking-widest pb-2.5 pl-3">Evènman</th>
                      <th className="text-[10px] text-gray-muted uppercase tracking-widest pb-2.5">Dat</th>
                      <th className="text-[10px] text-gray-muted uppercase tracking-widest pb-2.5">Estati</th>
                      <th className="text-[10px] text-gray-muted uppercase tracking-widest pb-2.5">Vant</th>
                      <th className="text-[10px] text-gray-muted uppercase tracking-widest pb-2.5">Revandè</th>
                      <th className="text-[10px] text-gray-muted uppercase tracking-widest pb-2.5">Revni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} style={{textAlign:"center",padding:24,color:"#9ca3af"}}>Chaje...</td></tr>
                    ) : events.length === 0 ? (
                      <tr><td colSpan={6} style={{textAlign:"center",padding:24,color:"#9ca3af"}}>Pa gen evènman — <a href="/organizer/events/create" style={{color:"#f97316"}}>Kreye premye a</a></td></tr>
                    ) : (events as any[]).map(e => {
                      const pct = Math.round((e.sold / e.cap) * 100);
                      return (
                        <tr key={e.id} className="border-b border-border hover:bg-white/[0.015] cursor-pointer">
                          <td className="py-3 pl-3"><span className="mr-2">{e.emoji}</span><span className="text-xs font-semibold">{e.name}</span></td>
                          <td className="text-xs text-gray-light">{e.date}</td>
                          <td>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              e.status === 'live' ? 'bg-green-dim text-green' : e.status === 'upcoming' ? 'bg-cyan-dim text-cyan' : 'bg-white/[0.05] text-gray-muted'
                            }`}>
                              {e.status === 'live' ? '● AN DIRÈK' : e.status === 'upcoming' ? 'AP VINI' : 'PASE'}
                            </span>
                          </td>
                          <td className="text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden"><div className="h-full bg-orange rounded-full" style={{width:`${pct}%`}} /></div>
                              <span className="text-gray-light">{e.sold}/{e.cap}</span>
                            </div>
                          </td>
                          <td className="text-xs text-gray-light">{e.resellers}</td>
                          <td className="text-xs font-bold">${e.revenue.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Sales */}
            <div>
              <h2 className="font-heading text-lg tracking-wide mb-3">DÈNYE VANT</h2>
              <div className="space-y-2">
                {RECENT_SALES.map((s, i) => (
                  <div key={i} className="bg-dark-card border border-border rounded-card p-3 flex items-center gap-3">
                    <span className="text-[10px] text-gray-muted w-12 flex-shrink-0">{s.time}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{s.event}</p>
                      <p className="text-[10px] text-gray-light">{s.qty}× {s.section} · {s.reseller === 'Online' ? '🌐 Online' : `🏪 ${s.reseller}`}</p>
                    </div>
                    <span className="font-heading text-lg text-green">${s.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </>}

          {/* ═══ RESELLERS TAB ═══ */}
          {tab === 'resellers' && <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-light">{RESELLERS.length} revandè anrejistre</p>
            </div>

            {/* Reseller Cards */}
            <div className="space-y-3">
              {RESELLERS.map(v => (
                <div key={v.id} className="bg-dark-card border border-border rounded-card p-4 hover:border-white/[0.1] transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-dim border border-purple-border flex items-center justify-center text-lg flex-shrink-0">🏪</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-sm">{v.name}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${v.status === 'active' ? 'bg-green-dim text-green' : 'bg-white/[0.05] text-gray-muted'}`}>
                          {v.status === 'active' ? 'AKTIF' : 'REGLE'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-light">{v.contact} · 📍 {v.city}</p>
                      <p className="text-[11px] text-gray-muted">{v.phone}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {v.owed > 0 && <p className="text-xs font-bold text-orange">Dwe: ${v.owed}</p>}
                      {v.owed === 0 && <p className="text-xs font-bold text-green">✓ Regle</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
                    <div><p className="text-[9px] text-gray-muted uppercase">Evènman</p><p className="text-sm font-bold">{v.events}</p></div>
                    <div><p className="text-[9px] text-gray-muted uppercase">Tikè Asiyen</p><p className="text-sm font-bold">{v.assigned}</p></div>
                    <div>
                      <p className="text-[9px] text-gray-muted uppercase">Vann</p>
                      <p className="text-sm font-bold">{v.sold} <span className="text-[10px] text-gray-muted font-normal">({Math.round((v.sold/v.assigned)*100)}%)</span></p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link href="/organizer/vendors" className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-white hover:border-white/[0.15] transition-all">📋 Asiyen Tikè</Link>
                    <Link href="/organizer/vendors" className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border text-[10px] font-bold text-gray-light hover:text-white hover:border-white/[0.15] transition-all">📊 Wè Vant</Link>
                    {v.owed > 0 && <Link href="/organizer/vendors" className="px-3 py-1.5 rounded-lg bg-orange-dim border border-orange-border text-[10px] font-bold text-orange hover:bg-orange hover:text-white transition-all">💰 Mande Peman</Link>}
                  </div>
                </div>
              ))}
            </div>
          </>}

          {/* ═══ EVENTS TAB ═══ */}
          {tab === 'events' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-light">{events.length} evènman</p>
                <Link href="/organizer/events/create" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">➕ Kreye Evènman</Link>
              </div>
              <div className="space-y-3">
                {(events as any[]).map(e => {
                  const pct = Math.round((e.sold / e.cap) * 100);
                  return (
                    <div key={e.id} className="bg-dark-card border border-border rounded-card p-4 hover:border-white/[0.1] transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-[10px] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center text-3xl flex-shrink-0">{e.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold">{e.name}</p>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${e.status === 'live' ? 'bg-green-dim text-green' : e.status === 'upcoming' ? 'bg-cyan-dim text-cyan' : 'bg-white/[0.05] text-gray-muted'}`}>
                              {e.status === 'live' ? '● AN DIRÈK' : e.status === 'upcoming' ? 'AP VINI' : 'PASE'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-light mt-0.5">📅 {e.date} · 🏪 {e.resellers} revandè</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-heading text-2xl">${e.revenue.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-muted">{e.sold}/{e.cap} tikè ({pct}%)</p>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-orange rounded-full transition-all" style={{width:`${pct}%`}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ REVENUE TAB ═══ */}
          {tab === 'revenue' && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div className="bg-dark-card border border-border rounded-card p-4">
                  <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">REVNI TOTAL</p>
                  <p className="font-heading text-3xl">${totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-dark-card border border-border rounded-card p-4">
                  <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">VANT ONLINE</p>
                  <p className="font-heading text-3xl">${Math.round(totalRevenue * 0.65).toLocaleString()}</p>
                  <p className="text-[10px] text-green mt-1">65% total</p>
                </div>
                <div className="bg-dark-card border border-border rounded-card p-4">
                  <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">VANT REVANDÈ</p>
                  <p className="font-heading text-3xl">${Math.round(totalRevenue * 0.35).toLocaleString()}</p>
                  <p className="text-[10px] text-orange mt-1">35% total</p>
                </div>
                <div className="bg-dark-card border border-border rounded-card p-4">
                  <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">REVANDÈ DWE</p>
                  <p className="font-heading text-3xl text-orange">${totalResellerOwed.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-dark-card border border-border rounded-card p-5">
                <h3 className="font-heading text-lg tracking-wide mb-3">BALANS REVANDÈ</h3>
                <div className="space-y-2.5">
                  {RESELLERS.map(v => (
                    <div key={v.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <span className="text-base">🏪</span>
                      <p className="text-xs font-semibold flex-1">{v.name}</p>
                      <p className="text-xs text-gray-light">{v.sold} tikè vann</p>
                      {v.owed > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-orange">${v.owed}</span>
                          <button className="px-2.5 py-1 rounded-lg bg-orange text-white text-[9px] font-bold hover:bg-orange/80 transition-all">Mande</button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-green">✓ Regle</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ SCANNER TAB ═══ */}
          {tab === 'scanner' && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📱</div>
              <h3 className="font-heading text-2xl tracking-wide mb-2">ESKANÈ QR</h3>
              <p className="text-xs text-gray-light mb-6 max-w-sm mx-auto">Pou eskanè tikè, ouvri aplikasyon mobil la oswa itilize kamera aparèy ou.</p>
              <Link href="/organizer/scanner" className="inline-flex px-6 py-3 rounded-lg bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">Ouvri Eskanè →</Link>
            </div>
          )}

          {/* ═══ SETTINGS TAB ═══ */}
          {tab === 'settings' && (
            <div className="max-w-2xl">
              <h3 className="font-heading text-lg tracking-wide mb-4">PARAMÈT KONT</h3>

              {/* Profile */}
              <div className="bg-dark-card border border-border rounded-card p-5 space-y-3.5 mb-5">
                <p className="text-[10px] uppercase tracking-widest text-orange font-bold">Enfòmasyon Biznis</p>
                <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Non Biznis</label><input defaultValue="Mega Events Haiti" className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Imèl</label><input defaultValue="jean@megaevents.ht" className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange" /></div>
                  <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">Telefòn</label><input defaultValue="+509 3412 0000" className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange" /></div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="bg-dark-card border border-border rounded-card p-5 mb-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] uppercase tracking-widest text-orange font-bold">Metòd Peman — Resevwa Lajan</p>
                </div>
                <p className="text-[10px] text-gray-light mb-4">Chwazi kijan ou vle resevwa lajan vant tikè ou yo. Ou ka ajoute plizyè metòd.</p>

                {/* MonCash */}
                <div className="border border-border rounded-xl p-4 mb-3 hover:border-white/[0.1] transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">📱</span>
                    <div className="flex-1"><p className="text-xs font-bold">MonCash</p><p className="text-[10px] text-gray-muted">Transfè dirèk sou kont MonCash ou</p></div>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-green-dim text-green">AKTIF</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Nimewo MonCash</label><input defaultValue="+509 3412 0000" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange" /></div>
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Non sou kont lan</label><input defaultValue="Jean Baptiste" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange" /></div>
                  </div>
                </div>

                {/* Natcash */}
                <div className="border border-border rounded-xl p-4 mb-3 hover:border-white/[0.1] transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">💚</span>
                    <div className="flex-1"><p className="text-xs font-bold">Natcash</p><p className="text-[10px] text-gray-muted">Transfè dirèk sou kont Natcash ou</p></div>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-white/[0.05] text-gray-muted">PA AKTIF</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Nimewo Natcash</label><input placeholder="+509 ..." className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" /></div>
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Non sou kont lan</label><input placeholder="Non konplè" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" /></div>
                  </div>
                </div>

                {/* Credit / Debit Card */}
                <div className="border border-border rounded-xl p-4 mb-3 hover:border-white/[0.1] transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">💳</span>
                    <div className="flex-1"><p className="text-xs font-bold">Kat Kredi / Debi</p><p className="text-[10px] text-gray-muted">Via Stripe — Visa, Mastercard, Amex</p></div>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-white/[0.05] text-gray-muted">PA AKTIF</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Imèl Stripe</label><input placeholder="email@stripe.com" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" /></div>
                    <div className="flex items-end"><button className="w-full px-3 py-2 rounded-lg border border-cyan-border bg-cyan-dim text-cyan text-[11px] font-bold hover:bg-cyan hover:text-white transition-all">🔗 Konekte Stripe</button></div>
                  </div>
                </div>

                {/* Bank Transfer */}
                <div className="border border-border rounded-xl p-4 mb-3 hover:border-white/[0.1] transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">🏦</span>
                    <div className="flex-1"><p className="text-xs font-bold">Transfè Bank</p><p className="text-[10px] text-gray-muted">Viman dirèk nan kont bank ou</p></div>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-white/[0.05] text-gray-muted">PA AKTIF</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Non Bank</label><input placeholder="Ex: Sogebank, BNC, Unibank..." className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" /></div>
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Nimewo Kont</label><input placeholder="Nimewo kont bank" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2.5">
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Non sou kont lan</label><input placeholder="Non konplè" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" /></div>
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Tip Kont</label>
                      <select className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange">
                        <option className="bg-dark-card">Kont Epay (Savings)</option>
                        <option className="bg-dark-card">Kont Kouran (Checking)</option>
                        <option className="bg-dark-card">Kont Biznis</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Zelle */}
                <div className="border border-border rounded-xl p-4 mb-3 hover:border-white/[0.1] transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">⚡</span>
                    <div className="flex-1"><p className="text-xs font-bold">Zelle</p><p className="text-[10px] text-gray-muted">Transfè enstantane (Etazini sèlman)</p></div>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-white/[0.05] text-gray-muted">PA AKTIF</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Imèl oswa Telefòn Zelle</label><input placeholder="email@example.com oswa +1..." className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" /></div>
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Non sou kont lan</label><input placeholder="Non konplè" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" /></div>
                  </div>
                </div>

                {/* PayPal */}
                <div className="border border-border rounded-xl p-4 mb-3 hover:border-white/[0.1] transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">🅿️</span>
                    <div className="flex-1"><p className="text-xs font-bold">PayPal</p><p className="text-[10px] text-gray-muted">Resevwa peman entènasyonal</p></div>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-white/[0.05] text-gray-muted">PA AKTIF</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">Imèl PayPal</label><input placeholder="email@paypal.com" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" /></div>
                    <div className="flex items-end"><button className="w-full px-3 py-2 rounded-lg border border-cyan-border bg-cyan-dim text-cyan text-[11px] font-bold hover:bg-cyan hover:text-white transition-all">🔗 Konekte PayPal</button></div>
                  </div>
                </div>

                {/* CashApp */}
                <div className="border border-border rounded-xl p-4 hover:border-white/[0.1] transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">💲</span>
                    <div className="flex-1"><p className="text-xs font-bold">Cash App</p><p className="text-[10px] text-gray-muted">Transfè rapid (Etazini, UK)</p></div>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-white/[0.05] text-gray-muted">PA AKTIF</span>
                  </div>
                  <div><label className="block text-[10px] font-semibold text-gray-muted mb-1">$cashtag</label><input placeholder="$cashtag" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" /></div>
                </div>

                <p className="text-[10px] text-gray-muted mt-4 bg-white/[0.02] rounded-lg p-3">💡 Ou ka aktive plizyè metòd peman. Fan yo ap ka chwazi metòd yo prefere lè yo achte tikè. Peman revandè yo ap suiv metòd prensipal ou.</p>
              </div>

              {/* Payout Preferences */}
              <div className="bg-dark-card border border-border rounded-card p-5 mb-5">
                <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">Preferans Peman</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-muted mb-1">Metòd Prensipal pou Resevwa</label>
                    <select className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange">
                      <option className="bg-dark-card">📱 MonCash</option>
                      <option className="bg-dark-card">💚 Natcash</option>
                      <option className="bg-dark-card">💳 Stripe (Kat)</option>
                      <option className="bg-dark-card">🏦 Transfè Bank</option>
                      <option className="bg-dark-card">⚡ Zelle</option>
                      <option className="bg-dark-card">🅿️ PayPal</option>
                      <option className="bg-dark-card">💲 Cash App</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-muted mb-1">Frekans Peman</label>
                    <select className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange">
                      <option className="bg-dark-card">Imedyatman (chak vant)</option>
                      <option className="bg-dark-card">Chak jou</option>
                      <option className="bg-dark-card">Chak semèn</option>
                      <option className="bg-dark-card">Apre evènman</option>
                    </select>
                  </div>
                </div>
              </div>

              <button className="px-5 py-2.5 rounded-[10px] bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">Anrejistre Chanjman</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import {
  getOrganizerEvents,
  getOrganizerVendors,
  getOrganizerVendorPurchases,
  getAllUnassignedVendors,
  assignVendorToOrganizer,
  removeVendorFromOrganizer,
  inviteVendor,
  updateVendorStatus,
  updateVendorTrusted,
  saveEventBulkTiers,
  EventData,
  VendorData,
  VendorPurchase,
  BulkTier,
} from '@/lib/db';

type VendorWithPurchases = VendorData & {
  purchases: (VendorPurchase & { vendorId: string; vendorName: string })[];
};

const fmtTier = (t: { minQty: number; maxQty: number | null }) =>
  t.maxQty ? `${t.minQty}–${t.maxQty}` : `${t.minQty}+`;

const sectionColors: Record<string, string> = {
  VVIP: '#FFD700',
  VIP: '#FF6B35',
  GA: '#00D4FF',
};

export default function OrganizerResellersPage() {
  const { user } = useAuth();
  const { t } = useT();
  const router = useRouter();
  const [sideOpen, setSideOpen] = useState(false);

  const [events, setEvents] = useState<EventData[]>([]);
  const [resellers, setResellers] = useState<VendorWithPurchases[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [expandedReseller, setExpandedReseller] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [pricingEventIdx, setPricingEventIdx] = useState(0);

  const [inviteForm, setInviteForm] = useState({
    name: '', contact: '', phone: '', city: '', payMethod: 'MonCash',
  });
  const [inviteError, setInviteError] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [whatsAppUrl, setWhatsAppUrl] = useState('');
  const [mainTab, setMainTab] = useState<'my'|'available'>('my');
  const [unassigned, setUnassigned] = useState<VendorData[]>([]);
  const [assigning, setAssigning] = useState<string|null>(null);

  const loadData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const [evList, resellerList, purchaseList, unassignedList] = await Promise.all([
        getOrganizerEvents(user.uid),
        getOrganizerVendors(user.uid),
        getOrganizerVendorPurchases(user.uid),
        getAllUnassignedVendors(),
      ]);
      setUnassigned(unassignedList);
      const resellersWithPurchases: VendorWithPurchases[] = resellerList.map(v => ({
        ...v,
        purchases: purchaseList.filter(p => p.vendorId === v.id),
      }));
      setEvents(evList.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '')));
      setResellers(resellersWithPurchases);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { loadData(); }, [loadData]);

  const allPurchases = resellers.flatMap(v => v.purchases);
  const totalPurchased = allPurchases.reduce((a, b) => a + b.qty, 0);
  const totalSold = allPurchases.reduce((a, b) => a + b.sold, 0);
  const totalRevenue = allPurchases.reduce((a, b) => a + b.totalPaid, 0);

  const filtered = resellers.filter(v => {
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    if (filterEvent !== 'all' && !v.purchases.some(p => p.eventId === filterEvent)) return false;
    return true;
  });

  const handleInvite = async () => {
    if (!user?.uid) return;
    if (!inviteForm.name || !inviteForm.contact || !inviteForm.phone || !inviteForm.city) {
      setInviteError('Ranpli tout chan obligatwa yo *');
      return;
    }
    setSaving(true);
    setInviteError('');
    try {
      const reseller = await inviteVendor({ organizerId: user.uid, ...inviteForm });
      const msg = encodeURIComponent(
        `Bonjou ${inviteForm.contact}! Ou envite kòm vandè sou Anbyans.\n\nKlike lyen sa a pou kreye kont ou:\n${window.location.origin}/vendor/join?token=${reseller.inviteToken}\n\nMèsi!`
      );
      setWhatsAppUrl(`https://wa.me/${inviteForm.phone.replace(/\D/g, '')}?text=${msg}`);
      setInviteSent(true);
      setInviteForm({ name: '', contact: '', phone: '', city: '', payMethod: 'MonCash' });
      await loadData();
    } catch (err) {
      setInviteError('Erè — Eseye ankò');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTiers = async (eventId: string, sectionName: string, tiers: BulkTier[]) => {
    setSaving(true);
    try {
      await saveEventBulkTiers(eventId, sectionName, tiers);
      await loadData();
    } catch (err) {
      console.error('Save tiers error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (vendorId: string) => {
    if (!user?.uid) return;
    setAssigning(vendorId);
    try { await assignVendorToOrganizer(vendorId, user.uid); await loadData(); }
    catch(e){console.error(e);} finally{setAssigning(null);}
  };
  const pricingEvent = events[pricingEventIdx] ?? null;

  const NAV = [
    { id: 'dashboard', icon: '📊', label: 'Dachbòd', href: '/organizer/dashboard' },
    { id: 'events', icon: '📅', label: 'Evènman', href: '/organizer/dashboard' },
    { id: 'resellers', icon: '🏪', label: 'Revandè', href: '/organizer/vendors' },
    { id: 'revenue', icon: '💰', label: 'Revni', href: '/organizer/dashboard' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: '/organizer/dashboard' },
    { id: 'scanner', icon: '📱', label: 'Eskanè', href: '/organizer/scanner' },
    { id: 'settings', icon: '⚙️', label: 'Paramèt', href: '/organizer/dashboard' },
  ];
  const initials = user?.displayName?.split(' ').map(w=>w[0]).join('').toUpperCase() || 'O';

  return (
    <div className="min-h-screen flex bg-dark">
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[220px] bg-dark-card border-r border-border flex flex-col transition-transform md:translate-x-0 md:static ${sideOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-muted px-3 mb-2">Jeneral</p>
          {NAV.map(n => (
            <button key={n.id} onClick={() => { router.push(n.href); setSideOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] mb-0.5 transition-all ${n.id === 'resellers' ? 'bg-orange-dim text-orange font-semibold' : 'text-gray-light hover:bg-dark-hover hover:text-white'}`}>
              <span className="text-base w-5 text-center">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-orange flex items-center justify-center text-sm font-bold text-white">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold truncate">{user?.displayName || user?.email}</p>
            <p className="text-[9px] text-gray-muted">Pwomote</p>
          </div>
          <button onClick={() => router.push('/')} className="text-gray-muted hover:text-red text-sm">🚪</button>
        </div>
      </aside>

      {sideOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSideOpen(false)} />}

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
      <nav className="sticky top-0 z-20 bg-dark border-b border-border px-5">
        <div className="max-w-full mx-auto flex items-center h-14 gap-3">
          <button onClick={() => setSideOpen(true)} className="md:hidden text-xl">☰</button>
          <span className="font-heading text-lg tracking-wide flex-1">{t('resellers_title')}</span>
          {saving && <span className="text-[10px] text-orange animate-pulse">Ap {t('save').toLowerCase()}…</span>}
          <button onClick={() => setShowPricing(!showPricing)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-orange-border text-orange text-xs font-bold hover:bg-orange hover:text-white transition-all">
            💲 {t('resellers_bulk_pricing')}
          </button>
          <button onClick={() => { setShowInvite(true); setInviteSent(false); setWhatsAppUrl(''); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
            ➕ {t('resellers_invite')}
          </button>
        </div>
      </nav>

      <div className="max-w-[1200px] mx-auto w-full px-5 py-5 flex-1">

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-gray-muted">{t('loading')}</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            <div className="flex gap-2 mb-5 border-b border-border">
              {([['my','👥 Revandè Mwen',resellers.length],['available','🔍 Revandè Disponib',unassigned.length]] as const).map(([id,label,count])=>(
                <button key={id} onClick={()=>setMainTab(id)} className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${mainTab===id?'border-orange text-orange':'border-transparent text-gray-muted hover:text-white'}`}>
                  {label} <span className="ml-1 bg-border px-1.5 py-0.5 rounded-full text-[9px]">{count}</span>
                </button>
              ))}
            </div>
            {mainTab==='available' && (
              <div>
                <p className="text-xs text-gray-muted mb-4">Vendor ki enskri men poko konekte ak okenn òganizatè.</p>
                {unassigned.length===0 ? (
                  <div className="bg-dark-card border border-border rounded-card p-10 text-center">
                    <p className="text-xs text-gray-muted">Pa gen vendor disponib.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {unassigned.map(v=>(
                      <div key={v.id} className="bg-dark-card border border-border rounded-card p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-sm">{v.name}</p>
                          <p className="text-xs text-gray-muted">{v.contact} · {v.phone} · {v.city}</p>
                        </div>
                        <button onClick={()=>handleAssign(v.id!)} disabled={assigning===v.id}
                          className="px-4 py-2 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 disabled:opacity-50">
                          {assigning===v.id?'...':'➕ Ajoute'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {mainTab==='my' && (
            <>
            {/* STATS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <div className="bg-dark-card border border-border rounded-card p-3.5">
                <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">{t('resellers_active')}</p>
                <p className="font-heading text-2xl">{resellers.filter(v => v.status === 'active').length}</p>
              </div>
              <div className="bg-dark-card border border-border rounded-card p-3.5">
                <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">{t('resellers_purchased')}</p>
                <p className="font-heading text-2xl">{totalPurchased}</p>
              </div>
              <div className="bg-dark-card border border-border rounded-card p-3.5">
                <p className="text-[9px] text-gray-muted uppercase tracking-widest mb-1">{t('sold')}</p>
                <p className="font-heading text-2xl text-green">{totalSold} <span className="text-[10px] text-gray-muted font-body font-normal">({totalPurchased > 0 ? Math.round((totalSold/totalPurchased)*100) : 0}%)</span></p>
              </div>
              <div className="bg-dark-card border border-green rounded-card p-3.5">
                <p className="text-[9px] text-green uppercase tracking-widest mb-1">💰 {t('resellers_revenue')}</p>
                <p className="font-heading text-2xl text-green">${totalRevenue.toLocaleString()}</p>
              </div>
            </div>

            {/* BULK PRICING PANEL */}
            {showPricing && (
              <div className="bg-dark-card border border-orange-border rounded-card p-5 mb-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-lg tracking-wide">💲 {t('resellers_pricing_title')}</h3>
                  <button onClick={() => setShowPricing(false)} className="text-gray-muted hover:text-white text-sm">✕</button>
                </div>
                <p className="text-xs text-gray-light mb-4">{t('resellers_pricing_subtitle')}</p>
                {events.length === 0 ? (
                  <p className="text-xs text-gray-muted">Pa gen evènman disponib. Kreye yon evènman dabò.</p>
                ) : (
                  <>
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {events.map((ev, i) => (
                        <button key={ev.id} onClick={() => setPricingEventIdx(i)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${pricingEventIdx === i ? 'bg-orange text-white' : 'border border-border text-gray-light hover:text-white hover:border-white/[0.15]'}`}>
                          {ev.name}
                        </button>
                      ))}
                    </div>
                    {pricingEvent && (
                      <div className="space-y-4">
                        {pricingEvent.sections.map(sec => {
                          const tiers: BulkTier[] = (sec as any).bulkTiers || [];
                          const color = sectionColors[sec.name] || sec.color || '#888';
                          return (
                            <div key={sec.name} className="border border-border rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                                <span className="text-sm font-bold">{sec.name}</span>
                                <span className="text-[10px] text-gray-muted">· {t('resellers_online_price')}: <strong className="text-white">${sec.price}</strong> · {sec.capacity - sec.sold} {t('resellers_available')}</span>
                              </div>
                              {tiers.length === 0 ? (
                                <p className="text-[11px] text-gray-muted mb-3">Pa gen pri angwo konfigire pou seksyon sa a.</p>
                              ) : (
                                <div className="overflow-x-auto mb-3">
                                  <table className="w-full text-left">
                                    <thead>
                                      <tr className="border-b border-border">
                                        <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2">{t('resellers_qty')}</th>
                                        <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">{t('resellers_price_per')}</th>
                                        <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">{t('vend_buy_discount')}</th>
                                        <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">{t('resellers_example')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tiers.map((tier, i) => {
                                        const discount = Math.round(((sec.price - tier.priceEach) / sec.price) * 100);
                                        return (
                                          <tr key={i} className="border-b border-border last:border-0">
                                            <td className="py-2.5 text-xs font-bold">{fmtTier(tier)} {t('tickets')}</td>
                                            <td className="py-2.5 text-xs text-right"><span className="font-heading text-lg">${tier.priceEach}</span><span className="text-[10px] text-gray-muted ml-1">{t('buy_each')}</span></td>
                                            <td className="py-2.5 text-xs text-right"><span className="text-green font-bold">-{discount}%</span></td>
                                            <td className="py-2.5 text-xs text-right text-gray-light">{tier.minQty} × ${tier.priceEach} = <strong className="text-white">${tier.minQty * tier.priceEach}</strong></td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              <button onClick={() => {
                                const newTier: BulkTier = { minQty: 10, maxQty: 25, priceEach: Math.round(sec.price * 0.8) };
                                handleSaveTiers(pricingEvent.id!, sec.name, [...tiers, newTier]);
                              }} className="text-[10px] text-orange hover:underline">✏️ {t('resellers_edit_price')}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
                <p className="text-[10px] text-gray-muted mt-4 bg-white/[0.02] rounded-lg p-3">💡 {t('resellers_prepaid_note')}</p>
              </div>
            )}

            {/* FILTERS */}
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 rounded-full border border-border bg-transparent text-gray-light text-[11px] font-semibold outline-none cursor-pointer">
                <option value="all" className="bg-dark-card">{t('all')}</option>
                <option value="active" className="bg-dark-card">✅ {t('active')}</option>
                <option value="pending" className="bg-dark-card">⏳ {t('pending')}</option>
                <option value="inactive" className="bg-dark-card">⛔ {t('inactive')}</option>
              </select>
              <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} className="px-3 py-1.5 rounded-full border border-border bg-transparent text-gray-light text-[11px] font-semibold outline-none cursor-pointer">
                <option value="all" className="bg-dark-card">{t('all')} {t('events')}</option>
                {events.map(ev => <option key={ev.id} value={ev.id} className="bg-dark-card">{ev.name}</option>)}
              </select>
              <span className="text-[11px] text-gray-muted ml-auto">{filtered.length} {t('org_nav_resellers').toLowerCase()}</span>
            </div>

            {/* INVITE FORM */}
            {showInvite && (
              <div className="bg-dark-card border border-orange-border rounded-card p-5 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading text-lg tracking-wide">{t('resellers_invite_title')}</h3>
                  <button onClick={() => setShowInvite(false)} className="text-gray-muted hover:text-white text-sm">✕</button>
                </div>
                {inviteSent ? (
                  <div className="text-center py-6">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="text-sm font-bold text-green mb-1">{t('resellers_done')}!</p>
                    <p className="text-xs text-gray-muted mb-4">{t('resellers_invite_subtitle')}</p>
                    <div className="flex gap-3 justify-center flex-wrap">
                      <a href={whatsAppUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-green-600 text-white text-xs font-bold hover:bg-green-500 transition-all">
                        📨 {t('resellers_send_invite')}
                      </a>
                      <button onClick={() => { setInviteSent(false); setWhatsAppUrl(''); }}
                        className="px-5 py-2 rounded-[10px] bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">
                        ➕ {t('resellers_invite')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-light mb-4">{t('resellers_invite_subtitle')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('vend_auth_biz_name')} *</label><input value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Ex: Ti Jak Boutik" /></div>
                      <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('name')} *</label><input value={inviteForm.contact} onChange={e => setInviteForm(f => ({ ...f, contact: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Non moun responsab" /></div>
                      <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('phone')} WhatsApp *</label><input value={inviteForm.phone} onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="+509 3412 0000" /></div>
                      <div><label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('city')} *</label><input value={inviteForm.city} onChange={e => setInviteForm(f => ({ ...f, city: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" placeholder="Pétion-Ville" /></div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{t('vend_auth_payment_method')}</label>
                        <select value={inviteForm.payMethod} onChange={e => setInviteForm(f => ({ ...f, payMethod: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange">
                          <option className="bg-dark-card">📱 MonCash</option>
                          <option className="bg-dark-card">💚 Natcash</option>
                          <option className="bg-dark-card">🏦 Kont Bank</option>
                          <option className="bg-dark-card">💳 Stripe</option>
                          <option className="bg-dark-card">⚡ Zelle</option>
                          <option className="bg-dark-card">🅿️ PayPal</option>
                          <option className="bg-dark-card">💲 Cash App</option>
                        </select>
                      </div>
                    </div>
                    {inviteError && <p className="text-xs text-red-400 mt-2">{inviteError}</p>}
                    <div className="flex gap-2 mt-4">
                      <button onClick={handleInvite} disabled={saving} className="px-5 py-2.5 rounded-[10px] bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all disabled:opacity-50">
                        {saving ? `Ap ${t('save').toLowerCase()}…` : `💾 ${t('save')} ak Prepare WhatsApp`}
                      </button>
                      <button onClick={() => setShowInvite(false)} className="px-5 py-2.5 rounded-[10px] border border-border text-gray-light text-xs font-bold hover:text-white transition-all">{t('cancel')}</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* EMPTY STATE */}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">🏪</p>
                <p className="text-sm font-bold mb-1">Pa gen {t('org_nav_resellers').toLowerCase()} ankò</p>
                <p className="text-xs text-gray-muted mb-4">Klike "{t('resellers_invite')}" pou kòmanse.</p>
              </div>
            )}

            {/* RESELLER LIST */}
            <div className="space-y-3">
              {filtered.map(v => {
                const expanded = expandedReseller === v.id;
                const vTotalQty = v.purchases.reduce((a, b) => a + b.qty, 0);
                const vTotalSold = v.purchases.reduce((a, b) => a + b.sold, 0);
                const vTotalPaid = v.purchases.reduce((a, b) => a + b.totalPaid, 0);
                return (
                  <div key={v.id} className="bg-dark-card border border-border rounded-card overflow-hidden hover:border-white/[0.08] transition-all">
                    <div className="p-4 cursor-pointer" onClick={() => setExpandedReseller(expanded ? null : v.id!)}>
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-lg bg-purple-dim border border-purple-border flex items-center justify-center text-xl flex-shrink-0">🏪</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="font-bold text-sm">{v.name}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${v.status === 'active' ? 'bg-green-dim text-green' : v.status === 'pending' ? 'bg-yellow-dim text-yellow' : 'bg-white/[0.05] text-gray-muted'}`}>
                              {v.status === 'active' ? t('active').toUpperCase() : v.status === 'pending' ? t('pending').toUpperCase() : t('inactive').toUpperCase()}
                            </span>
                            {(v as any).trusted && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-cyan/10 text-cyan border border-cyan/30">
                                ✓ Trusted
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-light">{v.contact} · 📍 {v.city} · {v.phone}</p>
                          <p className="text-[10px] text-gray-muted mt-0.5">{v.payMethod} — {v.payAccount} · {t('resellers_since')} {v.joinedDate}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="text-right"><p className="text-[9px] text-gray-muted uppercase">{t('resellers_bought')}</p><p className="text-sm font-bold">{vTotalQty}</p></div>
                            <div className="text-right"><p className="text-[9px] text-gray-muted uppercase">{t('sold')}</p><p className="text-sm font-bold text-green">{vTotalSold}</p></div>
                            <div className="text-right"><p className="text-[9px] text-green uppercase">{t('resellers_paid')}</p><p className="text-sm font-bold text-green">${vTotalPaid.toLocaleString()}</p></div>
                            <span className={`text-gray-muted text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {expanded && (
                      <div className="border-t border-border">
                        {v.purchases.length === 0 ? (
                          <div className="p-5 text-center">
                            <p className="text-xs text-gray-muted">{v.status === 'pending' ? 'Revandè sa a poko aksepte envitasyon an.' : 'Revandè sa a poko achte tikè angwo.'}</p>
                            {v.status === 'pending' && (
                              <button onClick={async () => { await updateVendorStatus(v.id!, 'active'); await loadData(); }}
                                className="mt-3 px-4 py-1.5 rounded-lg bg-green-dim border border-green text-green text-[10px] font-bold hover:bg-green hover:text-white transition-all">
                                ✅ Manyèlman {t('active')}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="p-4">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left mb-3">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2">{t('events')}</th>
                                    <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2">Seksyon</th>
                                    <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-center">{t('resellers_bought')}</th>
                                    <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-center">{t('sold')}</th>
                                    <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-center">{t('remaining')}</th>
                                    <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">{t('resellers_price_per')}</th>
                                    <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">{t('total')} {t('resellers_paid')}</th>
                                    <th className="text-[9px] text-gray-muted uppercase tracking-widest pb-2 text-right">{t('resellers_purchase_date')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {v.purchases.map((p, i) => {
                                    const remaining = p.qty - p.sold;
                                    const pct = Math.round((p.sold / p.qty) * 100);
                                    const color = sectionColors[p.section] || p.sectionColor || '#888';
                                    return (
                                      <tr key={i} className="border-b border-border last:border-0">
                                        <td className="py-2.5"><span className="text-xs">{p.eventEmoji} {p.eventName}</span><p className="text-[9px] text-gray-muted">📅 {p.eventDate}</p></td>
                                        <td className="py-2.5"><span className="px-2 py-0.5 rounded text-[9px] font-bold border" style={{ color, borderColor: color, background: color + '15' }}>{p.section}</span></td>
                                        <td className="text-xs text-center font-bold">{p.qty}</td>
                                        <td className="text-center">
                                          <div className="flex items-center justify-center gap-1.5">
                                            <span className="text-xs font-bold text-green">{p.sold}</span>
                                            <div className="w-10 h-1.5 bg-white/[0.06] rounded-full overflow-hidden"><div className="h-full bg-green rounded-full" style={{ width: `${pct}%` }} /></div>
                                          </div>
                                        </td>
                                        <td className={`text-xs text-center font-bold ${remaining <= 5 && remaining > 0 ? 'text-orange' : remaining === 0 ? 'text-gray-muted' : ''}`}>{remaining === 0 ? `✓ ${t('resellers_done')}` : remaining}</td>
                                        <td className="text-xs text-right font-bold">${p.priceEach} <span className="text-[9px] text-gray-muted font-normal">{t('buy_each')}</span></td>
                                        <td className="text-xs text-right text-green font-bold">${p.totalPaid.toLocaleString()}</td>
                                        <td className="text-xs text-right text-gray-muted">{p.purchaseDate}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <div className="flex items-center gap-4 pt-2 border-t border-border flex-wrap">
                              <div><span className="text-[9px] text-gray-muted uppercase">{t('total')} {t('resellers_bought')}:</span> <span className="text-xs font-bold">{vTotalQty}</span></div>
                              <div><span className="text-[9px] text-gray-muted uppercase">{t('total')} {t('sold')}:</span> <span className="text-xs font-bold text-green">{vTotalSold}</span></div>
                              <div><span className="text-[9px] text-green uppercase font-bold">💰 {t('resellers_paid_upfront')}:</span> <span className="text-xs font-bold text-green">${vTotalPaid.toLocaleString()}</span></div>
                              <div className="ml-auto">
                                <button
                                  onClick={async (e) => { e.stopPropagation(); await updateVendorTrusted(v.id!, !(v as any).trusted); await loadData(); }}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${(v as any).trusted ? 'border-cyan/50 text-cyan bg-cyan/10 hover:bg-red/10 hover:text-red hover:border-red/50' : 'border-border text-gray-muted hover:border-cyan/50 hover:text-cyan hover:bg-cyan/10'}`}>
                                  {(v as any).trusted ? '✓ Trusted · Retire' : '+ Mete Trusted (💳 kat)'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
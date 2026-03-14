'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getFloorPlan, saveFloorPlan, saveEventLayout, getOrganizerVenueLayout } from '@/lib/db';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  name: string;
  price: number;
  capacity: number;
  color: string;
  type: 'ga' | 'reserved';
  vendorPrice?: number;
  vendorOpenDate?: string;
  vendorCloseDate?: string;
}

const COLORS = ['#f97316','#a855f7','#3b82f6','#10b981','#ef4444','#eab308','#ec4899','#06b6d4'];

function toSlug(str: string) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 60);
}
function uid6() { return Math.random().toString(36).substring(2, 8); }

// ─── Section editor ──────────────────────────────────────────────────────────

function SectionRow({ sec, onChange, onRemove, onAddZone, hasZone }: {
  sec: Section;
  onChange: (s: Section) => void;
  onRemove: () => void;
  onAddZone: () => void;
  hasZone: boolean;
}) {
  const [showTiers, setShowTiers] = useState(false);

  return (
    <div className="bg-white/[0.03] border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => onChange({ ...sec, color: c })}
              className={`w-5 h-5 rounded-full transition-all ${sec.color === c ? 'ring-2 ring-white scale-110' : ''}`}
              style={{ background: c }} />
          ))}
        </div>
        <button type="button" onClick={onRemove}
          className="ml-auto text-gray-600 hover:text-red-400 text-xs transition-colors">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[10px] font-bold text-gray-500 mb-1">NOM / NAME</label>
          <input value={sec.name} onChange={e => onChange({ ...sec, name: e.target.value })}
            placeholder="VIP · GA · Lounge..."
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-border text-white text-sm outline-none focus:border-orange" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1">PRICE FAN (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
            <input type="number" min={0} value={sec.price}
              onChange={e => onChange({ ...sec, price: Number(e.target.value) })}
              className="w-full pl-7 pr-3 py-2 rounded-lg bg-black/40 border border-border text-white text-sm outline-none focus:border-orange" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1">KAPASITE / CAPACITY</label>
          <input type="number" min={1} value={sec.capacity}
            onChange={e => onChange({ ...sec, capacity: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-border text-white text-sm outline-none focus:border-orange" />
        </div>
      </div>

      <div className="flex gap-2">
        {(['ga', 'reserved'] as const).map(t => (
          <button key={t} type="button" onClick={() => onChange({ ...sec, type: t })}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              sec.type === t ? 'bg-orange text-white' : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]'
            }`}>
            {t === 'ga' ? '🎫 General Admission' : '💺 Reserved Seats'}
          </button>
        ))}
      </div>

      {/* Zone button */}
      <button type="button" onClick={onAddZone}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
          border: hasZone ? `2px solid ${sec.color}` : '1px dashed #444',
          background: hasZone ? sec.color + '22' : 'transparent',
          color: hasZone ? '#fff' : '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: sec.color, flexShrink: 0 }} />
        {hasZone ? `✓ Zone set on map` : '+ Draw zone on floor plan'}
      </button>

      {/* Vendor pricing */}
      <div className="border-t border-border pt-3">
        <button type="button" onClick={() => setShowTiers(v => !v)}
          className="flex items-center gap-2 text-[11px] font-bold text-gray-400 hover:text-orange transition-colors w-full">
          <span>🏪</span>
          <span>VENDOR PRICING</span>
          {sec.vendorPrice ? <span className="ml-1 text-[10px] text-orange bg-orange/10 rounded-full px-2">${sec.vendorPrice}</span> : null}
          <span className="ml-auto">{showTiers ? '▲' : '▼'}</span>
        </button>
        {showTiers && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[9px] font-bold text-gray-600 mb-1">VENDOR $</label>
              <div className="relative">
                <span className="absolute left-2 top-2 text-gray-500 text-xs">$</span>
                <input type="number" min={0} value={sec.vendorPrice || ''}
                  onChange={e => onChange({ ...sec, vendorPrice: Number(e.target.value) || undefined })}
                  className="w-full pl-5 pr-2 py-1.5 rounded-lg bg-black/40 border border-border text-white text-xs outline-none focus:border-orange" />
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-gray-600 mb-1">OPEN DATE</label>
              <input type="date" value={sec.vendorOpenDate || ''}
                onChange={e => onChange({ ...sec, vendorOpenDate: e.target.value || undefined })}
                className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-border text-white text-xs outline-none focus:border-orange" />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-gray-600 mb-1">CLOSE DATE</label>
              <input type="date" value={sec.vendorCloseDate || ''}
                onChange={e => onChange({ ...sec, vendorCloseDate: e.target.value || undefined })}
                className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-border text-white text-xs outline-none focus:border-orange" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main form ───────────────────────────────────────────────────────────────

function CreateEventInner() {
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;
  const { user } = useAuth();
  const router = useRouter();

  // Step 1 — Info
  const [title, setTitle]             = useState('');
  const [slug, setSlug]               = useState('');
  const [slugEdited, setSlugEdited]   = useState(false);
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage]   = useState('');
  const [dateStr, setDateStr]         = useState('');
  const [timeStr, setTimeStr]         = useState('20:00');
  const [endDateStr, setEndDateStr]   = useState('');
  const [endTimeStr, setEndTimeStr]   = useState('23:00');
  const [isPrivate, setIsPrivate]     = useState(false);

  // Step 2 — Venue + Sections
  const [venueQuery, setVenueQuery]             = useState('');
  const [venueSuggestions, setVenueSuggestions] = useState<any[]>([]);
  const [venueLoading, setVenueLoading]         = useState(false);
  const [venueSelected, setVenueSelected]       = useState(false);
  const [venue, setVenue]                       = useState('');
  const [venueAddress, setVenueAddress]         = useState('');
  const [city, setCity]                         = useState('');
  const [venuePlaceId, setVenuePlaceId]         = useState('');
  const venueDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sections, setSections] = useState<Section[]>([
    { id: uid6(), name: 'General Admission', price: 20, capacity: 200, color: '#f97316', type: 'ga' },
  ]);

  // Floor plan
  const [floorPlanImage, setFloorPlanImage] = useState<string | null>(null);
  const [mapZones, setMapZones] = useState<{ id: string; sectionId: string; x: number; y: number; w: number; h: number }[]>([]);
  const [draggingZone, setDraggingZone]   = useState<string | null>(null);
  const [resizingZone, setResizingZone]   = useState<string | null>(null);
  const [dragOffset, setDragOffset]       = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  // Step 3 — Payment
  const [paymentMethods, setPaymentMethods] = useState<Record<string, { active: boolean; values: string[] }>>({
    moncash: { active: false, values: [''] },
    natcash: { active: false, values: [''] },
    stripe:  { active: false, values: [] },
    cash:    { active: true,  values: [] },
  });
  const [exchangeRate, setExchangeRate] = useState(130);

  const [tab, setTab] = useState<'info' | 'venue' | 'payment'>('info');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load organizer settings
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'organizers', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (d.exchangeRate)   setExchangeRate(d.exchangeRate);
          if (d.paymentMethods) setPaymentMethods(d.paymentMethods);
        }
      } catch (e) { console.error(e); }
    })();
  }, [user]);

  useEffect(() => {
    if (!slugEdited && title) setSlug(toSlug(title));
  }, [title, slugEdited]);

  const htg = (usd: number) => Math.round(usd * exchangeRate);

  // ── Venue autocomplete ────────────────────────────────────────────
  function handleVenueInput(val: string) {
    setVenueQuery(val);
    setVenueSelected(false);
    setVenue(val);
    if (venueDebounce.current) clearTimeout(venueDebounce.current);
    if (val.length < 2) { setVenueSuggestions([]); return; }
    venueDebounce.current = setTimeout(async () => {
      setVenueLoading(true);
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setVenueSuggestions(data.suggestions || []);
      } catch { setVenueSuggestions([]); }
      finally { setVenueLoading(false); }
    }, 350);
  }

  async function handleVenueSelect(suggestion: any) {
    setVenueQuery(suggestion.name);
    setVenue(suggestion.name);
    setVenueSuggestions([]);
    setVenueSelected(true);
    try {
      const res = await fetch('/api/places/autocomplete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: suggestion.placeId }),
      });
      const detail = await res.json();
      if (detail.name)    setVenue(detail.name);
      if (detail.address) setVenueAddress(detail.address);
      if (detail.city)    setCity(detail.city);
      setVenuePlaceId(suggestion.placeId);
      // Auto-load existing floor plan
      const plan = await getFloorPlan(suggestion.placeId);
      if (plan?.image) setFloorPlanImage(plan.image);
      // Auto-load previous zone layout
      if (user?.uid) {
        const prev = await getOrganizerVenueLayout(user.uid, suggestion.placeId);
        if (prev?.zones?.length) setMapZones(prev.zones);
      }
    } catch { /* keep manual entry */ }
  }

  function addZoneForSection(secId: string) {
    // Remove existing zone for this section first
    setMapZones(z => {
      const filtered = z.filter(zone => zone.sectionId !== secId);
      return [...filtered, {
        id: uid6(), sectionId: secId,
        x: 10 + Math.random() * 30,
        y: 10 + Math.random() * 30,
        w: 25, h: 20,
      }];
    });
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim())    e.title    = 'Obligatwa / Required';
    if (!slug.trim())     e.slug     = 'Obligatwa / Required';
    if (!dateStr)         e.date     = 'Obligatwa / Required';
    if (!venue.trim())    e.venue    = 'Obligatwa / Required';
    if (sections.length === 0) e.sections = 'Ajoute omwen yon seksyon / Add at least one section';
    if (sections.some(s => !s.name.trim())) e.sections = 'Tout seksyon bezwen yon non';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) { setTab('info'); return; }
    if (!user) return;
    setSaving(true);
    try {
      const minPrice = Math.min(...sections.map(s => s.price));
      const maxPrice = Math.max(...sections.map(s => s.price));
      const eventRef = await addDoc(collection(db, 'events'), {
        name:           title.trim(),
        title:          title.trim(),
        slug:           slug.trim(),
        description:    description.trim() || null,
        coverImage:     coverImage.trim() || null,
        startDate:      dateStr,
        startTime:      timeStr,
        endDate:        endDateStr || null,
        endTime:        endTimeStr,
        venue:          venue.trim(),
        venuePlaceId:   venuePlaceId || null,
        city:           city.trim() || null,
        isPrivate,
        privateToken:   isPrivate ? uid6() + uid6() : null,
        sections:       sections.map(s => ({ ...s, sold: 0 })),
        floorPlan:      floorPlanImage ? { image: floorPlanImage, zones: mapZones } : null,
        paymentMethods,
        exchangeRate,
        minPrice,
        maxPrice,
        status:         'published',
        organizerId:    user.uid,
        createdAt:      serverTimestamp(),
        updatedAt:      serverTimestamp(),
      });

      // Save floor plan to public collection (shared by venue)
      if (floorPlanImage && venuePlaceId) {
        await saveFloorPlan(venuePlaceId, {
          venueName:  venue,
          image:      floorPlanImage,
          createdBy:  user.uid,
          isVerified: false,
        });
      }
      // Save organizer's zone layout (private, per event)
      if (mapZones.length > 0 && venuePlaceId) {
        await saveEventLayout(eventRef.id, {
          organizerId: user.uid,
          placeId:     venuePlaceId,
          venueName:   venue,
          zones:       mapZones,
        });
      }
      router.push('/organizer/events');
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const TABS = [
    { id: 'info',    label: L('Enfòmasyon', 'Info',          'Infos'),    num: '1' },
    { id: 'venue',   label: L('Kay + Seksyon', 'Venue + Sections', 'Lieu + Sections'), num: '2' },
    { id: 'payment', label: L('Peman',       'Payment',      'Paiement'), num: '3' },
  ] as const;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
      <h1 className="font-heading text-2xl mb-6">
        {L('Kreye Evènman', 'Create Event', 'Créer un événement')}
      </h1>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
              tab === t.id ? 'bg-orange text-white' : 'text-gray-400 hover:text-white'
            }`}>
            <span className="opacity-50 mr-1">{t.num}</span>{t.label}
            {errors.title && t.id === 'info' && <span className="ml-1 text-red-300">•</span>}
            {errors.venue && t.id === 'venue' && <span className="ml-1 text-red-300">•</span>}
          </button>
        ))}
      </div>

      <div className="space-y-5">

        {/* ══ TAB 1: INFO ══════════════════════════════════════════════════ */}
        {tab === 'info' && (
          <>
            {/* Title */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">
                {L('TIT EVÈNMAN *', 'EVENT TITLE *', 'TITRE *')}
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Festival Soley 2026"
                className={`w-full px-4 py-3 rounded-xl bg-white/[0.05] border text-white text-sm outline-none focus:border-orange ${errors.title ? 'border-red-500' : 'border-border'}`} />
              {errors.title && <p className="text-red-400 text-[10px] mt-1">{errors.title}</p>}
            </div>

            {/* Slug */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">
                URL SLUG *
                <span className="ml-1 font-normal text-gray-600">anbyans.com/e/<span className="text-orange">{slug || '...'}</span></span>
              </label>
              <input value={slug} onChange={e => { setSlugEdited(true); setSlug(toSlug(e.target.value)); }}
                placeholder="festival-soley-2026"
                className={`w-full px-4 py-3 rounded-xl bg-white/[0.05] border text-white text-sm font-mono outline-none focus:border-orange ${errors.slug ? 'border-red-500' : 'border-border'}`} />
            </div>

            {/* Start date + time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('DAT KÒMANSMAN *', 'START DATE *', 'DATE DÉBUT *')}</label>
                <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl bg-white/[0.05] border text-white text-sm outline-none focus:border-orange ${errors.date ? 'border-red-500' : 'border-border'}`} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('LÈ', 'TIME', 'HEURE')}</label>
                <input type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange" />
              </div>
            </div>

            {/* End date + time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('DAT FEN', 'END DATE', 'DATE FIN')}</label>
                <input type="date" value={endDateStr} min={dateStr} onChange={e => setEndDateStr(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange" />
                <p className="text-[10px] text-gray-500 mt-1">{L('Kite vid si menm jou', 'Leave blank if same day', 'Vide si même jour')}</p>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('LÈ FEN', 'END TIME', 'HEURE FIN')}</label>
                <input type="time" value={endTimeStr} onChange={e => setEndTimeStr(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange" />
              </div>
            </div>

            {/* Cover image */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('IMAJ KOUVÈTI (URL)', 'COVER IMAGE (URL)', 'IMAGE (URL)')}</label>
              <input value={coverImage} onChange={e => setCoverImage(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange" />
              {coverImage && (
                <img src={coverImage} alt="preview" className="mt-2 h-28 w-full object-cover rounded-xl opacity-80"
                  onError={e => (e.currentTarget.style.display = 'none')} />
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('DESKRIPSYON', 'DESCRIPTION', 'DESCRIPTION')}</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={3} placeholder={L('Di moun plis enfòmasyon...', 'Tell people more...', 'Plus d\'informations...')}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange resize-none" />
            </div>

            {/* Private toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-border">
              <div>
                <p className="text-sm font-bold">{L('Evènman Prive', 'Private Event', 'Événement Privé')}</p>
                <p className="text-[10px] text-gray-500">{L('Sèlman moun ki gen lyen an', 'Only people with the link', 'Visible uniquement via le lien')}</p>
              </div>
              <button type="button" onClick={() => setIsPrivate(v => !v)}
                className={`w-12 h-6 rounded-full transition-all relative ${isPrivate ? 'bg-orange' : 'bg-white/[0.1]'}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${isPrivate ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>

            <button type="button" onClick={() => setTab('venue')}
              className="w-full py-3 rounded-xl bg-orange text-white font-heading text-sm hover:bg-orange/90 transition-all">
              {L('Kontinye →', 'Continue →', 'Continuer →')}
            </button>
          </>
        )}

        {/* ══ TAB 2: VENUE + SECTIONS ══════════════════════════════════════ */}
        {tab === 'venue' && (
          <>
            {/* ─ Venue search ─ */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('KAY EVÈNMAN *', 'VENUE *', 'LIEU *')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  value={venueQuery}
                  onChange={e => handleVenueInput(e.target.value)}
                  onBlur={() => setTimeout(() => setVenueSuggestions([]), 200)}
                  placeholder="Karibe Convention Center..."
                  autoComplete="off"
                  className={`w-full px-4 py-3 rounded-xl bg-white/[0.05] border text-white text-sm outline-none focus:border-orange ${errors.venue ? 'border-red-500' : 'border-border'}`}
                />
                {venueLoading && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: 11 }}>⏳</span>}
                {venueSelected && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#22c55e', fontSize: 11, fontWeight: 700 }}>✓</span>}
                {venueSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 10, marginTop: 4,
                    overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    {venueSuggestions.map((s, i) => (
                      <button key={s.placeId} type="button" onMouseDown={() => handleVenueSelect(s)}
                        style={{ width: '100%', padding: '10px 14px', textAlign: 'left',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          borderBottom: i < venueSuggestions.length - 1 ? '1px solid #1e1e2e' : 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1e1e2e')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>📍 {s.name}</div>
                        {s.secondary && <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{s.secondary}</div>}
                      </button>
                    ))}
                    <div style={{ padding: '6px 14px', borderTop: '1px solid #1e1e2e' }}>
                      <span style={{ color: '#333', fontSize: 10 }}>Powered by Google</span>
                    </div>
                  </div>
                )}
              </div>
              {venueAddress && venueSelected && (
                <p style={{ color: '#555', fontSize: 11, marginTop: 5 }}>📍 {venueAddress}</p>
              )}
              {errors.venue && <p className="text-red-500 text-[10px] mt-1">{errors.venue}</p>}
            </div>

            {/* ─ Google Map embed (once venue selected) ─ */}
            {venueSelected && venuePlaceId && (
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #1e1e2e' }}>
                <iframe
                  title="venue-map"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyDvBaqAd8MswI7D8kvA_SCdUpYTEtQz-cs&q=place_id:${venuePlaceId}&zoom=15`}
                  style={{ width: '100%', height: 180, border: 'none', display: 'block' }}
                />
              </div>
            )}

            {/* ─ Floor plan upload ─ */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">
                {L('PLAN SAL (Opsyonèl)', 'FLOOR PLAN (Optional)', 'PLAN DE SALLE (Optionnel)')}
              </label>
              {!floorPlanImage ? (
                <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-dashed border-orange/30 cursor-pointer hover:border-orange/60 transition-all">
                  <span style={{ fontSize: 32 }}>🏟️</span>
                  <span className="text-sm text-gray-400">{L('Telechaje foto plan sal la', 'Upload floor plan image', 'Télécharger le plan')}</span>
                  <span className="text-[11px] text-gray-600">JPG, PNG · Anything works</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setFloorPlanImage(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }} />
                </label>
              ) : (
                <div>
                  {/* Map canvas with draggable zones */}
                  <div ref={mapRef}
                    style={{ position: 'relative', display: 'inline-block', width: '100%',
                      userSelect: 'none', borderRadius: 12, overflow: 'hidden', border: '1px solid #1e1e2e' }}
                    onMouseMove={e => {
                      if (!mapRef.current) return;
                      const rect = mapRef.current.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      if (draggingZone) {
                        setMapZones(z => z.map(zone => zone.id === draggingZone
                          ? { ...zone, x: Math.max(0, Math.min(95 - zone.w, x - dragOffset.x)), y: Math.max(0, Math.min(95 - zone.h, y - dragOffset.y)) }
                          : zone));
                      }
                      if (resizingZone) {
                        setMapZones(z => z.map(zone => zone.id === resizingZone
                          ? { ...zone, w: Math.max(5, x - zone.x), h: Math.max(5, y - zone.y) }
                          : zone));
                      }
                    }}
                    onMouseUp={() => { setDraggingZone(null); setResizingZone(null); }}
                    onMouseLeave={() => { setDraggingZone(null); setResizingZone(null); }}>
                    <img src={floorPlanImage} alt="floor plan" style={{ width: '100%', display: 'block', opacity: 0.85 }} />
                    {mapZones.map(zone => {
                      const sec = sections.find(s => s.id === zone.sectionId);
                      if (!sec) return null;
                      return (
                        <div key={zone.id}
                          style={{ position: 'absolute', left: `${zone.x}%`, top: `${zone.y}%`,
                            width: `${zone.w}%`, height: `${zone.h}%`,
                            background: sec.color + '88', border: `2px solid ${sec.color}`,
                            borderRadius: 6, cursor: 'move',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}
                          onMouseDown={e => {
                            e.stopPropagation();
                            if (!mapRef.current) return;
                            const rect = mapRef.current.getBoundingClientRect();
                            const mx = ((e.clientX - rect.left) / rect.width) * 100;
                            const my = ((e.clientY - rect.top) / rect.height) * 100;
                            setDraggingZone(zone.id);
                            setDragOffset({ x: mx - zone.x, y: my - zone.y });
                          }}>
                          <span style={{ color: '#fff', fontSize: 11, fontWeight: 800,
                            textShadow: '0 1px 3px rgba(0,0,0,0.8)', textAlign: 'center', padding: '0 4px' }}>
                            {sec.name}
                          </span>
                          <span style={{ color: '#fff', fontSize: 9, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                            ${sec.price}
                          </span>
                          <div
                            style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12,
                              background: sec.color, borderRadius: 2, cursor: 'se-resize' }}
                            onMouseDown={e => { e.stopPropagation(); setResizingZone(zone.id); }} />
                          <div
                            style={{ position: 'absolute', top: 2, right: 4, color: '#fff',
                              fontSize: 12, cursor: 'pointer', fontWeight: 800, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                            onMouseDown={e => { e.stopPropagation(); setMapZones(z => z.filter(x => x.id !== zone.id)); }}>
                            ×
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button type="button"
                    onClick={() => { setFloorPlanImage(null); setMapZones([]); }}
                    style={{ marginTop: 8, fontSize: 11, color: '#666', background: 'none',
                      border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    {L('Chanje imaj la', 'Replace image', 'Changer l\'image')}
                  </button>
                </div>
              )}
            </div>

            {/* ─ Sections ─ */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-2">
                {L('SEKSYON *', 'SECTIONS *', 'SECTIONS *')}
              </label>

              {errors.sections && (
                <p className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2 mb-3">{errors.sections}</p>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/[0.03] rounded-lg px-3 py-2 mb-3">
                <span>💱</span>
                <span>1 USD = {exchangeRate} HTG</span>
              </div>

              <div className="space-y-4">
                {sections.map((sec, i) => (
                  <SectionRow key={sec.id} sec={sec} index={i}
                    onChange={updated => setSections(s => s.map(x => x.id === sec.id ? updated : x))}
                    onRemove={() => setSections(s => s.filter(x => x.id !== sec.id))}
                    onAddZone={() => {
                      if (!floorPlanImage) {
                        alert(L('Telechaje plan sal la anvan', 'Upload a floor plan first', 'Téléchargez d\'abord le plan'));
                        return;
                      }
                      addZoneForSection(sec.id);
                    }}
                    hasZone={mapZones.some(z => z.sectionId === sec.id)}
                  />
                ))}
              </div>

              <button type="button"
                onClick={() => setSections(s => [...s, {
                  id: uid6(), name: '', price: 0, capacity: 100,
                  color: COLORS[s.length % COLORS.length], type: 'ga',
                }])}
                className="w-full mt-4 py-3 rounded-xl border border-dashed border-orange/40 text-orange text-sm font-bold hover:bg-orange/5 transition-all">
                + {L('Ajoute Seksyon', 'Add Section', 'Ajouter Section')}
              </button>

              {/* Summary */}
              {sections.length > 0 && (
                <div className="bg-white/[0.03] rounded-xl p-4 mt-4">
                  <p className="text-[10px] font-bold text-gray-500 mb-2">{L('REZIME', 'SUMMARY', 'RÉSUMÉ')}</p>
                  <div className="space-y-1.5">
                    {sections.map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="flex-1 text-gray-300">{s.name || '—'}</span>
                        <span className="text-green font-bold">${s.price}</span>
                        <span className="text-red-400">{htg(s.price).toLocaleString('fr-HT')} HTG</span>
                        <span className="text-gray-500">· {s.capacity} plas</span>
                        {mapZones.some(z => z.sectionId === s.id) && (
                          <span style={{ fontSize: 10, color: s.color }}>🗺</span>
                        )}
                      </div>
                    ))}
                    <div className="border-t border-border pt-1.5 flex justify-between text-[10px] text-gray-500">
                      <span>{L('Total', 'Total capacity', 'Capacité totale')}</span>
                      <span>{sections.reduce((a, s) => a + s.capacity, 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setTab('info')}
                className="flex-1 py-3 rounded-xl border border-border text-gray-400 text-sm font-bold hover:text-white transition-all">
                ← {L('Tounen', 'Back', 'Retour')}
              </button>
              <button type="button" onClick={() => setTab('payment')}
                className="flex-1 py-3 rounded-xl bg-orange text-white font-heading text-sm hover:bg-orange/90 transition-all">
                {L('Kontinye →', 'Continue →', 'Continuer →')}
              </button>
            </div>
          </>
        )}

        {/* ══ TAB 3: PAYMENT ══════════════════════════════════════════════ */}
        {tab === 'payment' && (
          <>
            <p className="text-[11px] text-gray-500">
              {L('Metòd peman yo enpòte soti nan Settings.',
                 'Payment methods are inherited from Settings.',
                 'Méthodes héritées des Paramètres.')}
            </p>

            {/* Exchange rate */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">
                💱 {L('TO ECHANJ 1 USD =', 'EXCHANGE RATE 1 USD =', 'TAUX 1 USD =')}
              </label>
              <div className="flex items-center gap-3">
                <input type="number" min={1} value={exchangeRate}
                  onChange={e => setExchangeRate(Number(e.target.value))}
                  className="w-32 px-4 py-3 rounded-xl bg-white/[0.05] border border-border text-white text-sm font-bold outline-none focus:border-orange" />
                <span className="text-sm font-bold text-gray-400">HTG</span>
                <span className="text-xs text-gray-600 ml-auto">$10 = {(10 * exchangeRate).toLocaleString()} HTG</span>
              </div>
            </div>

            <div className="space-y-3">
              {(Object.entries(paymentMethods) as [string, { active: boolean; values: string[] }][]).map(([key, val]) => {
                const LABELS: Record<string, string> = {
                  moncash: '📱 MonCash',
                  natcash: '📱 Natcash',
                  stripe:  '💳 Stripe (Kart / Card)',
                  cash:    '💵 Cash · Zelle · CashApp',
                };
                const needsNumber = key === 'moncash' || key === 'natcash';
                return (
                  <div key={key} className={`rounded-xl border p-4 transition-all ${val.active ? 'border-orange/40 bg-orange/5' : 'border-border bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <button type="button"
                        onClick={() => setPaymentMethods(m => ({ ...m, [key]: { ...m[key], active: !m[key].active } }))}
                        className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${val.active ? 'bg-orange' : 'bg-white/[0.1]'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${val.active ? 'left-5' : 'left-0.5'}`} />
                      </button>
                      <span className="text-sm font-bold">{LABELS[key] || key}</span>
                    </div>
                    {val.active && needsNumber && (
                      <input value={val.values?.[0] || ''}
                        onChange={e => setPaymentMethods(m => ({ ...m, [key]: { ...m[key], values: [e.target.value] } }))}
                        placeholder={`Nimewo ${key === 'moncash' ? 'MonCash' : 'Natcash'}`}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-border text-white text-sm outline-none focus:border-orange" />
                    )}
                    {val.active && key === 'cash' && (
                      <input value={val.values?.join(', ') || ''}
                        onChange={e => setPaymentMethods(m => ({ ...m, [key]: { ...m[key], values: e.target.value.split(',').map(v => v.trim()) } }))}
                        placeholder="Zelle: +1-xxx · CashApp: $handle"
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-border text-white text-sm outline-none focus:border-orange" />
                    )}
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={() => setTab('venue')}
              className="w-full py-3 rounded-xl border border-border text-gray-400 text-sm font-bold hover:text-white transition-all">
              ← {L('Tounen', 'Back', 'Retour')}
            </button>
          </>
        )}
      </div>

      {/* ── Fixed publish bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur border-t border-border px-4 py-3 flex items-center gap-3">
        <div className="flex-1 text-xs text-gray-500">
          {sections.length} {L('seksyon', 'sections', 'sections')} ·{' '}
          {sections.reduce((a, s) => a + s.capacity, 0)} {L('plas', 'seats', 'places')}
          {mapZones.length > 0 && <span className="ml-2 text-orange">· 🗺 {mapZones.length} zones</span>}
        </div>
        <button onClick={save} disabled={saving}
          className="px-6 py-3 rounded-xl bg-orange text-white font-heading text-sm hover:bg-orange/90 disabled:opacity-40 transition-all flex items-center gap-2">
          {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {L('Pibliye Evènman', 'Publish Event', 'Publier')}
        </button>
      </div>
    </div>
  );
}

export default function CreateEventPage() {
  return <Suspense><CreateEventInner /></Suspense>;
}

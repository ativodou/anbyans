'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';

// ─── Types ─────────────────────────────────────────────────────────────────


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

// ─── Helpers ────────────────────────────────────────────────────────────────

function toSlug(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

function uid6() {
  return Math.random().toString(36).substring(2, 8);
}

// ─── Section editor ─────────────────────────────────────────────────────────

function SectionRow({ sec, onChange, onRemove, index }: {
  sec: Section;
  onChange: (s: Section) => void;
  onRemove: () => void;
  index: number;
}) {
  const [showTiers, setShowTiers] = useState(false);


  return (
    <div className="bg-white/[0.03] border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button"
              onClick={() => onChange({ ...sec, color: c })}
              className={`w-5 h-5 rounded-full transition-all ${sec.color === c ? 'ring-2 ring-white scale-110' : ''}`}
              style={{ background: c }} />
          ))}
        </div>
        <button type="button" onClick={onRemove}
          className="ml-auto text-gray-600 hover:text-red-400 text-xs transition-colors">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[10px] font-bold text-gray-500 mb-1">NOM SEKSYON / NAME</label>
          <input value={sec.name}
            onChange={e => onChange({ ...sec, name: e.target.value })}
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
          <label className="block text-[10px] font-bold text-gray-500 mb-1">KAPASITÉ / CAPACITY</label>
          <input type="number" min={1} value={sec.capacity}
            onChange={e => onChange({ ...sec, capacity: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-border text-white text-sm outline-none focus:border-orange" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-500 mb-1.5">TIP SEKSYON / TYPE</label>
        <div className="flex gap-2">
          {(['ga', 'reserved'] as const).map(t => (
            <button key={t} type="button"
              onClick={() => onChange({ ...sec, type: t })}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                sec.type === t ? 'bg-orange text-white' : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]'
              }`}>
              {t === 'ga' ? '🎫 General Admission' : '💺 Reserved Seats'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Vendor window ── */}
      <div className="border-t border-border pt-3">
        <button type="button" onClick={() => setShowTiers(v => !v)}
          className="flex items-center gap-2 text-[11px] font-bold text-gray-400 hover:text-orange transition-colors w-full">
          <span className="text-base">🏪</span>
          <span>PRIX VANDE / VENDOR PRICING</span>
          {sec.vendorPrice ? <span className="ml-1 text-[10px] text-orange bg-orange/10 rounded-full px-2">${sec.vendorPrice}</span> : null}
          <span className="ml-auto">{showTiers ? '▲' : '▼'}</span>
        </button>

        {showTiers && (
          <div className="mt-3 space-y-3">
            <p className="text-[10px] text-gray-600">
              Pri pou vande achte anvan evènman. Fan ap peye pri nòmal la.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-gray-600 mb-1">PRI VANDE / VENDOR $</label>
                <div className="relative">
                  <span className="absolute left-2 top-2 text-gray-500 text-xs">$</span>
                  <input type="number" min={0} value={sec.vendorPrice || ''}
                    onChange={e => onChange({ ...sec, vendorPrice: Number(e.target.value) || undefined })}
                    placeholder="0"
                    className="w-full pl-5 pr-2 py-1.5 rounded-lg bg-black/40 border border-border text-white text-xs font-bold outline-none focus:border-orange" />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-600 mb-1">OUVÈ / OPEN</label>
                <input type="date" value={sec.vendorOpenDate || ''}
                  onChange={e => onChange({ ...sec, vendorOpenDate: e.target.value || undefined })}
                  className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-border text-white text-xs outline-none focus:border-orange" />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-600 mb-1">FÈMEN / CLOSE</label>
                <input type="date" value={sec.vendorCloseDate || ''}
                  onChange={e => onChange({ ...sec, vendorCloseDate: e.target.value || undefined })}
                  className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-border text-white text-xs outline-none focus:border-orange" />
              </div>
            </div>
            {sec.vendorPrice && sec.price && (
              <p className="text-[10px] text-green-500">
                Vande ekonomize ${(sec.price - sec.vendorPrice).toFixed(0)} / tikè ({Math.round((1 - sec.vendorPrice / sec.price) * 100)}% rabè)
              </p>
            )}
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

  // Basic info
  const [title, setTitle]             = useState('');
  const [slug, setSlug]               = useState('');
  const [slugEdited, setSlugEdited]   = useState(false);
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage]   = useState('');

  // Date / location
  const [dateStr, setDateStr]       = useState('');
  const [timeStr, setTimeStr]       = useState('20:00');
  const [endDateStr, setEndDateStr] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('23:00');
  const [venue, setVenue]           = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueLat, setVenueLat]     = useState<number | null>(null);
  const [venueLng, setVenueLng]     = useState<number | null>(null);
  const [venuePlaceId, setVenuePlaceId] = useState('');
  const [city, setCity]             = useState('');
  const [isPrivate, setIsPrivate]   = useState(false);

  // Venue autocomplete
  const [venueQuery, setVenueQuery]         = useState('');
  const [venueSuggestions, setVenueSuggestions] = useState<any[]>([]);
  const [venueLoading, setVenueLoading]     = useState(false);
  const [venueSelected, setVenueSelected]   = useState(false);
  const venueDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sections
  const [sections, setSections] = useState<Section[]>([
    { id: uid6(), name: 'General Admission', price: 20, capacity: 200, color: '#f97316', type: 'ga' },
  ]);

  // Payment — inherit from organizer settings
  const [paymentMethods, setPaymentMethods] = useState<Record<string, { active: boolean; values: string[] }>>({
    moncash: { active: false, values: [''] },
    natcash: { active: false, values: [''] },
    stripe:  { active: false, values: [] },
    cash:    { active: true,  values: [] },
  });
  const [exchangeRate, setExchangeRate] = useState(130);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'info' | 'sections' | 'map' | 'payment'>('info');

  // Floor plan map
  const [floorPlanImage, setFloorPlanImage] = useState<string | null>(null);
  const [mapZones, setMapZones] = useState<{ id: string; sectionId: string; x: number; y: number; w: number; h: number }[]>([]);
  const [draggingZone, setDraggingZone] = useState<string | null>(null);
  const [resizingZone, setResizingZone] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  // Load organizer settings
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'organizers', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (d.exchangeRate)    setExchangeRate(d.exchangeRate);
          if (d.paymentMethods)  setPaymentMethods(d.paymentMethods);
        }
      } catch (e) { console.error(e); }
    })();
  }, [user]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugEdited && title) setSlug(toSlug(title));
  }, [title, slugEdited]);

  const htg = (usd: number) => Math.round(usd * exchangeRate);

  // ── Venue autocomplete ───────────────────────────────────────────
  function handleVenueInput(val: string) {
    setVenueQuery(val);
    setVenueSelected(false);
    setVenue(val); // allow manual entry too
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
    // Fetch full details
    try {
      const res = await fetch('/api/places/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: suggestion.placeId }),
      });
      const detail = await res.json();
      if (detail.name) setVenue(detail.name);
      if (detail.address) setVenueAddress(detail.address);
      if (detail.city) setCity(detail.city);
      if (detail.lat) setVenueLat(detail.lat);
      if (detail.lng) setVenueLng(detail.lng);
      setVenuePlaceId(suggestion.placeId);
    } catch { /* keep manual entry */ }
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim())    e.title   = 'Obligatwa / Required';
    if (!slug.trim())     e.slug    = 'Obligatwa / Required';
    if (!dateStr)         e.date    = 'Obligatwa / Required';
    if (!venue.trim())    e.venue   = 'Obligatwa / Required';
    if (sections.length === 0) e.sections = 'Ajoute omwen yon seksyon / Add at least one section';
    if (sections.some(s => !s.name.trim())) e.sections = 'Tout seksyon bezwen yon non / All sections need a name';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) { setTab('info'); return; }
    if (!user) return;
    setSaving(true);
    try {
      const dateTime = new Date(`${dateStr}T${timeStr}`);
      const minPrice = Math.min(...sections.map(s => s.price));
      const maxPrice = Math.max(...sections.map(s => s.price));

      await addDoc(collection(db, 'events'), {
        title:          title.trim(),
        slug:           slug.trim(),
        description:    description.trim() || null,
        coverImage:     coverImage.trim() || null,
        date:           dateTime,
        startDate:      dateStr,
        startTime:      timeStr,
        endDate:        endDateStr || dateStr,
        endTime:        endTimeStr || '23:00',
        venue:          venue.trim(),
        venueAddress:   venueAddress.trim() || null,
        venueLat:       venueLat || null,
        venueLng:       venueLng || null,
        venuePlaceId:   venuePlaceId || null,
        city:           city.trim() || null,
        isPrivate,
        sections:       sections.map(s => ({ ...s, sold: 0 })),
        floorPlan:      floorPlanImage ? { image: floorPlanImage, zones: mapZones } : null,
        paymentMethods,
        exchangeRate,
        minPrice,
        maxPrice,
        organizerId:    user.uid,
        status:         'upcoming',
        createdAt:      serverTimestamp(),
      });

      router.push('/organizer/events');
    } catch (e) {
      console.error(e);
      alert(L('Erè. Eseye ankò.', 'Error. Please try again.', 'Erreur.'));
    } finally {
      setSaving(false);
    }
  };

  const addSection = () => setSections(s => [...s, {
    id: uid6(), name: '', price: 0, capacity: 100, color: COLORS[s.length % COLORS.length], type: 'ga',
  }]);

  const TABS = [
    { id: 'info',     label: L('Enfòmasyon', 'Info', 'Infos'),       icon: '📋' },
    { id: 'sections', label: L('Seksyon',    'Sections', 'Sections'), icon: '🎫' },
    { id: 'map',      label: L('Kat',        'Map',      'Plan'),     icon: '🗺️' },
    { id: 'payment',  label: L('Peman',      'Payment',  'Paiement'), icon: '💳' },
  ] as const;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm">←</button>
        <h1 className="font-heading text-base flex-1">{L('Kreye Evènman', 'Create Event', 'Créer Événement')}</h1>
        <button onClick={save} disabled={saving}
          className="px-5 py-2 rounded-xl bg-orange text-white text-xs font-bold hover:bg-orange/90 disabled:opacity-40 transition-all flex items-center gap-2">
          {saving && <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
          {L('Pibliye', 'Publish', 'Publier')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-4">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-xs font-bold transition-all border-b-2 ${
              tab === t.id ? 'border-orange text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            {t.icon} {t.label}
            {errors.title && t.id === 'info' && <span className="ml-1 text-red-400">•</span>}
            {errors.sections && t.id === 'sections' && <span className="ml-1 text-red-400">•</span>}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── Tab: Info ── */}
        {tab === 'info' && (
          <>
            {/* Title */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">
                {L('TIT EVÈNMAN *', 'EVENT TITLE *', 'TITRE ÉVÉNEMENT *')}
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
              <input value={slug}
                onChange={e => { setSlugEdited(true); setSlug(toSlug(e.target.value)); }}
                placeholder="festival-soley-2026"
                className={`w-full px-4 py-3 rounded-xl bg-white/[0.05] border text-white text-sm font-mono outline-none focus:border-orange ${errors.slug ? 'border-red-500' : 'border-border'}`} />
              <p className="text-[10px] text-gray-600 mt-1">
                {L('Otomatik — ou ka modifye', 'Auto-generated — you can edit', 'Auto-généré — modifiable')}
              </p>
            </div>

            {/* Start date + time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('DAT KÒMANSMAN *', 'START DATE *', 'DATE DÉBUT *')}</label>
                <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl bg-white/[0.05] border text-white text-sm outline-none focus:border-orange ${errors.date ? 'border-red-500' : 'border-border'}`} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('LÈ KÒMANSMAN', 'START TIME', 'HEURE DÉBUT')}</label>
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
                <p className="text-[10px] text-gray-500 mt-1">{L('Kite vid si menm jou', 'Leave blank if same day', 'Laisser vide si même jour')}</p>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('LÈ FEN', 'END TIME', 'HEURE FIN')}</label>
                <input type="time" value={endTimeStr} onChange={e => setEndTimeStr(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange" />
              </div>
            </div>

            {/* Venue autocomplete + city */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1" style={{ position: 'relative' }}>
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
                  {venueLoading && (
                    <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: 11 }}>
                      ⏳
                    </div>
                  )}
                  {venueSelected && venuePlaceId && (
                    <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#22c55e', fontSize: 11, fontWeight: 700 }}>
                      ✓
                    </div>
                  )}
                </div>
                {/* Dropdown suggestions */}
                {venueSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 10,
                    marginTop: 4, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  }}>
                    {venueSuggestions.map((s, i) => (
                      <button key={s.placeId} type="button"
                        onMouseDown={() => handleVenueSelect(s)}
                        style={{
                          width: '100%', padding: '10px 14px', textAlign: 'left',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          borderBottom: i < venueSuggestions.length - 1 ? '1px solid #1e1e2e' : 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1e1e2e')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>📍 {s.name}</div>
                        {s.secondary && (
                          <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{s.secondary}</div>
                        )}
                      </button>
                    ))}
                    <div style={{ padding: '6px 14px', borderTop: '1px solid #1e1e2e' }}>
                      <span style={{ color: '#333', fontSize: 10 }}>Powered by Google</span>
                    </div>
                  </div>
                )}
                {/* Show address once selected */}
                {venueAddress && venueSelected && (
                  <p style={{ color: '#555', fontSize: 11, marginTop: 5 }}>📍 {venueAddress}</p>
                )}
                {errors.venue && <p className="text-red-500 text-[10px] mt-1">{errors.venue}</p>}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('VIL', 'CITY', 'VILLE')}</label>
                <input value={city} onChange={e => setCity(e.target.value)}
                  placeholder="Miami, FL"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange" />
              </div>
            </div>

            {/* Cover image URL */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('IMAJ KOUVÈTI (URL)', 'COVER IMAGE (URL)', 'IMAGE COUVERTURE (URL)')}</label>
              <input value={coverImage} onChange={e => setCoverImage(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange" />
              {coverImage && (
                <img src={coverImage} alt="preview" className="mt-2 h-28 w-full object-cover rounded-xl opacity-80" onError={e => (e.currentTarget.style.display = 'none')} />
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">{L('DESKRIPSYON', 'DESCRIPTION', 'DESCRIPTION')}</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={3} placeholder={L('Di moun plis enfòmasyon...', 'Tell people more about this event...', 'Donnez plus d\'informations...')}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-border text-white text-sm outline-none focus:border-orange resize-none" />
            </div>

            {/* Private toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-border">
              <div>
                <p className="text-sm font-bold">{L('Evènman Prive', 'Private Event', 'Événement Privé')}</p>
                <p className="text-[10px] text-gray-500">{L('Sèlman moun ki gen lyen an ka wè l', 'Only people with the link can see it', 'Visible uniquement via le lien')}</p>
              </div>
              <button type="button" onClick={() => setIsPrivate(v => !v)}
                className={`w-12 h-6 rounded-full transition-all relative ${isPrivate ? 'bg-orange' : 'bg-white/[0.1]'}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${isPrivate ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>
          </>
        )}

        {/* ── Tab: Sections ── */}
        {tab === 'sections' && (
          <>
            {errors.sections && (
              <p className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2">{errors.sections}</p>
            )}

            {/* Exchange rate preview */}
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/[0.03] rounded-lg px-3 py-2">
              <span>💱</span>
              <span>1 USD = {exchangeRate} HTG</span>
              <span className="ml-auto text-gray-600">{L('Chanje nan Settings', 'Change in Settings', 'Modifier dans Paramètres')}</span>
            </div>

            <div className="space-y-4">
              {sections.map((sec, i) => (
                <SectionRow key={sec.id} sec={sec} index={i}
                  onChange={updated => setSections(s => s.map(x => x.id === sec.id ? updated : x))}
                  onRemove={() => setSections(s => s.filter(x => x.id !== sec.id))} />
              ))}
            </div>

            <button type="button" onClick={addSection}
              className="w-full py-3 rounded-xl border border-dashed border-orange/40 text-orange text-sm font-bold hover:bg-orange/5 transition-all">
              + {L('Ajoute Seksyon', 'Add Section', 'Ajouter Section')}
            </button>

            {/* Summary */}
            {sections.length > 0 && (
              <div className="bg-white/[0.03] rounded-xl p-4">
                <p className="text-[10px] font-bold text-gray-500 mb-2">{L('REZIME', 'SUMMARY', 'RÉSUMÉ')}</p>
                <div className="space-y-1.5">
                  {sections.map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="flex-1 text-gray-300">{s.name || '—'}</span>
                      <span className="text-green font-bold">${s.price}</span>
                      <span className="text-red-400">{htg(s.price).toLocaleString('fr-HT')} HTG</span>
                      <span className="text-gray-500">· {s.capacity} plas</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-1.5 flex justify-between text-[10px] text-gray-500">
                    <span>{L('Kapasite total', 'Total capacity', 'Capacité totale')}</span>
                    <span>{sections.reduce((a, s) => a + s.capacity, 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Tab: Map ── */}
        {tab === 'map' && (
          <>
            <p className="text-[11px] text-gray-500">
              {L(
                'Telechaje yon foto plan sal la, epi deplase bwat kolore yo sou chak seksyon.',
                'Upload a floor plan photo, then drag colored boxes over each section.',
                'Téléchargez un plan de salle, puis faites glisser les zones colorées.'
              )}
            </p>

            {/* Upload floor plan */}
            {!floorPlanImage ? (
              <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-orange/30 cursor-pointer hover:border-orange/60 transition-all">
                <span style={{ fontSize: 40 }}>🏟️</span>
                <span className="text-sm font-bold text-gray-300">
                  {L('Telechaje Plan Sal la', 'Upload Floor Plan', 'Télécharger le Plan')}
                </span>
                <span className="text-[11px] text-gray-600">JPG, PNG · Photo, sketch, anything works</span>
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
                {/* Map canvas */}
                <div
                  ref={mapRef}
                  style={{ position: 'relative', display: 'inline-block', width: '100%', userSelect: 'none', borderRadius: 12, overflow: 'hidden', border: '1px solid #1e1e2e' }}
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
                  onMouseLeave={() => { setDraggingZone(null); setResizingZone(null); }}
                >
                  <img src={floorPlanImage} alt="floor plan" style={{ width: '100%', display: 'block', opacity: 0.85 }} />

                  {/* Render zones */}
                  {mapZones.map(zone => {
                    const sec = sections.find(s => s.id === zone.sectionId);
                    if (!sec) return null;
                    return (
                      <div key={zone.id}
                        style={{
                          position: 'absolute',
                          left: `${zone.x}%`, top: `${zone.y}%`,
                          width: `${zone.w}%`, height: `${zone.h}%`,
                          background: sec.color + '88',
                          border: `2px solid ${sec.color}`,
                          borderRadius: 6,
                          cursor: 'move',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'column',
                        }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          if (!mapRef.current) return;
                          const rect = mapRef.current.getBoundingClientRect();
                          const mx = ((e.clientX - rect.left) / rect.width) * 100;
                          const my = ((e.clientY - rect.top) / rect.height) * 100;
                          setDraggingZone(zone.id);
                          setDragOffset({ x: mx - zone.x, y: my - zone.y });
                        }}
                      >
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, textShadow: '0 1px 3px rgba(0,0,0,0.8)', textAlign: 'center', padding: '0 4px' }}>
                          {sec.name}
                        </span>
                        <span style={{ color: '#fff', fontSize: 9, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                          ${sec.price}
                        </span>
                        {/* Resize handle */}
                        <div
                          style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, background: sec.color, borderRadius: 2, cursor: 'se-resize' }}
                          onMouseDown={e => { e.stopPropagation(); setResizingZone(zone.id); }}
                        />
                        {/* Delete */}
                        <div
                          style={{ position: 'absolute', top: 2, right: 4, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 800, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                          onMouseDown={e => { e.stopPropagation(); setMapZones(z => z.filter(x => x.id !== zone.id)); }}
                        >×</div>
                      </div>
                    );
                  })}
                </div>

                {/* Add zone buttons — one per section */}
                <div style={{ marginTop: 12 }}>
                  <p style={{ color: '#666', fontSize: 11, marginBottom: 8 }}>
                    {L('Klike pou ajoute yon seksyon sou plan an:', 'Click to add a section zone to the map:', 'Cliquer pour ajouter une zone:')}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {sections.filter(s => s.name).map(sec => (
                      <button key={sec.id} type="button"
                        onClick={() => setMapZones(z => [...z, {
                          id: uid6(), sectionId: sec.id,
                          x: 10 + Math.random() * 30,
                          y: 10 + Math.random() * 30,
                          w: 25, h: 20,
                        }])}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `2px solid ${sec.color}`, background: sec.color + '22', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: sec.color }} />
                        + {sec.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Replace image */}
                <button type="button"
                  onClick={() => { setFloorPlanImage(null); setMapZones([]); }}
                  style={{ marginTop: 12, fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  {L('Chanje imaj la', 'Replace image', 'Changer l\'image')}
                </button>
              </div>
            )}

            {sections.length === 0 && (
              <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 8 }}>
                ⚠️ {L('Ajoute seksyon yo anvan ou ka kat la.', 'Add your sections first before mapping.', 'Ajoutez d\'abord vos sections.')}
              </p>
            )}
          </>
        )}

        {/* ── Tab: Payment ── */}
        {tab === 'payment' && (
          <>
            <p className="text-[11px] text-gray-500">
              {L(
                'Metòd peman yo enpòte soti nan Settings. Ou ka modifye yo isit pou evènman sa a sèlman.',
                'Payment methods are inherited from Settings. You can override them for this event only.',
                'Méthodes héritées des Paramètres. Vous pouvez les modifier pour cet événement uniquement.'
              )}
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
                      <input
                        value={val.values?.[0] || ''}
                        onChange={e => setPaymentMethods(m => ({ ...m, [key]: { ...m[key], values: [e.target.value] } }))}
                        placeholder={`Nimewo ${key === 'moncash' ? 'MonCash' : 'Natcash'}`}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-border text-white text-sm outline-none focus:border-orange" />
                    )}
                    {val.active && key === 'cash' && (
                      <input
                        value={val.values?.join(', ') || ''}
                        onChange={e => setPaymentMethods(m => ({ ...m, [key]: { ...m[key], values: e.target.value.split(',').map(v => v.trim()) } }))}
                        placeholder="Zelle: +1-xxx · CashApp: $handle"
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-border text-white text-sm outline-none focus:border-orange" />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Bottom publish bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur border-t border-border px-4 py-3 flex items-center gap-3">
        <div className="flex-1 text-xs text-gray-500">
          {sections.length} {L('seksyon', 'sections', 'sections')} ·{' '}
          {sections.reduce((a, s) => a + s.capacity, 0)} {L('plas', 'seats', 'places')}
        </div>
        <button onClick={save} disabled={saving}
          className="px-6 py-3 rounded-xl bg-orange text-white font-heading text-sm hover:bg-orange/90 disabled:opacity-40 transition-all flex items-center gap-2">
          {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {L('Pibliye Evènman', 'Publish Event', 'Publier l\'Événement')}
        </button>
      </div>
    </div>
  );
}

export default function CreateEventPage() {
  return <Suspense><CreateEventInner /></Suspense>;
}

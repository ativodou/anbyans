'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { createEvent, KNOWN_VENUES, type EventSection, type EventRestriction, type EventPromo, type EventVenue } from '@/lib/db';

export default function CreateEvent() {
  const router = useRouter();
  const { locale } = useT();
  const { user } = useAuth();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale]);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState('');

  // Step 1: Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('ht');
  const [ageRestriction, setAgeRestriction] = useState('all');
  const [showRestrictions, setShowRestrictions] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [privateMode, setPrivateMode] = useState<'rsvp' | 'kotizasyon' | 'paid'>('rsvp');
  const [suggestedAmount, setSuggestedAmount] = useState(0);
  const [refundPolicy, setRefundPolicy] = useState<'no_refund' | 'timed' | 'organizer_approval'>('organizer_approval');
  const [refundDeadlineDays, setRefundDeadlineDays] = useState(7);
  const privateTokenRef = useRef('');
  const [restrictions, setRestrictions] = useState<EventRestriction>({
    dressCode: '', foodDrink: '', cameras: '', bags: '', security: '', accessibility: '', health: '',
  });

  // Step 2: Date & Venue
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venueMode, setVenueMode] = useState<'known' | 'custom'>('known');
  const [selectedVenueIdx, setSelectedVenueIdx] = useState(-1);
  const [venueSearch, setVenueSearch] = useState('');
  const [customVenue, setCustomVenue] = useState<EventVenue>({
    name: '', address: '', city: '', country: 'Haiti', gps: { lat: 0, lng: 0 }, capacity: 0,
  });

  // Step 3: Sections
  const [sections, setSections] = useState<EventSection[]>([
    { name: 'VVIP', capacity: 50, price: 150, sold: 0, color: '#FFD700' },
    { name: 'VIP', capacity: 200, price: 75, sold: 0, color: '#C0C0C0' },
    { name: 'General', capacity: 500, price: 35, sold: 0, color: '#06b6d4' },
  ]);

  // Step 4: Promos
  const [promos, setPromos] = useState<EventPromo[]>([]);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState(10);
  const [newPromoType, setNewPromoType] = useState<'percent' | 'fixed'>('percent');
  const [newPromoMax, setNewPromoMax] = useState(100);

  // Step 5: Image
  const [imageUrl, setImageUrl] = useState('');

  const filteredVenues = KNOWN_VENUES.filter(v =>
    v.name.toLowerCase().includes(venueSearch.toLowerCase()) ||
    v.city.toLowerCase().includes(venueSearch.toLowerCase()) ||
    v.country.toLowerCase().includes(venueSearch.toLowerCase())
  );

  const venue = venueMode === 'known' && selectedVenueIdx >= 0 ? KNOWN_VENUES[selectedVenueIdx] : customVenue;

  const inputStyle: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 14, boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { color: '#888', fontSize: 12, marginBottom: 6, display: 'block', fontWeight: 600 };
  const cardStyle: React.CSSProperties = { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 24, marginBottom: 16 };

  function updateSection(idx: number, field: keyof EventSection, value: any) {
    const updated = [...sections];
    (updated[idx] as any)[field] = value;
    setSections(updated);
  }
  function addSection() {
    setSections([...sections, { name: '', capacity: 100, price: 25, sold: 0, color: '#888888' }]);
  }
  function removeSection(idx: number) {
    setSections(sections.filter((_, i) => i !== idx));
  }

  function addPromo() {
    if (!newPromoCode) return;
    setPromos([...promos, { code: newPromoCode.toUpperCase(), discount: newPromoDiscount, type: newPromoType, maxUses: newPromoMax, used: 0 }]);
    setNewPromoCode(''); setNewPromoDiscount(10); setNewPromoMax(100);
  }
  function removePromo(idx: number) {
    setPromos(promos.filter((_, i) => i !== idx));
  }

  async function handleSave(status: 'draft' | 'published') {
    if (!user) { setError(L('Ou dwe konekte', 'You must be logged in', 'Vous devez etre connecte')!); return; }
    setError(''); setSaving(true);
    try {
      const privateToken = isPrivate
        ? Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
        : undefined;
      if (privateToken) privateTokenRef.current = privateToken;

      const eventId = await createEvent({
        name, description, category, language, ageRestriction,
        startDate, endDate, startTime, endTime,
        venue,
        sections,
        restrictions,
        promos,
        imageUrl,
        isPrivate,
        privateToken,
        status,
        organizerId: user.uid,
        organizerName: user.email || '',
        ...(isPrivate && { privateMode, suggestedAmount: privateMode === 'kotizasyon' ? suggestedAmount : 0 }),
        refundPolicy,
        ...(refundPolicy === 'timed' && { refundDeadlineDays }),
        totalCapacity: sections.reduce((sum, s) => sum + s.capacity, 0),
      });
      setCreatedId(eventId);
      setStep(7);
    } catch (err: any) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  function canProceed() {
    switch (step) {
      case 1: return name.trim() && category;
      case 2: return startDate && startTime && (venueMode === 'known' ? selectedVenueIdx >= 0 : customVenue.name);
      case 3: return isPrivate && privateMode !== 'paid' ? true : sections.length > 0 && sections.every(s => s.name && s.capacity > 0 && s.price >= 0);
      case 4: return true;
      case 5: return true;
      case 6: return true;
      default: return false;
    }
  }

  const steps = [
    L('Enfomasyon', 'Information', 'Information'),
    L('Dat & Kote', 'Date & Venue', 'Date & Lieu'),
    L('Seksyon', 'Sections', 'Sections'),
    L('Tike & Pri', 'Tickets & Pricing', 'Billets & Prix'),
    L('Imaj', 'Image', 'Image'),
    L('Revize', 'Review', 'Revue'),
  ];

  if (step === 7) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>&#x1F389;</div>
          <h1 style={{ color: '#fff', fontSize: 28, marginBottom: 8 }}>
            {L('Evenman Kreye!', 'Event Created!', 'Evenement Cree!')}
          </h1>
          <p style={{ color: '#aaa', marginBottom: 8 }}>{name}</p>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>ID: {createdId}</p>

          {isPrivate && (
            <div style={{ background: '#1a0a00', border: '1px solid #f97316', borderRadius: 12, padding: 16, marginBottom: 32, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                <span style={{ color: '#f97316', fontWeight: 700, fontSize: 13 }}>{L('Lyen Prive', 'Private Link', 'Lien Privé')}</span>
              </div>
              <div style={{ background: '#0a0a0f', borderRadius: 8, padding: '10px 12px', marginBottom: 12, wordBreak: 'break-all' }}>
                <span style={{ color: '#ccc', fontSize: 12, fontFamily: 'monospace' }}>
                  {`${typeof window !== 'undefined' ? window.location.origin : 'https://anbyans.events'}/e/${privateTokenRef.current}`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  const url = `${window.location.origin}/e/${privateTokenRef.current}`;
                  navigator.clipboard.writeText(url);
                }}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #f97316', background: 'transparent', color: '#f97316', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  📋 {L('Kopye', 'Copy', 'Copier')}
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent(L('Ou envite nan', 'You are invited to', 'Vous êtes invité à') + ' ' + name + '. ' + L('Achte tikè ou la', 'Get your ticket here', 'Obtenez votre billet ici') + ': ' + (typeof window !== 'undefined' ? window.location.origin : 'https://anbyans.events') + '/e/' + privateTokenRef.current)}`}
                  target="_blank" rel="noreferrer"
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: '#25D366', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  💬 WhatsApp
                </a>
              </div>
            </div>
          )}
          {!isPrivate && <div style={{ marginBottom: 32 }} />}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/organizer/dashboard" style={{ padding: '14px 28px', background: '#f97316', color: '#000', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>
              {L('Dachbod', 'Dashboard', 'Tableau de bord')}
            </Link>
            <button onClick={() => { setStep(1); setName(''); setDescription(''); setCategory(''); setCreatedId(''); }}
              style={{ padding: '14px 28px', border: '1px solid #f97316', color: '#f97316', borderRadius: 8, fontWeight: 700, background: 'transparent', cursor: 'pointer' }}>
              {L('Kreye yon lot', 'Create Another', 'Creer un autre')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '20px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Link href="/organizer/dashboard" style={{ color: '#f97316', textDecoration: 'none', fontSize: 14 }}>
            &larr; {L('Dachbod', 'Dashboard', 'Tableau de bord')}
          </Link>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>
            {L('Kreye Evenman', 'Create Event', 'Creer Evenement')}
          </h1>
          <div style={{ width: 80 }} />
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 4, borderRadius: 2, marginBottom: 6,
                background: i + 1 <= step ? '#f97316' : '#1e1e2e',
                transition: 'background .3s',
              }} />
              <span style={{ fontSize: 10, color: i + 1 === step ? '#f97316' : '#555' }}>{i + 1}. {s}</span>
            </div>
          ))}
        </div>

        {error && <div style={{ background: '#2a1515', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>{error}</div>}

        {/* STEP 1: INFO */}
        {step === 1 && (
          <div style={cardStyle}>
            <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 20 }}>
              {L('Enfomasyon Evenman', 'Event Information', 'Information Evenement')}
            </h2>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{L('Non Evenman *', 'Event Name *', "Nom de l'evenement *")}</label>
              <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle}
                placeholder={L('Ekz: Kompa Fest 2025', 'Ex: Kompa Fest 2025', 'Ex: Kompa Fest 2025')!} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{L('Kategori *', 'Category *', 'Categorie *')}</label>
              <select value={category} onChange={e => setCategory(e.target.value)} required style={inputStyle}>
                <option value="">{L('Chwazi...', 'Select...', 'Choisir...')}</option>
                <option value="kompa">{L('Kompa / Mizik', 'Kompa / Music', 'Kompa / Musique')}</option>
                <option value="rara">{L('Rara / Kanaval', 'Rara / Carnival', 'Rara / Carnaval')}</option>
                <option value="rasin">{L('Mizik Rasin', 'Roots Music', 'Musique Racines')}</option>
                <option value="jazz">{L('Jazz / Bossa', 'Jazz / Bossa', 'Jazz / Bossa')}</option>
                <option value="dj">{L('DJ / Fete', 'DJ / Party', 'DJ / Fete')}</option>
                <option value="gala">{L('Gala / Dine', 'Gala / Dinner', 'Gala / Diner')}</option>
                <option value="conference">{L('Konferans', 'Conference', 'Conference')}</option>
                <option value="sports">{L('Espo', 'Sports', 'Sports')}</option>
                <option value="theater">{L('Teyat / Dans', 'Theater / Dance', 'Theatre / Danse')}</option>
                <option value="festival">{L('Festival', 'Festival', 'Festival')}</option>
                <option value="religious">{L('Relijye', 'Religious', 'Religieux')}</option>
                <option value="other">{L('Lot', 'Other', 'Autre')}</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{L('Deskripsyon', 'Description', 'Description')}</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder={L('Dekri evenman ou a...', 'Describe your event...', 'Decrivez votre evenement...')!} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>{L('Lang', 'Language', 'Langue')}</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} style={inputStyle}>
                  <option value="ht">Kreyol</option>
                  <option value="en">English</option>
                  <option value="fr">Francais</option>
                  <option value="es">Espanol</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{L('Laj', 'Age', 'Age')}</label>
                <select value={ageRestriction} onChange={e => setAgeRestriction(e.target.value)} style={inputStyle}>
                  <option value="all">{L('Tout Laj', 'All Ages', 'Tous ages')}</option>
                  <option value="18+">18+</option>
                  <option value="21+">21+</option>
                  <option value="family">{L('Fanmi', 'Family', 'Famille')}</option>
                </select>
              </div>
            </div>

            {/* Private event toggle */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                border: `1px solid ${isPrivate ? '#f97316' : '#1e1e2e'}`,
                borderRadius: 10, cursor: 'pointer', background: isPrivate ? '#1a0a00' : 'transparent',
                transition: 'all .2s',
              }}>
                <div onClick={() => setIsPrivate(!isPrivate)} style={{
                  width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                  background: isPrivate ? '#f97316' : '#333', position: 'relative',
                  transition: 'background .2s', cursor: 'pointer',
                }}>
                  <div style={{
                    position: 'absolute', top: 3, left: isPrivate ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'left .2s',
                  }} />
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                    🔒 {L('Evenman Prive', 'Private Event', 'Événement Privé')}
                  </div>
                  <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                    {L(
                      'Sèlman moun ki gen lyen prive a ka wè evenman an',
                      'Only people with the private link can see this event',
                      'Seuls les gens avec le lien privé peuvent voir cet événement',
                    )}
                  </div>
                </div>
              </label>
            </div>

            {/* Restrictions toggle */}
            <button type="button" onClick={() => setShowRestrictions(!showRestrictions)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid #1e1e2e', background: showRestrictions ? '#1a1a2a' : 'transparent',
                color: '#888', fontSize: 13, cursor: 'pointer', textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
              <span>{L('Restriksyon (opsyonel)', 'Restrictions (optional)', 'Restrictions (optionnel)')}</span>
              <span style={{ fontSize: 18, transition: 'transform .2s', transform: showRestrictions ? 'rotate(180deg)' : 'none' }}>&#x25BE;</span>
            </button>
            {showRestrictions && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, padding: 16, border: '1px solid #1e1e2e', borderRadius: 8 }}>
                {[
                  { key: 'dressCode', label: L('Kod Rad', 'Dress Code', 'Code vestimentaire') },
                  { key: 'foodDrink', label: L('Manje/Bwason', 'Food/Drink', 'Nourriture/Boissons') },
                  { key: 'cameras', label: L('Kamera', 'Cameras', 'Cameras') },
                  { key: 'bags', label: L('Sak', 'Bags', 'Sacs') },
                  { key: 'security', label: L('Sekirite', 'Security', 'Securite') },
                  { key: 'accessibility', label: L('Aksesibilite', 'Accessibility', 'Accessibilite') },
                ].map(r => (
                  <div key={r.key}>
                    <label style={{ ...labelStyle, fontSize: 11 }}>{r.label}</label>
                    <input value={(restrictions as any)[r.key]}
                      onChange={e => setRestrictions({ ...restrictions, [r.key]: e.target.value })}
                      style={{ ...inputStyle, fontSize: 12, padding: 8 }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: DATE & VENUE */}
        {step === 2 && (
          <div style={cardStyle}>
            <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 20 }}>
              {L('Dat & Kote', 'Date & Venue', 'Date & Lieu')}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>{L('Dat Komansman *', 'Start Date *', 'Date de debut *')}</label>
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{L('Dat Fen', 'End Date', 'Date de fin')}</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>{L('Le Komansman *', 'Start Time *', 'Heure de debut *')}</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{L('Le Fen', 'End Time', 'Heure de fin')}</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #1e1e2e', paddingTop: 20 }}>
              <label style={labelStyle}>{L('Kote Evenman *', 'Event Venue *', 'Lieu *')}</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {(['known', 'custom'] as const).map(m => (
                  <button key={m} onClick={() => setVenueMode(m)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #1e1e2e', cursor: 'pointer',
                      background: venueMode === m ? '#f97316' : 'transparent',
                      color: venueMode === m ? '#000' : '#888', fontWeight: 600, fontSize: 13,
                    }}>
                    {m === 'known' ? L('Sal Nou Konnen', 'Known Venue', 'Lieu connu') : L('Nouvo Kote', 'Custom Venue', 'Lieu personnalise')}
                  </button>
                ))}
              </div>

              {venueMode === 'known' && (
                <>
                  <input
                    value={venueSearch}
                    onChange={e => setVenueSearch(e.target.value)}
                    placeholder={L('Chache sal... (ekz: Karibe, Miami, Brooklyn)', 'Search venues... (e.g. Karibe, Miami, Brooklyn)', 'Chercher lieu... (ex: Karibe, Miami, Brooklyn)')!}
                    style={{ ...inputStyle, marginBottom: 8, fontSize: 13 }}
                  />
                  <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #1e1e2e', borderRadius: 8 }}>
                    {filteredVenues.length === 0 && (
                      <div style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: 13 }}>
                        {L('Pa jwenn rezilta. Eseye "Custom Venue".', 'No results. Try "Custom Venue".', 'Aucun resultat. Essayez "Lieu personnalise".')}
                      </div>
                    )}
                    {filteredVenues.map((v, i) => {
                      const realIdx = KNOWN_VENUES.indexOf(v);
                      return (
                        <div key={realIdx} onClick={() => setSelectedVenueIdx(realIdx)}
                          style={{
                            padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #0a0a0f',
                            background: selectedVenueIdx === realIdx ? '#1a0a00' : 'transparent',
                            borderLeft: selectedVenueIdx === realIdx ? '3px solid #f97316' : '3px solid transparent',
                          }}>
                          <div style={{ color: selectedVenueIdx === realIdx ? '#f97316' : '#fff', fontSize: 14, fontWeight: 600 }}>{v.name}</div>
                          <div style={{ color: '#666', fontSize: 12 }}>{v.address} &bull; {v.city}, {v.country} &bull; {L('Kapasite', 'Capacity', 'Capacite')}: {v.capacity.toLocaleString()}</div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedVenueIdx >= 0 && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#0a0a0f', borderRadius: 8, borderLeft: '3px solid #f97316' }}>
                      <span style={{ color: '#f97316', fontSize: 13, fontWeight: 600 }}>&#x2713; {KNOWN_VENUES[selectedVenueIdx].name}</span>
                    </div>
                  )}
                </>
              )}

              {venueMode === 'custom' && (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>{L('Non Kote *', 'Venue Name *', 'Nom du lieu *')}</label>
                    <input value={customVenue.name} onChange={e => setCustomVenue({ ...customVenue, name: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>{L('Adres', 'Address', 'Adresse')}</label>
                    <input value={customVenue.address} onChange={e => setCustomVenue({ ...customVenue, address: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>{L('Vil', 'City', 'Ville')}</label>
                      <input value={customVenue.city} onChange={e => setCustomVenue({ ...customVenue, city: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>{L('Peyi', 'Country', 'Pays')}</label>
                      <select value={customVenue.country} onChange={e => setCustomVenue({ ...customVenue, country: e.target.value })} style={inputStyle}>
                        <option value="Haiti">Haiti</option><option value="USA">USA</option>
                        <option value="Canada">Canada</option><option value="France">France</option>
                        <option value="Rep. Dominiken">Rep. Dominiken</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>{L('Kapasite', 'Capacity', 'Capacite')}</label>
                      <input type="number" value={customVenue.capacity || ''} onChange={e => setCustomVenue({ ...customVenue, capacity: parseInt(e.target.value) || 0 })} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Latitude</label>
                      <input type="number" step="any" value={customVenue.gps.lat || ''} onChange={e => setCustomVenue({ ...customVenue, gps: { ...customVenue.gps, lat: parseFloat(e.target.value) || 0 } })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Longitude</label>
                      <input type="number" step="any" value={customVenue.gps.lng || ''} onChange={e => setCustomVenue({ ...customVenue, gps: { ...customVenue.gps, lng: parseFloat(e.target.value) || 0 } })} style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: SECTIONS */}
        {step === 3 && (
          <div style={cardStyle}>
            <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 20 }}>
              {isPrivate ? L('Tip Evènman Privé', 'Private Event Type', 'Type Privé') : L('Seksyon & Plas', 'Sections & Seating', 'Sections & Places')}
            </h2>

            {/* Private mode selector */}
            {isPrivate && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ color: '#888', fontSize: 13, marginBottom: 14 }}>
                  {L('Ki jan ou vle jere evènman privé sa?', 'How do you want to manage this private event?', 'Comment gérer cet événement privé?')}
                </p>
                {([
                  { key: 'rsvp', icon: '✋', title: 'RSVP Gratis', sub: L('Konfime prezans sèlman, pa gen pèman.', 'Confirm attendance only, no payment.', 'Confirmer présence, pas de paiement.') },
                  { key: 'kotizasyon', icon: '🤝', title: L('Kotizasyon', 'Contribution', 'Cotisation'), sub: L('Moun bay sa yo vle (montant sujere opsyonèl).', 'People give what they want (optional suggested amount).', "Chacun donne ce qu'il veut.") },
                  { key: 'paid', icon: '🎫', title: L('Tikè Peye', 'Paid Tickets', 'Billets Payants'), sub: L('Tankou evènman piblik — seksyon ak pri.', 'Like public events — sections with prices.', 'Comme événements publics.') },
                ] as { key: 'rsvp' | 'kotizasyon' | 'paid'; icon: string; title: string; sub: string }[]).map(opt => (
                  <div key={opt.key} onClick={() => setPrivateMode(opt.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    border: `1px solid ${privateMode === opt.key ? '#f97316' : '#1e1e2e'}`,
                    borderRadius: 10, cursor: 'pointer', marginBottom: 10,
                    background: privateMode === opt.key ? '#1a0a00' : 'transparent',
                  }}>
                    <div style={{ fontSize: 24, flexShrink: 0 }}>{opt.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: privateMode === opt.key ? '#f97316' : '#fff' }}>{opt.title}</div>
                      <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{opt.sub}</div>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${privateMode === opt.key ? '#f97316' : '#333'}`, background: privateMode === opt.key ? '#f97316' : 'transparent', flexShrink: 0 }} />
                  </div>
                ))}

                {privateMode === 'kotizasyon' && (
                  <div style={{ marginTop: 16, padding: 16, border: '1px solid #1e1e2e', borderRadius: 10 }}>
                    <label style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
                      {L('Montant Sujere ($) — Opsyonèl', 'Suggested Amount ($) — Optional', 'Montant Suggéré ($) — Optionnel')}
                    </label>
                    <input
                      type="number" min="0" value={suggestedAmount || ''}
                      onChange={e => setSuggestedAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      style={{ width: 140, padding: 10, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 16, fontWeight: 700 }}
                    />
                    <p style={{ color: '#555', fontSize: 11, marginTop: 8 }}>
                      {L('Kite 0 pou gratis konplètman.', 'Leave 0 for completely free.', 'Laisser 0 pour gratuit.')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Show sections only for paid or public events */}
            {(!isPrivate || privateMode === 'paid') && (
              <>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
              {L('Defini seksyon yo ak pri.', 'Define sections and pricing.', 'Definissez les sections et les prix.')}
            </p>

            {sections.map((s, i) => (
              <div key={i} style={{ border: '1px solid #1e1e2e', borderRadius: 8, padding: 16, marginBottom: 12, borderLeft: `4px solid ${s.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{L('Seksyon', 'Section', 'Section')} {i + 1}</span>
                  {sections.length > 1 && (
                    <button onClick={() => removeSection(i)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
                      {L('Retire', 'Remove', 'Supprimer')}
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 60px', gap: 10 }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 11 }}>{L('Non', 'Name', 'Nom')}</label>
                    <input value={s.name} onChange={e => updateSection(i, 'name', e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: 8 }}
                      placeholder="VVIP, VIP, General..." />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 11 }}>{L('Kapasite', 'Capacity', 'Capacite')}</label>
                    <input type="number" value={s.capacity} onChange={e => updateSection(i, 'capacity', parseInt(e.target.value) || 0)}
                      style={{ ...inputStyle, fontSize: 13, padding: 8 }} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 11 }}>{L('Pri ($)', 'Price ($)', 'Prix ($)')}</label>
                    <input type="number" value={s.price} onChange={e => updateSection(i, 'price', parseFloat(e.target.value) || 0)}
                      style={{ ...inputStyle, fontSize: 13, padding: 8 }} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 11 }}>{L('Koule', 'Color', 'Couleur')}</label>
                    <input type="color" value={s.color} onChange={e => updateSection(i, 'color', e.target.value)}
                      style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid #1e1e2e', background: 'transparent', cursor: 'pointer' }} />
                  </div>
                </div>
              </div>
            ))}

            <button onClick={addSection}
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px dashed #333', background: 'transparent', color: '#f97316', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              + {L('Ajoute Seksyon', 'Add Section', 'Ajouter Section')}
            </button>

            <div style={{ marginTop: 16, padding: 12, background: '#0a0a0f', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: 13 }}>
                <span>{L('Kapasite Total', 'Total Capacity', 'Capacite Totale')}</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{sections.reduce((sum, s) => sum + s.capacity, 0).toLocaleString()}</span>
              </div>
            </div>
              </>
            )}
          </div>
        )}

        {/* STEP 4: PROMOS */}
        {step === 4 && (
          <div style={cardStyle}>
            <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 20 }}>
              {L('Kod Pwomosyon', 'Promo Codes', 'Codes Promo')}
            </h2>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
              {L('Opsyonel. Ajoute kod rabe pou kliyan ou.', 'Optional. Add discount codes for your customers.', 'Optionnel. Ajoutez des codes de reduction.')}
            </p>

            {promos.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid #1e1e2e', borderRadius: 8, marginBottom: 8 }}>
                <span style={{ color: '#f97316', fontWeight: 700, fontFamily: 'monospace' }}>{p.code}</span>
                <span style={{ color: '#aaa', fontSize: 13 }}>
                  {p.type === 'percent' ? `${p.discount}%` : `$${p.discount}`} &bull; max {p.maxUses}
                </span>
                <button onClick={() => removePromo(i)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>X</button>
              </div>
            ))}

            <div style={{ border: '1px solid #1e1e2e', borderRadius: 8, padding: 16, marginTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>{L('Kod', 'Code', 'Code')}</label>
                  <input value={newPromoCode} onChange={e => setNewPromoCode(e.target.value.toUpperCase())} placeholder="KOMPA10"
                    style={{ ...inputStyle, fontSize: 13, padding: 8, fontFamily: 'monospace' }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>{L('Rabe', 'Discount', 'Rabais')}</label>
                  <input type="number" value={newPromoDiscount} onChange={e => setNewPromoDiscount(parseInt(e.target.value) || 0)}
                    style={{ ...inputStyle, fontSize: 13, padding: 8 }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>{L('Tip', 'Type', 'Type')}</label>
                  <select value={newPromoType} onChange={e => setNewPromoType(e.target.value as any)} style={{ ...inputStyle, fontSize: 13, padding: 8 }}>
                    <option value="percent">%</option>
                    <option value="fixed">$</option>
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Max</label>
                  <input type="number" value={newPromoMax} onChange={e => setNewPromoMax(parseInt(e.target.value) || 0)}
                    style={{ ...inputStyle, fontSize: 13, padding: 8 }} />
                </div>
              </div>
              <button onClick={addPromo} disabled={!newPromoCode}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: newPromoCode ? '#f97316' : '#333', color: newPromoCode ? '#000' : '#666', cursor: newPromoCode ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
                + {L('Ajoute', 'Add', 'Ajouter')}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: IMAGE */}
        {step === 5 && (
          <div style={cardStyle}>
            <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 20 }}>
              {L('Afich Evenman', 'Event Poster', "Affiche de l'evenement")}
            </h2>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
              {L('Mete URL imaj afich evenman ou a.', 'Enter the URL of your event poster image.', "URL de l'affiche.")}
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>URL</label>
              <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} style={inputStyle}
                placeholder="https://example.com/event-poster.jpg" />
            </div>
            {imageUrl && (
              <div style={{ border: '1px solid #1e1e2e', borderRadius: 8, overflow: 'hidden', maxHeight: 300 }}>
                <img src={imageUrl} alt="Preview" style={{ width: '100%', objectFit: 'cover' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            {!imageUrl && (
              <div style={{ border: '2px dashed #1e1e2e', borderRadius: 12, padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>&#x1F5BC;</div>
                <p style={{ color: '#555', fontSize: 13 }}>{L('Pa gen imaj anko', 'No image yet', "Pas encore d'image")}</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 6: REVIEW */}
        {step === 6 && (
          <div style={cardStyle}>
            <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 20 }}>
              {L('Revize Evenman', 'Review Event', "Revoir l'evenement")}
            </h2>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>{L('Non', 'Name', 'Nom')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{name}</div>
                {isPrivate && (
                  <span style={{ background: '#f97316', color: '#000', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                    🔒 PRIVE
                  </span>
                )}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>{L('Kategori', 'Category', 'Categorie')}</div>
              <div style={{ color: '#fff' }}>{category}</div>
            </div>
            {description && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>{L('Deskripsyon', 'Description', 'Description')}</div>
                <div style={{ color: '#ccc', fontSize: 13 }}>{description}</div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>{L('Dat', 'Date', 'Date')}</div>
                <div style={{ color: '#fff' }}>{startDate} {startTime && `@ ${startTime}`}</div>
              </div>
              <div>
                <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>{L('Kote', 'Venue', 'Lieu')}</div>
                <div style={{ color: '#fff' }}>{venue.name}</div>
                <div style={{ color: '#666', fontSize: 12 }}>{venue.city}, {venue.country}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>{L('Seksyon', 'Sections', 'Sections')}</div>
              {sections.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderLeft: `3px solid ${s.color}`, background: '#0a0a0f', borderRadius: 4, marginBottom: 4 }}>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: '#aaa', fontSize: 13 }}>{s.capacity} {L('plas', 'seats', 'places')} &bull; ${s.price}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', marginTop: 4 }}>
                <span style={{ color: '#f97316', fontWeight: 700 }}>Total</span>
                <span style={{ color: '#f97316', fontWeight: 700 }}>{sections.reduce((s, x) => s + x.capacity, 0)} {L('plas', 'seats', 'places')}</span>
              </div>
            </div>

            {promos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>{L('Kod Pwomo', 'Promo Codes', 'Codes Promo')}</div>
                {promos.map((p, i) => (
                  <span key={i} style={{ display: 'inline-block', padding: '4px 10px', background: '#1a0a00', border: '1px solid #f97316', borderRadius: 20, color: '#f97316', fontSize: 12, marginRight: 6, marginBottom: 4 }}>
                    {p.code} ({p.type === 'percent' ? `${p.discount}%` : `$${p.discount}`})
                  </span>
                ))}
              </div>
            )}


            {/* Refund Policy */}
            <div style={{ marginTop: 20, padding: '16px', background: '#0a0a0f', borderRadius: 10, border: '1px solid #1e1e2e' }}>
              <div style={{ color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                📋 {L('Politik Ranbousman', 'Refund Policy', 'Politique de Remboursement')}
              </div>
              {(['organizer_approval', 'timed', 'no_refund'] as const).map(opt => (
                <div key={opt} onClick={() => setRefundPolicy(opt)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  border: `1px solid ${refundPolicy === opt ? '#f97316' : '#1e1e2e'}`,
                  borderRadius: 8, cursor: 'pointer', marginBottom: 8,
                  background: refundPolicy === opt ? '#1a0a00' : 'transparent',
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${refundPolicy === opt ? '#f97316' : '#333'}`, background: refundPolicy === opt ? '#f97316' : 'transparent', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: refundPolicy === opt ? '#f97316' : '#fff', fontWeight: 700, fontSize: 13 }}>
                      {opt === 'organizer_approval' && L('Sijè Apwobasyon', 'Subject to Approval', 'Soumis à Approbation')}
                      {opt === 'timed' && L('Fenèt Tan', 'Time Window', 'Fenêtre Temporelle')}
                      {opt === 'no_refund' && L('Pa Gen Ranbousman', 'No Refunds', 'Aucun Remboursement')}
                    </div>
                    <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
                      {opt === 'organizer_approval' && L('Ou deside ka pa ka pou chak demann.', 'You decide case by case.', 'Vous décidez au cas par cas.')}
                      {opt === 'timed' && L('Moun ka mande ranbousman avan yon dat limit.', 'Buyers can request before a deadline.', 'Les acheteurs peuvent demander avant une date limite.')}
                      {opt === 'no_refund' && L('Vant final — pa gen ranbousman.', 'All sales final — no refunds.', 'Ventes définitives.')}
                    </div>
                  </div>
                </div>
              ))}
              {refundPolicy === 'timed' && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ color: '#888', fontSize: 12 }}>{L('Jou anvan evènman:', 'Days before event:', 'Jours avant:')}</label>
                  <input type="number" min="1" max="90" value={refundDeadlineDays}
                    onChange={e => setRefundDeadlineDays(parseInt(e.target.value) || 7)}
                    style={{ width: 80, padding: 8, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 14, fontWeight: 700, textAlign: 'center' }}
                  />
                </div>
              )}
            </div>
            {imageUrl && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>{L('Afich', 'Poster', 'Affiche')}</div>
                <img src={imageUrl} alt="poster" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }} />
              </div>
            )}
          </div>
        )}

        {/* NAV BUTTONS */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {step > 1 && step < 7 && (
            <button onClick={() => setStep(step - 1)}
              style={{ flex: 1, padding: 14, borderRadius: 8, border: '1px solid #333', background: 'transparent', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              &larr; {L('Retounen', 'Back', 'Retour')}
            </button>
          )}
          {step < 6 && (
            <button onClick={() => canProceed() && setStep(step + 1)} disabled={!canProceed()}
              style={{
                flex: 1, padding: 14, borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, cursor: canProceed() ? 'pointer' : 'not-allowed',
                background: canProceed() ? '#f97316' : '#333', color: canProceed() ? '#000' : '#666',
              }}>
              {L('Kontinye', 'Continue', 'Continuer')} &rarr;
            </button>
          )}
          {step === 6 && (
            <>
              <button onClick={() => handleSave('draft')} disabled={saving}
                style={{ flex: 1, padding: 14, borderRadius: 8, border: '1px solid #f97316', background: 'transparent', color: '#f97316', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? '...' : L('Sove Bouyon', 'Save Draft', 'Sauvegarder Brouillon')}
              </button>
              <button onClick={() => handleSave('published')} disabled={saving}
                style={{ flex: 1, padding: 14, borderRadius: 8, border: 'none', background: '#f97316', color: '#000', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? '...' : L('Pibliye!', 'Publish!', 'Publier!')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
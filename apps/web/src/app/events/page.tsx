'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useT } from '@/i18n';
import { getPublishedEvents, type EventData } from '@/lib/db';

export default function BrowseEvents() {
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale]);

  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await getPublishedEvents();
        setEvents(data);
      } catch (err) {
        console.error('Failed to load events:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const categories = [
    { value: '', label: L('Tout', 'All', 'Tous') },
    { value: 'kompa', label: 'Kompa' },
    { value: 'rara', label: 'Rara' },
    { value: 'rasin', label: 'Rasin' },
    { value: 'jazz', label: 'Jazz' },
    { value: 'dj', label: 'DJ' },
    { value: 'gala', label: 'Gala' },
    { value: 'conference', label: L('Konferans', 'Conference', 'Conference') },
    { value: 'sports', label: L('Espo', 'Sports', 'Sports') },
    { value: 'theater', label: L('Teyat', 'Theater', 'Theatre') },
    { value: 'festival', label: 'Festival' },
    { value: 'religious', label: L('Relijye', 'Religious', 'Religieux') },
  ];

  const cities = ['', ...Array.from(new Set(events.map(e => e.venue?.city).filter(Boolean)))];

  const filtered = events.filter(e => {
    const matchSearch = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.description?.toLowerCase().includes(search.toLowerCase()) ||
      e.venue?.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.venue?.city?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !selectedCategory || e.category === selectedCategory;
    const matchCity = !selectedCity || e.venue?.city === selectedCity;
    return matchSearch && matchCategory && matchCity;
  });

  const lowestPrice = (e: EventData) => {
    if (!e.sections || e.sections.length === 0) return 0;
    return Math.min(...e.sections.map(s => s.price));
  };

  const totalCapacity = (e: EventData) => {
    if (!e.sections) return 0;
    return e.sections.reduce((sum, s) => sum + s.capacity, 0);
  };

  const inputStyle: React.CSSProperties = { padding: 12, borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 14, boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '20px 16px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Link href="/" style={{ color: '#06b6d4', textDecoration: 'none', fontSize: 14 }}>
            &larr; {L('Lakay', 'Home', 'Accueil')}
          </Link>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>
            {L('Evenman', 'Events', 'Evenements')}
          </h1>
          <Link href="/auth" style={{ color: '#06b6d4', textDecoration: 'none', fontSize: 13 }}>
            {L('Konekte', 'Sign In', 'Connexion')}
          </Link>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={L('Chache evenman, atis, kote...', 'Search events, artists, venues...', 'Chercher evenements, artistes, lieux...')!}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {/* Category chips */}
          {categories.map(c => (
            <button key={c.value} onClick={() => setSelectedCategory(c.value)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '1px solid #1e1e2e', cursor: 'pointer',
                background: selectedCategory === c.value ? '#06b6d4' : 'transparent',
                color: selectedCategory === c.value ? '#000' : '#888',
                fontSize: 12, fontWeight: 600,
              }}>
              {c.label}
            </button>
          ))}

          {/* City filter */}
          {cities.length > 2 && (
            <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)}
              style={{ ...inputStyle, fontSize: 12, padding: '6px 12px', borderRadius: 20 }}>
              <option value="">{L('Tout Vil', 'All Cities', 'Toutes les villes')}</option>
              {cities.filter(Boolean).map(c => (
                <option key={c} value={c!}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#x23F3;</div>
            <p style={{ color: '#888' }}>{L('Ap chaje evenman...', 'Loading events...', 'Chargement...')}</p>
          </div>
        )}

        {/* No events */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#x1F3B6;</div>
            <h2 style={{ color: '#fff', marginBottom: 8 }}>
              {search || selectedCategory
                ? L('Pa gen rezilta', 'No results', 'Aucun resultat')
                : L('Pa gen evenman anko', 'No events yet', "Pas encore d'evenements")}
            </h2>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
              {search || selectedCategory
                ? L('Eseye yon lot rechech', 'Try a different search', 'Essayez une autre recherche')
                : L('Premye evenman yo ap vini byento!', 'First events coming soon!', 'Les premiers evenements arrivent bientot!')}
            </p>
            {(search || selectedCategory) && (
              <button onClick={() => { setSearch(''); setSelectedCategory(''); setSelectedCity(''); }}
                style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #06b6d4', background: 'transparent', color: '#06b6d4', cursor: 'pointer', fontSize: 13 }}>
                {L('Efase Filt', 'Clear Filters', 'Effacer les filtres')}
              </button>
            )}
          </div>
        )}

        {/* Event Grid */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtered.map(event => (
              <Link key={event.id} href={`/buy?event=${event.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, overflow: 'hidden',
                  cursor: 'pointer', transition: 'border-color .2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#06b6d4')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e2e')}>

                  {/* Image */}
                  <div style={{ height: 160, background: '#1a1a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {event.imageUrl ? (
                      <img src={event.imageUrl} alt={event.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 48 }}>&#x1F3B5;</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0, flex: 1 }}>{event.name}</h3>
                      <span style={{ background: '#06b6d4', color: '#000', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, marginLeft: 8, whiteSpace: 'nowrap' }}>
                        ${lowestPrice(event)}+
                      </span>
                    </div>

                    <div style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>
                      {event.startDate} {event.startTime && `@ ${event.startTime}`}
                    </div>

                    <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
                      {event.venue?.name} &bull; {event.venue?.city}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                        background: '#0a1a1a', border: '1px solid #1e1e2e', color: '#888',
                      }}>
                        {event.category}
                      </span>
                      <span style={{ color: '#555', fontSize: 11 }}>
                        {totalCapacity(event)} {L('plas', 'seats', 'places')}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && filtered.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 24, color: '#555', fontSize: 13 }}>
            {filtered.length} {L('evenman', 'events', 'evenements')}
            {(search || selectedCategory || selectedCity) && ` ${L('jwenn', 'found', 'trouves')}`}
          </div>
        )}
      </div>
    </div>
  );
}
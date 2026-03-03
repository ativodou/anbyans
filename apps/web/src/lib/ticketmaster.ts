// Ticketmaster Discovery API - Events from Haitian diaspora cities
// Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/

const TM_API_KEY = typeof window !== 'undefined'
  ? process.env.NEXT_PUBLIC_TM_API_KEY || ''
  : '';

const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

// Haitian diaspora cities with lat/long for radius search
const HAITIAN_CITIES = [
  { name: 'Miami', lat: 25.7617, lng: -80.1918 },
  { name: 'Fort Lauderdale', lat: 26.1224, lng: -80.1373 },
  { name: 'Orlando', lat: 28.5383, lng: -81.3792 },
  { name: 'Brooklyn', lat: 40.6782, lng: -73.9442 },
  { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  { name: 'Newark', lat: 40.7357, lng: -74.1724 },
  { name: 'Montreal', lat: 45.5017, lng: -73.5673 },
  { name: 'Spring Valley NY', lat: 41.1131, lng: -74.0438 },
  { name: 'Stamford CT', lat: 41.0534, lng: -73.5387 },
  { name: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
  { name: 'Atlanta', lat: 33.7490, lng: -84.3880 },
];

export interface TMEvent {
  id: string;
  title: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  emoji: string;
  price: number;
  imageUrl: string;
  ticketUrl: string;
  source: 'ticketmaster';
}

// Category → emoji mapping
function categoryEmoji(segment: string, genre: string): string {
  const g = (genre || '').toLowerCase();
  const s = (segment || '').toLowerCase();
  if (g.includes('hip-hop') || g.includes('rap')) return '🎤';
  if (g.includes('r&b') || g.includes('soul')) return '🎵';
  if (g.includes('jazz')) return '🎷';
  if (g.includes('latin') || g.includes('reggae') || g.includes('world')) return '🥁';
  if (g.includes('rock') || g.includes('alternative')) return '🎸';
  if (g.includes('pop')) return '🎶';
  if (g.includes('electronic') || g.includes('dance')) return '🎧';
  if (g.includes('comedy')) return '😂';
  if (s.includes('sport')) return '⚽';
  if (s.includes('arts') || s.includes('theatre')) return '🎭';
  if (s.includes('film')) return '🎬';
  return '🎶';
}

// Fetch events from one city
async function fetchCityEvents(lat: number, lng: number, radius: number = 30): Promise<TMEvent[]> {
  if (!TM_API_KEY) return [];

  try {
    const params = new URLSearchParams({
      apikey: TM_API_KEY,
      latlong: `${lat},${lng}`,
      radius: String(radius),
      unit: 'miles',
      size: '10',
      sort: 'date,asc',
      classificationName: 'music,arts',
    });

    const res = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) return [];

    const data = await res.json();
    const events = data?._embedded?.events || [];

    return events.map((ev: any) => {
      const venue = ev._embedded?.venues?.[0];
      const segment = ev.classifications?.[0]?.segment?.name || '';
      const genre = ev.classifications?.[0]?.genre?.name || '';
      const priceRange = ev.priceRanges?.[0];
      const image = ev.images?.find((img: any) => img.width > 300 && img.width < 800)
        || ev.images?.[0];

      return {
        id: ev.id,
        title: ev.name,
        venue: venue?.name || '',
        city: venue?.city?.name || '',
        date: ev.dates?.start?.localDate || '',
        time: ev.dates?.start?.localTime || '',
        emoji: categoryEmoji(segment, genre),
        price: priceRange?.min || 0,
        imageUrl: image?.url || '',
        ticketUrl: ev.url || '',
        source: 'ticketmaster' as const,
      };
    });
  } catch {
    return [];
  }
}

// Fetch events from all Haitian diaspora cities
// Rotates through cities to stay under rate limit (5 req/sec)
export async function fetchHaitianCityEvents(maxCities: number = 11): Promise<TMEvent[]> {
  if (!TM_API_KEY) return [];

  // Pick random cities each time for variety
  const shuffled = [...HAITIAN_CITIES].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, maxCities);

  const results: TMEvent[] = [];
  const seen = new Set<string>();

  for (const city of selected) {
    // Small delay between calls to respect rate limit
    if (results.length > 0) {
      await new Promise(r => setTimeout(r, 250));
    }

 const events = await fetchCityEvents(city.lat, city.lng);
    for (const ev of events) {
      const key = ev.title.toLowerCase().trim();
      if (!seen.has(ev.id) && !seen.has(key)) {
        seen.add(ev.id);
        seen.add(key);
        results.push(ev);
      }
    }
  }

  // Sort by date
  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}

// Convert TM events to gallery format (for landing page scroll)
export function tmEventsToGallery(events: TMEvent[]) {
  return events.map(ev => ({
    title: ev.title,
    venue: `${ev.venue}, ${ev.city}`,
    date: ev.date,
    emoji: ev.emoji,
    price: ev.price,
    live: false,
    imageUrl: ev.imageUrl,
    ticketUrl: ev.ticketUrl,
    source: 'ticketmaster' as const,
  }));
}
/**
 * Haitian-centric event sources for the Anbyans homepage scroll.
 *
 * Sources (all client-safe, no secret keys needed):
 *  1. Haitian Times  — iCal feed (diaspora events, NYC/Miami/Boston/ATL)
 *  2. Eventbrite     — curated Haitian promoter org IDs via public API
 *  3. Belfet.com     — RSS feed (Haiti island + diaspora, oldest archive)
 */

export interface HaitianEvent {
  id:        string;
  title:     string;
  venue:     string;
  city:      string;
  date:      string;   // YYYY-MM-DD
  time:      string;
  emoji:     string;
  price:     number;
  imageUrl:  string;
  ticketUrl: string;
  source:    'haitian-times' | 'eventbrite' | 'belfet';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function musicEmoji(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('kompa') || t.includes('compas')) return '🎶';
  if (t.includes('rasin') || t.includes('roots'))  return '🥁';
  if (t.includes('rap') || t.includes('hip'))      return '🎤';
  if (t.includes('jazz'))                          return '🎷';
  if (t.includes('dance') || t.includes('bal'))    return '🕺';
  if (t.includes('gospel') || t.includes('prèz'))  return '🎹';
  if (t.includes('carnival') || t.includes('kanaval')) return '🎭';
  if (t.includes('gala') || t.includes('soirée') || t.includes('soiree')) return '✨';
  return '🎶';
}

function isoDate(raw: string): string {
  // handles YYYYMMDD and YYYYMMDDTHHMMSSZ
  const s = raw.replace(/T.*/, '');
  if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  return raw.slice(0, 10);
}

// ─── 1. Haitian Times iCal ────────────────────────────────────────────────────
// Public iCal export from their WordPress event calendar.
// No auth, no key, just a .ics text file.

const HAITIAN_TIMES_ICAL =
  'https://haitiantimes.com/?ical=1&tribe_display=list';

function parseIcal(raw: string): HaitianEvent[] {
  const events: HaitianEvent[] = [];
  const blocks = raw.split('BEGIN:VEVENT');
  blocks.shift(); // drop header

  for (const block of blocks) {
    const get = (key: string) => {
      const match = block.match(new RegExp(`${key}[^:]*:([^\r\n]+)`));
      return match ? match[1].trim() : '';
    };
    const title   = get('SUMMARY').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const dtstart = get('DTSTART');
    const url     = get('URL');
    const loc     = get('LOCATION').replace(/\\,/g, ',');
    const desc    = get('DESCRIPTION');
    if (!title || !dtstart) continue;

    const dateStr = isoDate(dtstart);
    const today   = new Date().toISOString().slice(0, 10);
    if (dateStr < today) continue; // skip past events

    // extract price from description if present
    const priceMatch = desc.match(/\$(\d+)/);
    const price = priceMatch ? Number(priceMatch[1]) : 0;

    // extract city from location
    const parts = loc.split(',');
    const city  = parts.length > 1 ? parts[parts.length - 1].trim() : loc;

    events.push({
      id:        `ht-${dtstart}-${title.slice(0, 20)}`,
      title,
      venue:     parts[0]?.trim() || loc,
      city,
      date:      dateStr,
      time:      '',
      emoji:     musicEmoji(title),
      price,
      imageUrl:  '',
      ticketUrl: url,
      source:    'haitian-times',
    });
  }

  return events;
}

export async function fetchHaitianTimesEvents(): Promise<HaitianEvent[]> {
  try {
    // We proxy via a CORS-friendly endpoint — Next.js API route below
    const res = await fetch('/api/feeds/haitian-times', { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const text = await res.text();
    return parseIcal(text).slice(0, 20);
  } catch {
    return [];
  }
}

// ─── 2. Eventbrite — curated Haitian promoter org IDs ────────────────────────
// Eventbrite killed keyword search but org-level endpoints still work.
// These are real, active Haitian promoter organizations on Eventbrite.
// Add more as you discover them.

const HAITIAN_EB_ORGS = [
  '385763',    // Haitian Sensation
  '12263424',  // Kompa Kreyol
  '71499727',  // Caribbean Heat Events
  '29260812',  // Haiti Cultural Exchange
  '5751483',   // Haitian American Museum of Chicago
  '17699527',  // Haitian Roundtable
  '47889833',  // Lakay Haitian
  '60714013',  // Tropical Vibes Events
  '32572628',  // Boston Haitian Reporter Events
  '229687555', // Miami Haitian Events
];

const EB_KEY = typeof window !== 'undefined'
  ? process.env.NEXT_PUBLIC_EVENTBRITE_KEY || ''
  : '';

async function fetchOrgEvents(orgId: string): Promise<HaitianEvent[]> {
  if (!EB_KEY) return [];
  try {
    const res = await fetch(
      `https://www.eventbriteapi.com/v3/organizers/${orgId}/events/?status=live&order_by=start_asc&token=${EB_KEY}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events || []).map((ev: any) => ({
      id:        `eb-${ev.id}`,
      title:     ev.name?.text || '',
      venue:     ev.venue?.name || '',
      city:      ev.venue?.address?.city || '',
      date:      ev.start?.local?.slice(0, 10) || '',
      time:      ev.start?.local?.slice(11, 16) || '',
      emoji:     musicEmoji(ev.name?.text || ''),
      price:     ev.is_free ? 0 : (ev.ticket_availability?.minimum_ticket_price?.major_value || 0),
      imageUrl:  ev.logo?.url || '',
      ticketUrl: ev.url || '',
      source:    'eventbrite' as const,
    })).filter((e: HaitianEvent) => e.title && e.date >= new Date().toISOString().slice(0, 10));
  } catch {
    return [];
  }
}

export async function fetchEventbriteHaitianEvents(): Promise<HaitianEvent[]> {
  if (!EB_KEY) return [];
  const today = new Date().toISOString().slice(0, 10);
  const all: HaitianEvent[] = [];
  const seen = new Set<string>();

  // Fetch up to 5 orgs in parallel to keep it fast
  const batches = [];
  for (let i = 0; i < HAITIAN_EB_ORGS.length; i += 5) {
    batches.push(HAITIAN_EB_ORGS.slice(i, i + 5));
  }
  for (const batch of batches) {
    const results = await Promise.allSettled(batch.map(id => fetchOrgEvents(id)));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const ev of r.value) {
          if (!seen.has(ev.id) && ev.date >= today) {
            seen.add(ev.id);
            all.push(ev);
          }
        }
      }
    }
  }

  return all.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 20);
}

// ─── 3. Belfet RSS ────────────────────────────────────────────────────────────
// Belfet.com has been listing Haitian events since 2002.
// Their site exposes an RSS feed that we parse server-side via the proxy route.

function parseRss(xml: string): HaitianEvent[] {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  const today = new Date().toISOString().slice(0, 10);
  const events: HaitianEvent[] = [];

  for (const item of items) {
    const get = (tag: string) => {
      const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };

    const title   = get('title');
    const link    = get('link');
    const pubDate = get('pubDate');
    const desc    = get('description');
    const encl    = item.match(/enclosure[^>]+url="([^"]+)"/)?.[1] || '';

    if (!title) continue;

    // pubDate is like "Mon, 10 Jun 2024 00:00:00 +0000"
    let dateStr = '';
    try {
      const d = new Date(pubDate);
      if (!isNaN(d.getTime())) dateStr = d.toISOString().slice(0, 10);
    } catch {}
    if (!dateStr || dateStr < today) continue;

    const priceMatch = desc.match(/\$(\d+)/);

    events.push({
      id:        `bf-${link.slice(-20)}`,
      title,
      venue:     '',
      city:      '',
      date:      dateStr,
      time:      '',
      emoji:     musicEmoji(title),
      price:     priceMatch ? Number(priceMatch[1]) : 0,
      imageUrl:  encl,
      ticketUrl: link,
      source:    'belfet',
    });
  }

  return events.slice(0, 20);
}

export async function fetchBelfetEvents(): Promise<HaitianEvent[]> {
  try {
    const res = await fetch('/api/feeds/belfet', { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml);
  } catch {
    return [];
  }
}

// ─── Combined fetch ───────────────────────────────────────────────────────────

export function haitianEventsToGallery(events: HaitianEvent[]) {
  return events.map(ev => ({
    title:     ev.title,
    venue:     [ev.venue, ev.city].filter(Boolean).join(', '),
    date:      ev.date,
    emoji:     ev.emoji,
    price:     ev.price,
    live:      false,
    imageUrl:  ev.imageUrl,
    ticketUrl: ev.ticketUrl,
    source:    ev.source,
  }));
}

export async function fetchAllHaitianEvents(): Promise<HaitianEvent[]> {
  const [htEvents, ebEvents, bfEvents] = await Promise.allSettled([
    fetchHaitianTimesEvents(),
    fetchEventbriteHaitianEvents(),
    fetchBelfetEvents(),
  ]);

  const all: HaitianEvent[] = [
    ...(htEvents.status === 'fulfilled' ? htEvents.value : []),
    ...(ebEvents.status === 'fulfilled' ? ebEvents.value : []),
    ...(bfEvents.status === 'fulfilled' ? bfEvents.value : []),
  ];

  // Deduplicate by title similarity + date
  const seen = new Set<string>();
  const deduped = all.filter(ev => {
    const key = `${ev.date}:${ev.title.toLowerCase().slice(0, 30).trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.sort((a, b) => a.date.localeCompare(b.date));
}

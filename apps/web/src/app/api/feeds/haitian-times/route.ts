import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ICAL_URL = 'https://haitiantimes.com/?ical=1&tribe_display=list';

/**
 * GET /api/feeds/haitian-times
 * Server-side CORS proxy for the Haitian Times iCal feed.
 * Cached for 1 hour via Cache-Control header.
 */
export async function GET() {
  try {
    const res = await fetch(ICAL_URL, {
      headers: { 'User-Agent': 'Anbyans/1.0 (+https://anbyans.events)' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return new NextResponse(`Upstream error: ${res.status}`, { status: 502 });
    }

    const text = await res.text();
    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(message, { status: 500 });
  }
}

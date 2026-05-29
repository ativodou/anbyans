import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Belfet.com RSS feed — Haitian events archive since 2002
const RSS_URL = 'https://www.belfet.com/feed/';

/**
 * GET /api/feeds/belfet
 * Server-side CORS proxy for the Belfet.com RSS feed.
 * Cached for 1 hour via Cache-Control header.
 */
export async function GET() {
  try {
    const res = await fetch(RSS_URL, {
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
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(message, { status: 500 });
  }
}

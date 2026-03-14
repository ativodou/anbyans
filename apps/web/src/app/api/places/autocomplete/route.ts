import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  if (!API_KEY) {
    return NextResponse.json({ error: 'Places API not configured' }, { status: 500 });
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
      },
      body: JSON.stringify({
        input: query,
        includedPrimaryTypes: [
          'event_venue',
          'stadium',
          'arena',
          'convention_center',
          'concert_hall',
          'performing_arts_theater',
          'auditorium',
          'banquet_hall',
          'night_club',
          'bar',
          'restaurant',
          'park',
          'sports_complex',
          'hotel',
          'church',
          'school',
          'university',
        ],
        languageCode: 'fr', // French first — good for Haiti + diaspora
      }),
    });

    if (!res.ok) {
      // Fallback: try without type filter (some venues don't match specific types)
      const fallback = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
        },
        body: JSON.stringify({
          input: query,
          languageCode: 'fr',
        }),
      });

      if (!fallback.ok) {
        return NextResponse.json({ suggestions: [] });
      }

      const data = await fallback.json();
      return NextResponse.json({ suggestions: formatSuggestions(data.suggestions || []) });
    }

    const data = await res.json();
    return NextResponse.json({ suggestions: formatSuggestions(data.suggestions || []) });

  } catch (err) {
    console.error('Places autocomplete error:', err);
    return NextResponse.json({ suggestions: [] });
  }
}

// GET place details (address, lat/lng) by placeId
export async function POST(req: NextRequest) {
  const { placeId } = await req.json();
  if (!placeId || !API_KEY) {
    return NextResponse.json({ error: 'Missing placeId or API key' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'displayName,formattedAddress,location,addressComponents,internationalPhoneNumber',
      },
    });

    if (!res.ok) return NextResponse.json({ error: 'Place not found' }, { status: 404 });

    const place = await res.json();

    // Extract city from address components
    const city = place.addressComponents?.find((c: any) =>
      c.types?.includes('locality') || c.types?.includes('administrative_area_level_2')
    )?.longText || '';

    const country = place.addressComponents?.find((c: any) =>
      c.types?.includes('country')
    )?.longText || '';

    return NextResponse.json({
      name:     place.displayName?.text || '',
      address:  place.formattedAddress || '',
      city,
      country,
      lat:      place.location?.latitude || null,
      lng:      place.location?.longitude || null,
    });

  } catch (err) {
    console.error('Places detail error:', err);
    return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 500 });
  }
}

function formatSuggestions(raw: any[]) {
  return raw.map(s => ({
    placeId:     s.placePrediction?.placeId || '',
    name:        s.placePrediction?.structuredFormat?.mainText?.text || s.placePrediction?.text?.text || '',
    secondary:   s.placePrediction?.structuredFormat?.secondaryText?.text || '',
    fullText:    s.placePrediction?.text?.text || '',
  })).filter(s => s.placeId && s.name);
}

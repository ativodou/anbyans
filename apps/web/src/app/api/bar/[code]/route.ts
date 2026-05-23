import { NextResponse } from 'next/server';

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function parseFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue'  in v) out[k] = v.stringValue;
    else if ('booleanValue' in v) out[k] = v.booleanValue;
    else if ('integerValue' in v) out[k] = parseInt(v.integerValue);
    else if ('doubleValue'  in v) out[k] = v.doubleValue;
    else if ('mapValue'     in v) out[k] = parseFields(v.mapValue.fields ?? {});
    else if ('arrayValue'   in v) out[k] = (v.arrayValue.values ?? []).map((i: any) =>
      i.mapValue ? parseFields(i.mapValue.fields ?? {}) : Object.values(i)[0]);
  }
  return out;
}

export async function GET(_: Request, { params }: { params: { code: string } }) {
  const { code } = params;

  // 1. Try barCode query
  const qRes = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'events' }],
        where: { fieldFilter: { field: { fieldPath: 'barCode' }, op: 'EQUAL', value: { stringValue: code } } },
        limit: 1,
      },
    }),
  });
  const qData = await qRes.json();
  const hit = Array.isArray(qData) && qData.find((r: any) => r.document);
  if (hit) {
    const id = hit.document.name.split('/').pop();
    return NextResponse.json({ id, ...parseFields(hit.document.fields ?? {}) });
  }

  // 2. Try direct document ID
  const dRes = await fetch(`${BASE}/events/${code}`);
  if (dRes.ok) {
    const dData = await dRes.json();
    if (dData.fields) return NextResponse.json({ id: code, ...parseFields(dData.fields) });
  }

  return NextResponse.json(null);
}

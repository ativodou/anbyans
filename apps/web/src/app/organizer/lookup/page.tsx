'use client';

import { useState, useRef } from 'react';
import { collection, query, where, orderBy, startAt, endAt, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface TicketResult {
  id: string;
  ticketCode: string;
  buyerPin?: string;
  buyerName: string;
  buyerPhone?: string;
  buyerEmail?: string;
  eventId?: string;
  eventName?: string;
  section?: string;
  sectionName?: string;
  status: string;
  price?: number;
  paymentMethod?: string;
}

export default function OrganizerLookupPage() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<TicketResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSearch(term: string) {
    const t = term.trim();
    if (!t || t.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(false);

    try {
      const seen = new Set<string>();
      const allResults: TicketResult[] = [];

      function add(d: any) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          allResults.push({ id: d.id, ...d.data() } as TicketResult);
        }
      }

      const promises: Promise<void>[] = [];

      // ── Phone: prefix search (starts-with) ──
      // Handles partial phone like "305504" → finds "3055040143"
      if (/^\+?[\d\s\-()]{2,}$/.test(t)) {
        const cleanPhone = t.replace(/\D/g, '');
        promises.push(
          getDocs(query(
            collection(db, 'tickets'),
            orderBy('buyerPhone'),
            startAt(cleanPhone),
            endAt(cleanPhone + '')
          )).then(s => s.forEach(add))
        );
        // also try with full string as-is
        promises.push(
          getDocs(query(
            collection(db, 'tickets'),
            orderBy('buyerPhone'),
            startAt(t),
            endAt(t + '')
          )).then(s => s.forEach(add))
        );
      }

      // ── Name: prefix search (case-sensitive starts-with) ──
      // "jean" → finds "Jean Pierre", "jean paul"
      const capitalized = t.charAt(0).toUpperCase() + t.slice(1);
      for (const nameVariant of Array.from(new Set([t, capitalized, t.toLowerCase(), t.toUpperCase()]))) {
        promises.push(
          getDocs(query(
            collection(db, 'tickets'),
            orderBy('buyerName'),
            startAt(nameVariant),
            endAt(nameVariant + '')
          )).then(s => s.forEach(add))
        );
      }

      await Promise.all(promises);

      // Sort: valid first, then by name
      allResults.sort((a, b) => {
        const order: Record<string, number> = { valid: 0, pending_transfer: 1, used: 2, cancelled: 3, refunded: 4 };
        const oa = order[a.status] ?? 5;
        const ob = order[b.status] ?? 5;
        if (oa !== ob) return oa - ob;
        return (a.buyerName || '').localeCompare(b.buyerName || '');
      });

      setResults(allResults);
    } catch (e) {
      console.error(e);
    }

    setSearched(true);
    setLoading(false);
  }

  function onChange(val: string) {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(val), 350);
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  }

  const statusColor: Record<string, string> = {
    valid:            'text-green-400 border-green-800 bg-green-900/20',
    used:             'text-orange border-orange/30 bg-orange/10',
    pending_transfer: 'text-indigo-400 border-indigo-800 bg-indigo-900/20',
    cancelled:        'text-red-400 border-red-800 bg-red-900/20',
    refunded:         'text-red-400 border-red-800 bg-red-900/20',
    pending:          'text-yellow-400 border-yellow-800 bg-yellow-900/20',
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-heading font-black tracking-tight mb-1">🔍 Retreve Tikè Fan</h1>
        <p className="text-xs text-gray-muted">
          Tape non oswa nimewo telefòn fan an — rezilta parèt otomatikman.
        </p>
      </div>

      {/* Search box — live search, no button needed */}
      <div className="relative mb-5">
        <input
          value={search}
          onChange={e => onChange(e.target.value)}
          placeholder="Jean Pierre  ·  3055040143  ·  305504…"
          autoFocus
          className="w-full px-4 py-3.5 rounded-xl bg-dark-card border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted pr-10"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-orange border-t-transparent animate-spin" />
        )}
        {!loading && search && (
          <button
            onClick={() => { setSearch(''); setResults([]); setSearched(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-muted hover:text-white text-lg leading-none"
          >✕</button>
        )}
      </div>

      {/* Hint before typing */}
      {!search && (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🎫</p>
          <p className="text-gray-muted text-sm">Tape non fan an oswa nimewo l</p>
          <p className="text-[11px] text-gray-muted mt-1 opacity-60">Ekri 2 lèt pou kòmanse chèche</p>
        </div>
      )}

      {/* No results */}
      {searched && results.length === 0 && search && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🤷</p>
          <p className="text-gray-muted text-sm">Okenn tikè pou <span className="text-white">"{search}"</span></p>
          <p className="text-[11px] text-gray-muted mt-2">Verifye òtograf oswa eseye nimewo telefòn konplè.</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] text-gray-muted uppercase tracking-wider font-bold">
            {results.length} tikè jwenn
          </p>

          {results.map(tk => (
            <div key={tk.id} className="bg-dark-card border border-border rounded-xl overflow-hidden">
              {/* Buyer row */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-sm font-black flex-shrink-0">
                  {tk.buyerName?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{tk.buyerName}</p>
                  <p className="text-[11px] text-gray-muted truncate">
                    {tk.buyerPhone}{tk.buyerEmail ? ` · ${tk.buyerEmail}` : ''}
                  </p>
                  {(tk.sectionName || tk.section) && (
                    <p className="text-[10px] text-gray-muted mt-0.5">{tk.sectionName || tk.section}</p>
                  )}
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border flex-shrink-0 ${statusColor[tk.status] || 'text-gray-400 border-border bg-white/5'}`}>
                  {tk.status}
                </span>
              </div>

              {/* Code + PIN block */}
              <div className="mx-4 mb-3 bg-[#0a0a0f] border border-border rounded-lg divide-y divide-border">
                {/* Code */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-[8px] text-gray-muted uppercase tracking-widest font-bold mb-0.5">Kòd Tikè</p>
                    <p className="font-mono font-black text-base text-white tracking-widest">{tk.ticketCode}</p>
                  </div>
                  <button
                    onClick={() => copy(tk.ticketCode, `code-${tk.id}`)}
                    className="px-2.5 py-1 rounded-lg border border-border text-[10px] font-bold text-gray-light hover:text-white transition-all"
                  >
                    {copiedId === `code-${tk.id}` ? '✓' : 'Kopye'}
                  </button>
                </div>

                {/* PIN */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-[8px] text-gray-muted uppercase tracking-widest font-bold mb-0.5">PIN</p>
                    {tk.buyerPin
                      ? <p className="font-mono font-black text-xl text-orange tracking-[0.4em]">{tk.buyerPin}</p>
                      : <p className="text-[11px] text-gray-muted italic">Pa gen PIN</p>
                    }
                  </div>
                  {tk.buyerPin && (
                    <button
                      onClick={() => copy(tk.buyerPin!, `pin-${tk.id}`)}
                      className="px-2.5 py-1 rounded-lg border border-orange/30 bg-orange/10 text-[10px] font-bold text-orange hover:bg-orange hover:text-black transition-all"
                    >
                      {copiedId === `pin-${tk.id}` ? '✓' : 'Kopye'}
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 px-4 pb-4">
                <Link
                  href={`/ticket/${tk.ticketCode}`}
                  target="_blank"
                  className="flex-1 text-center py-2 rounded-lg border border-border text-[11px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all"
                >
                  Wè Tikè →
                </Link>
                {tk.buyerPhone && (
                  <a
                    href={`https://wa.me/${tk.buyerPhone.replace(/\D/g,'')}?text=${encodeURIComponent(
                      `Bonjou ${tk.buyerName}! 🎫\nKòd tikè ou: *${tk.ticketCode}*${tk.buyerPin ? `\nPIN: *${tk.buyerPin}*` : ''}\n\nWè tikè ou la: https://anbyans.events/ticket/${tk.ticketCode}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-green-900/30 border border-green-800/40 text-[11px] font-bold text-green-400 hover:bg-green-800/40 transition-all whitespace-nowrap"
                  >
                    📱 WhatsApp
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

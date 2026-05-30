'use client';

import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
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

  async function handleSearch() {
    const term = search.trim();
    if (!term) return;
    setLoading(true);
    setSearched(false);
    setResults([]);

    try {
      const allResults: TicketResult[] = [];

      // Search by phone
      if (/^\d/.test(term)) {
        const q = query(collection(db, 'tickets'), where('buyerPhone', '==', term));
        const snap = await getDocs(q);
        snap.forEach(d => allResults.push({ id: d.id, ...d.data() } as TicketResult));
      }

      // Search by ticket code (uppercase)
      const code = term.toUpperCase();
      const q2 = query(collection(db, 'tickets'), where('ticketCode', '==', code));
      const snap2 = await getDocs(q2);
      snap2.forEach(d => {
        if (!allResults.find(r => r.id === d.id)) {
          allResults.push({ id: d.id, ...d.data() } as TicketResult);
        }
      });

      // Search by name (exact match — Firestore limitation)
      const q3 = query(collection(db, 'tickets'), where('buyerName', '==', term));
      const snap3 = await getDocs(q3);
      snap3.forEach(d => {
        if (!allResults.find(r => r.id === d.id)) {
          allResults.push({ id: d.id, ...d.data() } as TicketResult);
        }
      });

      setResults(allResults);
    } catch (e) {
      console.error(e);
    }

    setSearched(true);
    setLoading(false);
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  }

  const statusColor: Record<string, string> = {
    valid: 'text-green-400 border-green-800 bg-green-900/20',
    used: 'text-orange border-orange/30 bg-orange/10',
    pending_transfer: 'text-indigo-400 border-indigo-800 bg-indigo-900/20',
    cancelled: 'text-red-400 border-red-800 bg-red-900/20',
    refunded: 'text-red-400 border-red-800 bg-red-900/20',
    pending: 'text-yellow-400 border-yellow-800 bg-yellow-900/20',
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-heading font-black tracking-tight mb-1">
          🔍 Retreve Tikè Fan
        </h1>
        <p className="text-xs text-gray-muted">
          Chèche pa nimewo telefòn, kòd tikè, oswa non. Ou ka ba fan an PIN pou li aksede tikè li.
        </p>
      </div>

      {/* Search box */}
      <div className="flex gap-2 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="3055040143 · ABC12345 · Jean Pierre"
          className="flex-1 px-4 py-3 rounded-xl bg-dark-card border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted"
        />
        <button
          onClick={handleSearch}
          disabled={!search.trim() || loading}
          className="px-5 py-3 rounded-xl bg-orange text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange/80 transition-all"
        >
          {loading ? '...' : 'Chèche'}
        </button>
      </div>

      {/* Results */}
      {searched && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-muted text-sm">Okenn tikè jwenn pou "<span className="text-white">{search}</span>"</p>
          <p className="text-xs text-gray-muted mt-2">Eseye nimewo telefòn konplè, kòd egzak, oswa non egzak.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-muted mb-2">{results.length} tikè jwenn</p>

          {results.map(t => (
            <div key={t.id} className="bg-dark-card border border-border rounded-xl p-4">
              {/* Buyer info */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-bold text-sm">{t.buyerName}</p>
                  <p className="text-[11px] text-gray-muted">
                    {t.buyerPhone}{t.buyerEmail ? ` · ${t.buyerEmail}` : ''}
                  </p>
                  {t.eventName && (
                    <p className="text-[11px] text-gray-muted mt-0.5">
                      🎪 {t.eventName} · {t.sectionName || t.section || '—'}
                    </p>
                  )}
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${statusColor[t.status] || 'text-gray-400 border-border bg-white/5'}`}>
                  {t.status}
                </span>
              </div>

              {/* Ticket code + PIN — the key info */}
              <div className="bg-[#0a0a0f] border border-border rounded-lg p-3 space-y-2">
                {/* Code */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-gray-muted uppercase tracking-widest font-bold mb-0.5">Kòd Tikè</p>
                    <p className="font-mono font-black text-lg text-white tracking-widest">{t.ticketCode}</p>
                  </div>
                  <button
                    onClick={() => copy(t.ticketCode, `code-${t.id}`)}
                    className="px-3 py-1.5 rounded-lg border border-border text-[10px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all"
                  >
                    {copiedId === `code-${t.id}` ? '✓ Kopye' : 'Kopye'}
                  </button>
                </div>

                {/* PIN */}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <div>
                    <p className="text-[9px] text-gray-muted uppercase tracking-widest font-bold mb-0.5">PIN</p>
                    {t.buyerPin ? (
                      <p className="font-mono font-black text-2xl text-orange tracking-[0.3em]">{t.buyerPin}</p>
                    ) : (
                      <p className="text-[11px] text-gray-muted italic">Pa gen PIN — tikè ansyen</p>
                    )}
                  </div>
                  {t.buyerPin && (
                    <button
                      onClick={() => copy(t.buyerPin!, `pin-${t.id}`)}
                      className="px-3 py-1.5 rounded-lg border border-orange/30 bg-orange/10 text-[10px] font-bold text-orange hover:bg-orange hover:text-black transition-all"
                    >
                      {copiedId === `pin-${t.id}` ? '✓ Kopye' : 'Kopye PIN'}
                    </button>
                  )}
                </div>
              </div>

              {/* Quick link */}
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/ticket/${t.ticketCode}`}
                  target="_blank"
                  className="flex-1 text-center py-2 rounded-lg border border-border text-[11px] font-bold text-gray-light hover:text-white hover:border-white/20 transition-all"
                >
                  Wè Tikè →
                </Link>
                {t.buyerPhone && (
                  <a
                    href={`https://wa.me/${t.buyerPhone.replace(/\D/g,'')}?text=${encodeURIComponent(`Bonjou! Kòd tikè ou: ${t.ticketCode}${t.buyerPin ? ` · PIN: ${t.buyerPin}` : ''}. Wè tikè ou: https://anbyans.events/ticket/${t.ticketCode}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-green-900/30 border border-green-800/40 text-[11px] font-bold text-green-400 hover:bg-green-800/40 transition-all"
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

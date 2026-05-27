'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getEvent, updateEvent, type EventData } from '@/lib/db';

interface Ticket {
  id: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  section: string;
  sectionName?: string;
  price: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  ticketCode: string;
  purchasedAt: any;
  vendorName?: string;
}

export default function AdminEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [event, setEvent]     = useState<EventData | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketSearch, setTicketSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') { router.push('/'); return; }
    load();
  }, [params.id, user, authLoading]);

  async function load() {
    const id = Array.isArray(params.id) ? params.id[0] : params.id as string;
    if (!id) { setLoading(false); return; }
    const [data, ticketSnap] = await Promise.all([
      getEvent(id),
      getDocs(query(collection(db, 'tickets'), where('eventId', '==', id))),
    ]);
    setEvent(data);
    setTickets(ticketSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket)));
    setLoading(false);
  }

  async function toggleStatus() {
    if (!event?.id) return;
    setToggling(true);
    const next = event.status === 'published' ? 'cancelled' : 'published';
    await updateEvent(event.id, { status: next as any });
    setEvent(prev => prev ? { ...prev, status: next as any } : prev);
    setToggling(false);
  }

  if (authLoading || loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!event) return (
    <div className="min-h-screen bg-dark flex items-center justify-center text-white">
      <div className="text-center">
        <p className="text-gray-muted mb-4">Evenman pa jwenn</p>
        <button onClick={() => router.back()} className="text-orange text-sm">← Retounen</button>
      </div>
    </div>
  );

  const validTickets  = tickets.filter(t => t.status !== 'cancelled' && t.status !== 'refunded');
  const grossRevenue  = validTickets.reduce((s, t) => s + (t.price || 0), 0);
  const platformFee   = Math.round(grossRevenue * 0.09);
  const refundedAmt   = tickets.filter(t => t.status === 'refunded').reduce((s, t) => s + (t.price || 0), 0);

  const { totalCap, totalSold } = event.sections?.reduce(
    (acc, s) => ({ totalCap: acc.totalCap + s.capacity, totalSold: acc.totalSold + (s.sold || 0) }),
    { totalCap: 0, totalSold: 0 }
  ) ?? { totalCap: 0, totalSold: 0 };

  const byMethod: Record<string, number> = {};
  validTickets.forEach(t => {
    const m = t.paymentMethod || 'unknown';
    byMethod[m] = (byMethod[m] || 0) + (t.price || 0);
  });

  const filtered = tickets.filter(t => {
    const matchSearch = !ticketSearch ||
      t.buyerName?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.buyerEmail?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.ticketCode?.toLowerCase().includes(ticketSearch.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColors: Record<string, string> = {
    valid: 'bg-green/20 text-green border-green/20',
    used:  'bg-gray-500/20 text-gray-400 border-gray-500/20',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
    pending_cash: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
    pending_verification: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
    cancelled: 'bg-red/20 text-red border-red/20',
    refunded: 'bg-red/20 text-red border-red/20',
  };

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="max-w-4xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-muted hover:text-white text-sm transition-colors">
            ← Retounen
          </button>
          <span className="text-gray-muted">/</span>
          <span className="text-sm text-gray-light truncate">{event.name}</span>
        </div>

        {/* Title + status toggle */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">{event.name}</h1>
            <p className="text-sm text-gray-muted">{event.organizerName || '—'} · {event.startDate}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={event.status} />
            <button onClick={toggleStatus} disabled={toggling}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40 ${
                event.status === 'cancelled'
                  ? 'bg-green/10 text-green border border-green/30'
                  : 'bg-red/10 text-red border border-red/30'
              }`}>
              {toggling ? '…' : event.status === 'cancelled' ? 'Reaktive' : 'Anile'}
            </button>
          </div>
        </div>

        {/* Revenue stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'TIKÈ VANN', val: validTickets.length, sub: `${totalCap} kapasite`, color: 'text-white' },
            { label: 'REVNI BRI', val: '$' + grossRevenue.toLocaleString(), sub: '', color: 'text-white' },
            { label: 'FRÈ PLATFÒM (9%)', val: '$' + platformFee.toLocaleString(), sub: '', color: 'text-orange' },
            { label: 'RANBOUSMAN', val: '$' + refundedAmt.toLocaleString(), sub: `${tickets.filter(t => t.status === 'refunded').length} tikè`, color: 'text-red' },
          ].map(k => (
            <div key={k.label} className="bg-dark-card border border-border rounded-xl p-4">
              <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1">{k.label}</p>
              <p className={`font-heading text-2xl ${k.color}`}>{k.val}</p>
              {k.sub && <p className="text-[10px] text-gray-muted mt-1">{k.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Sections breakdown */}
          <div className="bg-dark-card border border-border rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">SEKSYON</p>
            {event.sections?.map((s, i) => {
              const pct = s.capacity > 0 ? Math.round((s.sold || 0) / s.capacity * 100) : 0;
              return (
                <div key={i} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold">{s.name}</span>
                    <span className="text-gray-muted">{s.sold || 0} / {s.capacity} · ${s.price}</span>
                  </div>
                  <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-orange" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-gray-muted mt-2 pt-2 border-t border-border">
              {totalSold} tikè vann · {totalCap - totalSold} rete
            </p>
          </div>

          {/* Payment methods */}
          <div className="bg-dark-card border border-border rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">METÒD PEMAN</p>
            {Object.entries(byMethod).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([m, amt]) => (
              <div key={m} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold capitalize">
                    {m === 'stripe' ? '💳 Kat' : m === 'moncash' ? '📱 MonCash' : m === 'cash' ? '💵 Kach' : m === 'natcash' ? '💚 Natcash' : m}
                  </span>
                  <span className="text-gray-muted">${(amt as number).toLocaleString()} ({grossRevenue > 0 ? Math.round((amt as number) / grossRevenue * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-orange" style={{ width: `${grossRevenue > 0 ? Math.round((amt as number) / grossRevenue * 100) : 0}%` }} />
                </div>
              </div>
            ))}
            {Object.keys(byMethod).length === 0 && <p className="text-gray-muted text-xs py-4 text-center">Okenn tikè ankò</p>}
          </div>
        </div>

        {/* Attendee list */}
        <div className="bg-dark-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-widest text-orange font-bold">MOUN KI ACHTE ({tickets.length})</p>
            <div className="flex gap-2">
              {['all','valid','pending','used','cancelled','refunded'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${statusFilter === s ? 'bg-orange text-black' : 'bg-white/[0.05] text-gray-muted hover:text-white'}`}>
                  {s === 'all' ? 'Tout' : s}
                </button>
              ))}
            </div>
          </div>

          <input
            value={ticketSearch}
            onChange={e => setTicketSearch(e.target.value)}
            placeholder="Chèche pa non, imèl, oswa kòd tikè…"
            className="w-full px-3 py-2.5 rounded-xl bg-dark border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted mb-3"
          />

          {filtered.length === 0 ? (
            <p className="text-gray-muted text-center py-8 text-sm">Okenn rezilta</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-black flex-shrink-0">
                    {t.buyerName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{t.buyerName}</p>
                    <p className="text-[11px] text-gray-muted truncate">
                      {t.buyerEmail} {t.buyerPhone ? '· ' + t.buyerPhone : ''}
                    </p>
                    <p className="text-[10px] text-gray-muted mt-0.5">
                      {t.sectionName || t.section} ·{' '}
                      {t.paymentMethod === 'stripe' ? '💳' : t.paymentMethod === 'moncash' ? '📱' : t.paymentMethod === 'cash' ? '💵' : '💳'}{' '}
                      {t.vendorName ? `via ${t.vendorName}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold">${t.price}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusColors[t.status] || 'bg-white/5 text-gray-400 border-border'}`}>
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: 'bg-green/20 text-green border-green/20',
    live:      'bg-green/20 text-green border-green/20',
    cancelled: 'bg-red/20 text-red border-red/20',
    ended:     'bg-gray-500/20 text-gray-400 border-gray-500/20',
    draft:     'bg-orange/20 text-orange border-orange/20',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${map[status] ?? 'bg-orange/20 text-orange border-orange/20'}`}>
      {status}
    </span>
  );
}

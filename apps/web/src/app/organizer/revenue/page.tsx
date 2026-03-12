'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { getOrganizerEvents } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface VendorData {
  id: string;
  name: string;
  organizerId: string;
}

interface VendorPurchase {
  id: string;
  vendorId: string;
  vendorName: string;
  eventId: string;
  qty: number;
  sold: number;
  priceEach: number;
  totalPaid: number;
}

export default function OrganizerRevenuePage() {
  const { user } = useAuth();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [vendorPurchases, setVendorPurchases] = useState<VendorPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      try {
        const evs = await getOrganizerEvents(user.uid);
        const tickets: any[] = [];
        await Promise.all(evs.map(async (e) => {
          if (!e.id) return;
          const snap = await getDocs(collection(db, 'events', e.id, 'tickets'));
          snap.docs.forEach(d => tickets.push({ id: d.id, eventId: e.id, ...d.data() }));
        }));
        setAllTickets(tickets);

        const vSnap = await getDocs(query(collection(db, 'vendors'), where('organizerId', '==', user.uid)));
        const vList = vSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorData));
        setVendors(vList);

        const vpSnap = await getDocs(query(collection(db, 'vendorPurchases'), where('organizerId', '==', user.uid)));
        setVendorPurchases(vpSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPurchase)));
      } catch (err) {
        console.error('revenue load', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  const validTickets = allTickets.filter(t => t.status !== 'cancelled' && t.status !== 'refunded');
  const totalRevenue = validTickets.reduce((a, t) => a + (t.price || 0), 0);
  const vendorTicketRevenue = validTickets.filter(t => t.vendorId).reduce((a, t) => a + (t.price || 0), 0);
  const onlineRevenue = totalRevenue - vendorTicketRevenue;

  const vendorStats = vendors.map(v => {
    const purchases = vendorPurchases.filter(vp => vp.vendorId === v.id);
    const totalVSold = purchases.reduce((a, vp) => a + vp.sold, 0);
    const totalOwed = purchases.reduce((a, vp) => a + vp.sold * vp.priceEach, 0);
    return { ...v, totalVSold, totalOwed };
  });
  const totalVendorOwed = vendorStats.reduce((a, v) => a + v.totalOwed, 0);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: L('REVNI TOTAL', 'TOTAL REVENUE', 'REVENU TOTAL'),         value: `$${totalRevenue.toLocaleString()}` },
          { label: L('VANT ONLINE', 'ONLINE SALES', 'VENTES EN LIGNE'),        value: `$${onlineRevenue.toLocaleString()}`,        sub: totalRevenue > 0 ? `${Math.round(onlineRevenue / totalRevenue * 100)}% total` : '—', color: 'text-green' },
          { label: L('VANT REVANDÈ', 'RESELLER SALES', 'VENTES REVENDEURS'),  value: `$${vendorTicketRevenue.toLocaleString()}`,  sub: totalRevenue > 0 ? `${Math.round(vendorTicketRevenue / totalRevenue * 100)}% total` : '—', color: 'text-orange' },
          { label: L('REVANDÈ DWE', 'RESELLERS OWE', 'REVENDEURS DWE'),       value: `$${totalVendorOwed.toLocaleString()}`,      color: totalVendorOwed > 0 ? 'text-orange' : 'text-green' },
        ].map((s, i) => (
          <div key={i} className="bg-dark-card border border-border rounded-card p-4">
            <p className="text-[10px] text-gray-muted uppercase tracking-widest mb-1.5">{s.label}</p>
            <p className={`font-heading text-3xl tracking-wide ${s.color || ''}`}>{s.value}</p>
            {s.sub && <p className={`text-[10px] mt-1 ${s.color || 'text-gray-muted'}`}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Vendor balance table */}
      <div className="bg-dark-card border border-border rounded-card p-5">
        <h3 className="font-heading text-lg tracking-wide mb-4">{L('BALANS REVANDÈ', 'RESELLER BALANCES', 'BALANCES REVENDEURS')}</h3>
        {vendorStats.length === 0 ? (
          <p className="text-gray-muted text-sm text-center py-8">{L('Pa gen revandè ankò.', 'No resellers yet.', 'Aucun revendeur pour l\'instant.')}</p>
        ) : (
          <div className="space-y-2">
            {vendorStats.map(v => (
              <div key={v.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <span className="text-base">🏪</span>
                <p className="text-xs font-semibold flex-1">{v.name}</p>
                <p className="text-xs text-gray-light">{v.totalVSold} {L('tikè vann', 'tickets sold', 'billets vendus')}</p>
                {v.totalOwed > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-orange">${v.totalOwed.toLocaleString()}</span>
                    <button className="px-2.5 py-1 rounded-lg bg-orange text-white text-[9px] font-bold hover:bg-orange/80 transition-all">
                      {L('Mande', 'Request', 'Demander')}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-green">✓ {L('Regle', 'Settled', 'Réglé')}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
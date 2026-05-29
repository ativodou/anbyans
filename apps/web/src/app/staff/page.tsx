'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getStaffAssignments, getEvent, clockIn, clockOut, type StaffAssignmentDoc } from '@/lib/db';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ROLE_ICONS: Record<string, string> = {
  scanner: '📱', door: '🚪', sales: '💰', security: '🛡️', fb: '🍽️', manager: '🧑‍💼',
};
const ROLE_HT: Record<string, string> = {
  scanner: 'Eskanè', door: 'Pòt', sales: 'Vant', security: 'Sekirite', fb: 'Manje & Bweson', manager: 'Manadjè',
};

interface EnrichedAssignment extends StaffAssignmentDoc {
  eventName?: string;
  eventDate?: string;
  eventStatus?: string;
}

type AssignmentStatus = 'today' | 'upcoming' | 'past';

function getAssignmentStatus(eventDate: string | undefined): AssignmentStatus {
  if (!eventDate) return 'upcoming';
  const today = new Date().toISOString().slice(0, 10);
  if (eventDate === today) return 'today';
  if (eventDate > today) return 'upcoming';
  return 'past';
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
  const [poolInfo, setPoolInfo] = useState<{ organizerName?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      setLoading(true);
      try {
        // Get pool info
        const poolSnap = await getDocs(
          query(collection(db, 'staffPool'), where('uid', '==', user.uid))
        );
        if (!poolSnap.empty) {
          const pd = poolSnap.docs[0].data();
          setPoolInfo({ organizerName: pd.organizerName, role: pd.role });
        }

        // Get assignments
        const raw = await getStaffAssignments(user.uid);
        const enriched: EnrichedAssignment[] = await Promise.all(
          raw.map(async a => {
            try {
              const ev = await getEvent(a.eventId);
              return {
                ...a,
                eventName: ev?.name ?? 'Evènman',
                eventDate: ev?.startDate,
                eventStatus: ev?.status,
              };
            } catch {
              return { ...a };
            }
          })
        );
        // Sort: today first, then upcoming, then past
        enriched.sort((a, b) => {
          const order = { today: 0, upcoming: 1, past: 2 };
          return order[getAssignmentStatus(a.eventDate)] - order[getAssignmentStatus(b.eventDate)];
        });
        setAssignments(enriched);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const handleClockIn = async (id: string) => {
    setClockLoading(id);
    try {
      await clockIn(id);
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, clockedIn: new Date(), clockedOut: null } : a));
    } finally {
      setClockLoading(null);
    }
  };

  const handleClockOut = async (id: string) => {
    setClockLoading(id);
    try {
      await clockOut(id);
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, clockedOut: new Date() } : a));
    } finally {
      setClockLoading(null);
    }
  };

  const firstName = (user as any)?.firstName || user?.email?.split('@')[0] || 'Staff';
  const activeAssignments = assignments.filter(a => getAssignmentStatus(a.eventDate) !== 'past');
  const pastAssignments = assignments.filter(a => getAssignmentStatus(a.eventDate) === 'past');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-black">
          Bonjou, <span className="text-orange">{firstName}</span> 👋
        </h1>
        {poolInfo?.role && (
          <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-orange/10 border border-orange/30 text-xs font-bold text-orange">
            {ROLE_ICONS[poolInfo.role] || '👤'} {ROLE_HT[poolInfo.role] || poolInfo.role}
          </span>
        )}
      </div>

      {/* Team card */}
      {poolInfo && (
        <div className="bg-dark-card border border-border rounded-card p-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-muted font-bold mb-2">Ekip Mwen</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange/10 rounded-xl flex items-center justify-center text-xl">
              {ROLE_ICONS[poolInfo.role || ''] || '👥'}
            </div>
            <div>
              {poolInfo.organizerName && (
                <p className="font-bold">{poolInfo.organizerName}</p>
              )}
              <p className="text-xs text-gray-muted">{ROLE_HT[poolInfo.role || ''] || poolInfo.role || 'Manm Ekip'}</p>
            </div>
            <span className="ml-auto text-[10px] bg-green/10 text-green border border-green/30 px-2 py-0.5 rounded-full font-bold">
              ✓ Aktif
            </span>
          </div>
        </div>
      )}

      {/* Assignments */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-muted font-bold mb-3">Misyon Mwen</p>

        {activeAssignments.length === 0 && pastAssignments.length === 0 ? (
          <div className="bg-dark-card border border-border rounded-card p-10 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-muted text-sm">
              Ou poko gen okenn misyon. Tann envitasyon nan ekip ou a.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAssignments.map(a => {
              const status = getAssignmentStatus(a.eventDate);
              const isClockedIn = !!a.clockedIn && !a.clockedOut;
              const isToday = status === 'today';

              return (
                <div key={a.id} className={`bg-dark-card border rounded-card p-4 transition-all ${
                  isToday ? 'border-orange/40' : 'border-border'
                }`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-bold">{a.eventName}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {a.eventDate && (
                          <span className="text-[10px] text-gray-muted">📅 {a.eventDate}</span>
                        )}
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          isToday ? 'bg-orange/20 text-orange' :
                          status === 'upcoming' ? 'bg-cyan/10 text-cyan' :
                          'bg-white/5 text-gray-muted'
                        }`}>
                          {isToday ? "Jodi a" : status === 'upcoming' ? 'Pwochen' : 'Fini'}
                        </span>
                        {a.active && (
                          <span className="text-[9px] bg-green/10 text-green border border-green/30 px-1.5 py-0.5 rounded font-bold">
                            Aktive
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] bg-white/5 px-2 py-1 rounded font-bold">
                        {ROLE_ICONS[a.role] || '👤'} {ROLE_HT[a.role] || a.role}
                      </span>
                      {a.agreedPay != null && (
                        <p className="text-xs text-green font-bold mt-1">💰 ${a.agreedPay}</p>
                      )}
                    </div>
                  </div>

                  {/* Clock in/out for today's active assignments */}
                  {isToday && a.active && (
                    <div className="flex gap-2 flex-wrap">
                      {!isClockedIn ? (
                        <button
                          onClick={() => handleClockIn(a.id!)}
                          disabled={clockLoading === a.id}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green text-white font-bold text-xs disabled:opacity-50 hover:bg-green/80 transition-all"
                        >
                          🟢 {clockLoading === a.id ? '...' : 'Clock In'}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleClockOut(a.id!)}
                            disabled={clockLoading === a.id}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red/80 text-white font-bold text-xs disabled:opacity-50 hover:bg-red transition-all"
                          >
                            🔴 {clockLoading === a.id ? '...' : 'Clock Out'}
                          </button>
                          <button
                            onClick={() => router.push(`/organizer/scanner?event=${a.eventId}&staffId=${user?.uid}`)}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange/10 border border-orange/40 text-orange font-bold text-xs hover:bg-orange/20 transition-all"
                          >
                            Ale nan zouti mwen →
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past assignments */}
      {pastAssignments.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-muted font-bold mb-3 hover:text-white transition-colors"
          >
            Evènman Pase ({pastAssignments.length}) {showPast ? '▲' : '▼'}
          </button>

          {showPast && (
            <div className="space-y-2">
              {pastAssignments.map(a => (
                <div key={a.id} className="bg-dark-card border border-border rounded-card p-3.5 flex items-center gap-3 opacity-70">
                  <span className="text-base">{ROLE_ICONS[a.role] || '👤'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{a.eventName}</p>
                    <p className="text-[10px] text-gray-muted">{a.eventDate}</p>
                  </div>
                  {a.agreedPay != null && (
                    <span className="text-xs text-green font-bold">💰 ${a.agreedPay}</span>
                  )}
                  <span className="text-[9px] bg-white/5 text-gray-muted px-2 py-0.5 rounded font-bold">Fini</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

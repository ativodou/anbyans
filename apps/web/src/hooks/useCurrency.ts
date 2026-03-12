'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface CurrencySettings {
  exchangeRate: number;
  defaultCurrency: 'USD' | 'HTG';
}

// ── Singleton cache ──────────────────────────────────────────────
let cachedRate: number = 130;
let cachedDefault: 'USD' | 'HTG' = 'USD';
let listeners: Array<(s: CurrencySettings) => void> = [];
let unsubscribe: (() => void) | null = null;

function subscribeToRate(uid: string, cb: (s: CurrencySettings) => void) {
  listeners.push(cb);
  cb({ exchangeRate: cachedRate, defaultCurrency: cachedDefault });

  if (!unsubscribe) {
    unsubscribe = onSnapshot(doc(db, 'organizers', uid), snap => {
      if (snap.exists()) {
        cachedRate    = snap.data().exchangeRate    || 130;
        cachedDefault = snap.data().defaultCurrency || 'USD';
        listeners.forEach(l => l({ exchangeRate: cachedRate, defaultCurrency: cachedDefault }));
      }
    });
  }

  return () => {
    listeners = listeners.filter(l => l !== cb);
    if (listeners.length === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

// ── Hook ─────────────────────────────────────────────────────────
export function useCurrency(uid?: string) {
  const [rate, setRate]     = useState(cachedRate);
  const [defCur, setDefCur] = useState(cachedDefault);

  useEffect(() => {
    if (!uid) return;
    return subscribeToRate(uid, s => {
      setRate(s.exchangeRate);
      setDefCur(s.defaultCurrency);
    });
  }, [uid]);

  const fmt = (usd: number) => {
    const htgAmount = Math.round(usd * rate);
    const usdStr = `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const htgStr = `${htgAmount.toLocaleString('fr-HT')} HTG`;
    return {
      usd:       usdStr,
      htg:       htgStr,
      both:      `${usdStr} · ${htgStr}`,
      primary:   defCur === 'USD' ? usdStr : htgStr,
      secondary: defCur === 'USD' ? htgStr : usdStr,
      raw:       usd,
      rawHtg:    htgAmount,
    };
  };

  return { rate, defaultCurrency: defCur, fmt };
}

// ── PriceDisplay component ────────────────────────────────────────
// Renders USD in green and HTG in red, same size, side by side
export function PriceDisplay({
  usd,
  fmt,
  className = 'text-sm',
}: {
  usd: number;
  fmt: ReturnType<typeof useCurrency>['fmt'];
  className?: string;
}) {
  const p = fmt(usd);
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${className}`}>
      <span className="text-green">{p.usd}</span>
      <span className="text-white/20">·</span>
      <span className="text-red-400">{p.htg}</span>
    </span>
  );
}

// ── Standalone formatter ──────────────────────────────────────────
export function formatDualPrice(usd: number, rate = cachedRate) {
  const htg = Math.round(usd * rate);
  return {
    usd:  `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    htg:  `${htg.toLocaleString('fr-HT')} HTG`,
    both: `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${htg.toLocaleString('fr-HT')} HTG`,
  };
}
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface CurrencySettings {
  exchangeRate: number;        // 1 USD = X HTG
  defaultCurrency: 'USD' | 'HTG';
}

// ── Singleton cache so multiple components don't each open a listener ──
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

// ── Hook ──
export function useCurrency(uid?: string) {
  const [rate, setRate]       = useState(cachedRate);
  const [defCur, setDefCur]   = useState(cachedDefault);

  useEffect(() => {
    if (!uid) return;
    return subscribeToRate(uid, s => {
      setRate(s.exchangeRate);
      setDefCur(s.defaultCurrency);
    });
  }, [uid]);

  // Format a USD amount as dual display
  const fmt = (usd: number): { usd: string; htg: string; both: string; primary: string; secondary: string } => {
    const htgAmount = Math.round(usd * rate);
    const usdStr = `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const htgStr = `${htgAmount.toLocaleString('fr-HT')} HTG`;

    return {
      usd:       usdStr,
      htg:       htgStr,
      both:      `${usdStr} · ${htgStr}`,
      primary:   defCur === 'USD' ? usdStr : htgStr,
      secondary: defCur === 'USD' ? htgStr : usdStr,
    };
  };

  return { rate, defaultCurrency: defCur, fmt };
}

// ── Standalone formatter (no hook, for use in non-component contexts) ──
export function formatDualPrice(usd: number, rate = cachedRate): { usd: string; htg: string; both: string } {
  const htg = Math.round(usd * rate);
  return {
    usd:  `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    htg:  `${htg.toLocaleString('fr-HT')} HTG`,
    both: `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${htg.toLocaleString('fr-HT')} HTG`,
  };
}
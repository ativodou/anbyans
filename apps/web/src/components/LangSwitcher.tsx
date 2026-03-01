'use client';

import { useState, useRef, useEffect } from 'react';
import { useT, LOCALE_LABELS, LOCALE_FLAGS, Locale } from '../i18n';

const LOCALES: Locale[] = ['ht', 'en', 'fr'];

export default function LangSwitcher() {
  const { locale, setLocale } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-bold text-gray-light hover:text-white hover:border-white/[0.15] transition-all"
      >
        <span>{LOCALE_FLAGS[locale]}</span>
        <span>{locale.toUpperCase()}</span>
        <span className="text-[9px] text-gray-muted">▼</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-dark-card border border-border rounded-xl overflow-hidden shadow-xl z-50 min-w-[140px]">
          {LOCALES.map(l => (
            <button
              key={l}
              onClick={() => { setLocale(l); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs transition-all ${
                locale === l
                  ? 'bg-white/[0.06] text-white font-bold'
                  : 'text-gray-light hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <span className="text-base">{LOCALE_FLAGS[l]}</span>
              <span>{LOCALE_LABELS[l]}</span>
              {locale === l && <span className="ml-auto text-cyan text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

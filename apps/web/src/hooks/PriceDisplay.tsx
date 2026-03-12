'use client';

import { type FmtFn } from './useCurrency';

// USD in green · HTG in red · same size
export function PriceDisplay({
  usd,
  fmt,
  className = 'text-sm',
}: {
  usd: number;
  fmt: FmtFn;
  className?: string;
}) {
  const p = fmt(usd);
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${className}`}>
      <span className="text-green">{p.usd}</span>
      <span className="opacity-20">·</span>
      <span className="text-red-400">{p.htg}</span>
    </span>
  );
}
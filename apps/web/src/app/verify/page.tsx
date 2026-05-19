'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useT } from '@/i18n';
import { verifyTicketByCode, type TicketData, type EventData } from '@/lib/db';

export default function VerifyPage() {
  const { t } = useT();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; ticket?: TicketData; event?: EventData; error?: string } | null>(null);

  async function handleVerify() {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await verifyTicketByCode(code.trim());
      setResult(res);
    } catch {
      setResult({ valid: false, error: 'Verification failed' });
    }
    setLoading(false);
  }

  const statusMap: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    valid: { color: '#22c55e', bg: '#0a2a0a', icon: '✅', label: t('verify_status_valid') },
    used: { color: '#f97316', bg: '#2a1a00', icon: '⚠️', label: t('verify_status_used') },
    cancelled: { color: '#ef4444', bg: '#2a0a0a', icon: '❌', label: t('verify_status_cancelled') },
    refunded: { color: '#888', bg: '#1a1a1a', icon: '↩️', label: t('verify_status_refunded') },
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff' }}>
      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0f', borderBottom: '1px solid #1e1e2e', padding: '0 16px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', height: 56, gap: 12 }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: 15, letterSpacing: 2, color: '#fff', textDecoration: 'none' }}>ANBYANS</Link>
          <span style={{ flex: 1 }} />
          <Link href="/events" style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #1e1e2e', color: '#888', fontSize: 11, textDecoration: 'none' }}>
            🎫 {t('verify_events_link')}
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
            {t('verify_title')}
          </h1>
          <p style={{ color: '#888', fontSize: 13, lineHeight: 1.5 }}>
            {t('verify_desc')}
          </p>
        </div>

        {/* Search */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <label style={{ color: '#888', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
            {t('verify_code_label')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="ANB-XXXXXXXX"
              style={{
                flex: 1, padding: 14, borderRadius: 8,
                border: '1px solid #1e1e2e', background: '#0a0a0f',
                color: '#fff', fontSize: 18, fontWeight: 800,
                fontFamily: 'monospace', letterSpacing: 2,
                textAlign: 'center', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleVerify}
              disabled={!code.trim() || loading}
              style={{
                padding: '14px 24px', borderRadius: 8, border: 'none',
                background: code.trim() ? '#06b6d4' : '#333',
                color: code.trim() ? '#000' : '#666',
                fontSize: 14, fontWeight: 700,
                cursor: code.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? '...' : t('verify_btn')}
            </button>
          </div>
        </div>

        {/* Result */}
        {result && !result.valid && (
          <div style={{
            background: '#2a0a0a', border: '1px solid #ef4444', borderRadius: 12,
            padding: 24, textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>
              {t('verify_not_found_title')}
            </h2>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
              {t('verify_not_found_desc')}
            </p>
            <div style={{ padding: '10px 16px', borderRadius: 8, background: '#ef444415', display: 'inline-block' }}>
              <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700 }}>
                ⚠️ {t('verify_fake_warning')}
              </span>
            </div>
          </div>
        )}

        {result && result.valid && result.ticket && (() => {
          const tk = result.ticket;
          const ev = result.event;
          const s = statusMap[tk.status] || statusMap.valid;
          return (
            <div style={{
              background: s.bg, border: `1px solid ${s.color}40`, borderRadius: 12,
              padding: 24, textAlign: 'center',
            }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{s.icon}</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: s.color, marginBottom: 4 }}>
                {s.label}
              </h2>

              {/* Verified badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 20,
                background: '#06b6d415', border: '1px solid #06b6d440',
                marginBottom: 16,
              }}>
                <span style={{ fontSize: 12 }}>🛡️</span>
                <span style={{ color: '#06b6d4', fontSize: 10, fontWeight: 700 }}>
                  {t('verify_badge')}
                </span>
              </div>

              {/* Event info */}
              {ev && (
                <div style={{
                  background: '#0a0a0f', borderRadius: 10, padding: 16, marginBottom: 16,
                  border: '1px solid #1e1e2e',
                }}>
                  <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{ev.name}</p>
                  <p style={{ color: '#888', fontSize: 12 }}>
                    📍 {ev.venue?.name} · 📅 {ev.startDate} · 🕐 {ev.startTime}
                  </p>
                </div>
              )}

              {/* Ticket details */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                textAlign: 'left', marginBottom: 16,
              }}>
                <div style={{ background: '#0a0a0f', borderRadius: 8, padding: 12, border: '1px solid #1e1e2e' }}>
                  <div style={{ color: '#888', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    {t('verify_section_label')}
                  </div>
                  <div style={{ fontWeight: 700, color: tk.sectionColor || '#fff' }}>{tk.section}</div>
                </div>
                <div style={{ background: '#0a0a0f', borderRadius: 8, padding: 12, border: '1px solid #1e1e2e' }}>
                  <div style={{ color: '#888', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    {t('verify_seat_label')}
                  </div>
                  <div style={{ fontWeight: 700 }}>{tk.seat}</div>
                </div>
                <div style={{ background: '#0a0a0f', borderRadius: 8, padding: 12, border: '1px solid #1e1e2e' }}>
                  <div style={{ color: '#888', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    {t('verify_bought_by')}
                  </div>
                  <div style={{ fontWeight: 700 }}>{tk.buyerName}</div>
                </div>
                <div style={{ background: '#0a0a0f', borderRadius: 8, padding: 12, border: '1px solid #1e1e2e' }}>
                  <div style={{ color: '#888', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    {t('verify_status_label')}
                  </div>
                  <div style={{ fontWeight: 700, color: s.color }}>{s.label}</div>
                </div>
              </div>

              {/* Ticket code */}
              <div style={{
                padding: '8px 16px', borderRadius: 8,
                background: '#0a0a0f', border: '1px solid #1e1e2e',
                display: 'inline-block',
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 800, letterSpacing: 2 }}>
                  {tk.ticketCode}
                </span>
              </div>

              {tk.status === 'used' && tk.usedAt && (
                <p style={{ color: '#888', fontSize: 11, marginTop: 12 }}>
                  {t('verify_used_by')}: {tk.usedBy || '—'}
                </p>
              )}
            </div>
          );
        })()}

        {/* Footer info */}
        <div style={{ textAlign: 'center', marginTop: 32, color: '#555', fontSize: 11, lineHeight: 1.8 }}>
          <p>{t('verify_authentic_only')}</p>
          <p style={{ marginTop: 8 }}>
            🛡️ {t('verify_protected')}
          </p>
        </div>
      </div>
    </div>
  );
}

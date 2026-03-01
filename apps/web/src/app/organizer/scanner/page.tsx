'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/i18n';
import LangSwitcher from '@/components/LangSwitcher';

interface ScanResult {
  id: string; status: 'valid' | 'used' | 'invalid' | 'wrong-event';
  name: string; event: string; section: string; sectionColor: string;
  seat: string; time: string; ticketId: string;
}

const SCAN_HISTORY: ScanResult[] = [
  { id:'1', status:'valid', name:'Marie Joseph', event:'Kompa Fest 2026', section:'VIP', sectionColor:'#FF6B35', seat:'V-042', time:'8:31 PM', ticketId:'ANB-KF26-V042' },
  { id:'2', status:'valid', name:'Roberto Charles', event:'Kompa Fest 2026', section:'GA', sectionColor:'#00D4FF', seat:'GA-188', time:'8:28 PM', ticketId:'ANB-KF26-G188' },
  { id:'3', status:'used', name:'Patrick Denis', event:'Kompa Fest 2026', section:'GA', sectionColor:'#00D4FF', seat:'GA-045', time:'8:25 PM', ticketId:'ANB-KF26-G045' },
  { id:'4', status:'valid', name:'Sophia Bernard', event:'Kompa Fest 2026', section:'VVIP', sectionColor:'#FFD700', seat:'VV-008', time:'8:22 PM', ticketId:'ANB-KF26-VV08' },
  { id:'5', status:'wrong-event', name:'Jacques Martin', event:'DJ Stéphane Live', section:'GA', sectionColor:'#00D4FF', seat:'GA-012', time:'8:18 PM', ticketId:'ANB-DS26-G012' },
];

export default function ScannerPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale]);

  const STATUS_MAP = {
    'valid': { bg:'bg-green', border:'border-green', text:'text-green', dim:'bg-green-dim', icon:'✅', label:t('scanner_valid') },
    'used': { bg:'bg-orange', border:'border-orange', text:'text-orange', dim:'bg-orange-dim', icon:'⚠️', label:t('scanner_used') },
    'invalid': { bg:'bg-red', border:'border-red', text:'text-red', dim:'bg-red/10', icon:'❌', label:t('scanner_invalid') },
    'wrong-event': { bg:'bg-red', border:'border-red', text:'text-red', dim:'bg-red/10', icon:'🚫', label:t('scanner_wrong_event') },
  };

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [selectedEvent, setSelectedEvent] = useState('Kompa Fest 2026');
  const [history, setHistory] = useState(SCAN_HISTORY);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const stats = {
    scanned: history.filter(h => h.status === 'valid').length,
    denied: history.filter(h => h.status !== 'valid').length,
    total: history.length,
  };

  const simulateScan = () => {
    setScanning(true);
    setTimeout(() => {
      const statuses: ScanResult['status'][] = ['valid','valid','valid','used','invalid'];
      const s = statuses[Math.floor(Math.random() * statuses.length)];
      const r: ScanResult = {
        id: Date.now().toString(), status: s,
        name: ['Anel Pierre','Claudia M.','Frantz J.','Rosa L.','Kevin B.'][Math.floor(Math.random()*5)],
        event: selectedEvent, section: ['VIP','GA','VVIP'][Math.floor(Math.random()*3)],
        sectionColor: ['#FF6B35','#00D4FF','#FFD700'][Math.floor(Math.random()*3)],
        seat: `${['V','GA','VV'][Math.floor(Math.random()*3)]}-${String(Math.floor(Math.random()*200)+1).padStart(3,'0')}`,
        time: new Date().toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'}),
        ticketId: `ANB-${Date.now().toString().slice(-6)}`,
      };
      setResult(r);
      setHistory(prev => [r, ...prev]);
      setScanning(false);
    }, 1500);
  };

  const manualLookup = () => {
    if (!manualCode) return;
    const r: ScanResult = {
      id: Date.now().toString(), status: 'valid',
      name: 'Manual Lookup', event: selectedEvent, section: 'GA',
      sectionColor: '#00D4FF', seat: 'GA-???',
      time: new Date().toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'}),
      ticketId: manualCode.toUpperCase(),
    };
    setResult(r);
    setHistory(prev => [r, ...prev]);
    setManualCode('');
    setShowManual(false);
  };

  const st = result ? STATUS_MAP[result.status] : null;

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      <nav className="sticky top-0 z-50 bg-dark border-b border-border px-5">
        <div className="max-w-[600px] mx-auto flex items-center h-14 gap-3">
          <button onClick={() => router.back()} className="text-gray-light text-xs hover:text-white transition-colors">← {t('back')}</button>
          <div className="w-px h-5 bg-border" />
          <span className="font-heading text-lg tracking-wide flex-1">📷 {t('scanner_title')}</span>
          <LangSwitcher />
          <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-orange-border text-orange text-[11px] font-bold outline-none">
            <option className="bg-dark-card">Kompa Fest 2026</option>
            <option className="bg-dark-card">DJ Stéphane Live</option>
          </select>
        </div>
      </nav>

      <div className="max-w-[600px] mx-auto w-full px-5 py-5 flex-1">
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-dark-card border border-border rounded-card p-3 text-center">
            <p className="text-[9px] text-gray-muted uppercase">{t('scanner_scanned')}</p>
            <p className="font-heading text-2xl">{stats.total}</p>
          </div>
          <div className="bg-dark-card border border-border rounded-card p-3 text-center">
            <p className="text-[9px] text-gray-muted uppercase">{t('scanner_admitted')}</p>
            <p className="font-heading text-2xl text-green">{stats.scanned}</p>
          </div>
          <div className="bg-dark-card border border-border rounded-card p-3 text-center">
            <p className="text-[9px] text-gray-muted uppercase">{t('scanner_denied')}</p>
            <p className="font-heading text-2xl text-red">{stats.denied}</p>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden border-2 border-border bg-black/40 mb-4" style={{aspectRatio:'4/3'}}>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {scanning ? (
              <>
                <div className="w-48 h-48 border-2 border-orange rounded-xl animate-pulse" />
                <p className="text-sm text-orange mt-3 animate-pulse">{L('Ap eskane...','Scanning...','Scan en cours...')}</p>
              </>
            ) : result ? (
              <div className={`text-center p-5 rounded-2xl ${st?.dim} border ${st?.border} max-w-xs`}>
                <div className="text-5xl mb-2">{st?.icon}</div>
                <p className={`font-heading text-2xl tracking-wide mb-1 ${st?.text}`}>{st?.label}</p>
                <p className="text-sm font-bold text-white">{result.name}</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold border" style={{color:result.sectionColor, borderColor:result.sectionColor, background:result.sectionColor+'15'}}>{result.section}</span>
                  <span className="text-[10px] text-gray-light">{L('Plas','Seat','Place')} {result.seat}</span>
                </div>
                <p className="text-[10px] text-gray-muted mt-1 font-mono">{result.ticketId}</p>
              </div>
            ) : (
              <>
                <div className="w-48 h-48 border-2 border-dashed border-gray-muted rounded-xl flex items-center justify-center">
                  <span className="text-4xl">📷</span>
                </div>
                <p className="text-xs text-gray-muted mt-3">{L('Peze bouton an pou eskane QR code','Press button to scan QR code','Appuyez pour scanner le QR code')}</p>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3 mb-5">
          <button onClick={() => { setResult(null); simulateScan(); }}
            className="flex-1 py-4 rounded-xl bg-orange text-white font-bold text-sm hover:bg-orange/80 transition-all">
            {result ? `📷 ${L('Eskane Ankò','Scan Again','Scanner encore')}` : `📷 ${L('Eskane QR Code','Scan QR Code','Scanner QR Code')}`}
          </button>
          <button onClick={() => setShowManual(!showManual)}
            className="px-5 py-4 rounded-xl border border-border text-gray-light font-bold text-sm hover:text-white transition-all">
            ⌨️
          </button>
        </div>

        {showManual && (
          <div className="bg-dark-card border border-border rounded-xl p-4 mb-5">
            <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-2">{t('scanner_manual')}</p>
            <div className="flex gap-2">
              <input value={manualCode} onChange={e => setManualCode(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-border text-white text-sm font-mono outline-none focus:border-orange placeholder:text-gray-muted"
                placeholder={t('scanner_manual_placeholder')} />
              <button onClick={manualLookup} className="px-5 py-2.5 rounded-lg bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all">{t('search')}</button>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs font-bold text-gray-light mb-3">{t('scanner_history')}</h3>
          <div className="space-y-2">
            {history.slice(0, 20).map(h => {
              const s = STATUS_MAP[h.status];
              return (
                <div key={h.id} className={`flex items-center gap-3 p-3 rounded-xl border ${s.border} ${s.dim}`}>
                  <span className="text-base">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{h.name}</p>
                    <p className="text-[10px] text-gray-muted">
                      <span style={{color:h.sectionColor}}>{h.section}</span> · {h.seat} · <span className="font-mono">{h.ticketId}</span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-[10px] font-bold ${s.text}`}>{s.label}</p>
                    <p className="text-[9px] text-gray-muted">{h.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

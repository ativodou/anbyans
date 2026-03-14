'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'next/navigation';
import { useT } from '@/i18n';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getOrganizerEvents, type EventData, updateOrganizerLogo, getOrganizerLogo } from '@/lib/db';
import { compressLogo } from '@/lib/compressImage';

interface PaymentMethod {
  key: string;
  icon: string;
  name: string;
  fields: string[];
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { key: 'moncash',  icon: '📱', name: 'MonCash',  fields: ['Nimewo MonCash', 'Non sou kont lan'] },
  { key: 'natcash',  icon: '💚', name: 'Natcash',  fields: ['Nimewo Natcash', 'Non sou kont lan'] },
  { key: 'stripe',   icon: '💳', name: 'Stripe (Kart / Card)', fields: [] },
  { key: 'zelle',    icon: '⚡', name: 'Zelle',    fields: ['Imèl oswa Telefòn Zelle', 'Non sou kont lan'] },
  { key: 'paypal',   icon: '🅿️', name: 'PayPal',   fields: ['Imèl PayPal'] },
  { key: 'cashapp',  icon: '💲', name: 'Cash App', fields: ['$cashtag'] },
];

type SettingsTab = 'profile' | 'payments' | 'scanner' | 'staff' | 'notifications';

function SectionCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-dark-card border border-border rounded-card p-5 mb-5">
      <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-1">{title}</p>
      {sub && <p className="text-[10px] text-gray-light mb-4">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </div>
  );
}

function Toggle({ label, hint, value, onChange, warn }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div>
        <p className={`text-[12px] font-semibold ${warn ? 'text-orange' : 'text-white'}`}>{label}</p>
        {hint && <p className="text-[10px] text-gray-muted">{hint}</p>}
      </div>
      <button onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-all flex-shrink-0 relative ${value ? (warn ? 'bg-orange' : 'bg-green-500') : 'bg-white/[0.1]'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export default function OrganizerSettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [events, setEvents]       = useState<EventData[]>([]);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  // ── Profile ──
  const [bizName, setBizName]   = useState('');
  const [logoURL, setLogoURL]   = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [email, setEmail]       = useState(user?.email || '');
  const [phone, setPhone]       = useState('');
  const [website, setWebsite]   = useState('');

  // ── Payments ──
  const [paymentActive, setPaymentActive]   = useState<Record<string, boolean>>({ moncash: true });
  const [paymentValues, setPaymentValues]   = useState<Record<string, string[]>>({});
  const [defaultCurrency, setDefaultCurrency] = useState<'USD' | 'HTG'>('USD');
  const [exchangeRate, setExchangeRate]     = useState<number>(130);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus]     = useState<{ chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean } | null>(null);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeError, setStripeError]       = useState('');

  // ── Scanner ──
  const [scannerEvent, setScannerEvent] = useState('');
  const [scannerMode, setScannerMode]   = useState<'single' | 'continuous'>('single');
  const [scannerSound, setScannerSound] = useState(true);
  const [scannerVibrate, setScannerVibrate] = useState(true);
  const [scannerShowName, setScannerShowName] = useState(true);

  // ── Staff defaults ──
  const [staffPinLength, setStaffPinLength]           = useState<6 | 4>(6);
  const [staffPinExpiry, setStaffPinExpiry]           = useState<'never' | 'event' | '30d'>('event');
  const [staffAutoDeactivate, setStaffAutoDeactivate] = useState(true);
  const [staffAllowOverride, setStaffAllowOverride]   = useState(false);
  const [staffDeviceLock, setStaffDeviceLock]         = useState(true);
  const [staffDefaultSections, setStaffDefaultSections] = useState<string[]>(['all']);

  // ── Notifications ──
  const [notifyStaffActivated, setNotifyStaffActivated]   = useState(true);
  const [notifyLowCapacity, setNotifyLowCapacity]         = useState(true);
  const [notifyLowCapacityPct, setNotifyLowCapacityPct]   = useState(90);
  const [notifyNewSale, setNotifyNewSale]                 = useState(false);
  const [notifyIncident, setNotifyIncident]               = useState(true);
  const [notifyChannel, setNotifyChannel]                 = useState<'email' | 'whatsapp' | 'both'>('email');

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      try {
        const evs = await getOrganizerEvents(user.uid);
        setEvents(evs);

        const orgSnap = await getDocs(query(collection(db, 'organizers'), where('uid', '==', user.uid)));
        if (!orgSnap.empty) {
          const data = orgSnap.docs[0].data();
          setBizName(data.businessName || '');
          setPhone(data.phone || '');
          setWebsite(data.website || '');
          setDefaultCurrency(data.defaultCurrency || 'USD');
          setExchangeRate(data.exchangeRate || 130);
          if (data.logoURL) setLogoURL(data.logoURL);
          if (data.stripeAccountId) {
            setStripeAccountId(data.stripeAccountId);
            try {
              const res = await fetch(`/api/stripe/connect?accountId=${data.stripeAccountId}`);
              const status = await res.json();
              if (!status.error) setStripeStatus(status);
            } catch { /* ignore */ }
          }

          if (data.paymentMethods) {
            const active: Record<string, boolean> = {};
            const values: Record<string, string[]> = {};
            Object.entries(data.paymentMethods as Record<string, any>).forEach(([k, v]) => {
              active[k] = v.active || false;
              values[k] = v.values || [];
            });
            setPaymentActive(active);
            setPaymentValues(values);
          }

          if (data.scanner) {
            setScannerEvent(data.scanner.defaultEventId || '');
            setScannerMode(data.scanner.mode || 'single');
            setScannerSound(data.scanner.sound ?? true);
            setScannerVibrate(data.scanner.vibrate ?? true);
            setScannerShowName(data.scanner.showName ?? true);
          }

          if (data.staffDefaults) {
            setStaffPinLength(data.staffDefaults.pinLength || 6);
            setStaffPinExpiry(data.staffDefaults.pinExpiry || 'event');
            setStaffAutoDeactivate(data.staffDefaults.autoDeactivate ?? true);
            setStaffAllowOverride(data.staffDefaults.allowOverride ?? false);
            setStaffDeviceLock(data.staffDefaults.deviceLock ?? true);
            setStaffDefaultSections(data.staffDefaults.defaultSections || ['all']);
          }

          if (data.notifications) {
            setNotifyStaffActivated(data.notifications.staffActivated ?? true);
            setNotifyLowCapacity(data.notifications.lowCapacity ?? true);
            setNotifyLowCapacityPct(data.notifications.lowCapacityPct || 90);
            setNotifyNewSale(data.notifications.newSale ?? false);
            setNotifyIncident(data.notifications.incident ?? true);
            setNotifyChannel(data.notifications.channel || 'email');
          }
        }
      } catch (err) {
        console.error('settings load', err);
      }
    };
    load();
  }, [user?.uid]);

  // ── Stripe Connect ──────────────────────────────────────────────
  useEffect(() => {
    const result = searchParams.get('stripe');
    if (result === 'success' && stripeAccountId) {
      // Verify account status after returning from Stripe
      checkStripeStatus(stripeAccountId);
    }
  }, [searchParams, stripeAccountId]);

  async function checkStripeStatus(accountId: string) {
    try {
      const res = await fetch(`/api/stripe/connect?accountId=${accountId}`);
      const data = await res.json();
      if (!data.error) setStripeStatus(data);
    } catch { /* ignore */ }
  }

  async function handleConnectStripe() {
    if (!user?.uid || !user?.email) return;
    setStripeConnecting(true);
    setStripeError('');
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizerId: user.uid,
          email: user.email,
          returnUrl: `${window.location.origin}/organizer/settings?stripe=success`,
          refreshUrl: `${window.location.origin}/organizer/settings?stripe=refresh`,
        }),
      });
      const data = await res.json();
      if (data.error) { setStripeError(data.error); return; }
      // Save the account ID to Firestore before redirecting
      const { doc: firestoreDoc, setDoc: setFirestoreDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('@/lib/firebase');
      await setFirestoreDoc(firestoreDoc(firestoreDb, 'organizers', user.uid), { stripeAccountId: data.accountId }, { merge: true });
      setStripeAccountId(data.accountId);
      // Redirect to Stripe onboarding
      window.location.href = data.onboardingUrl;
    } catch (e: any) {
      setStripeError(e.message || 'Erè koneksyon Stripe');
    } finally {
      setStripeConnecting(false);
    }
  }

  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      const paymentMethods: Record<string, any> = {};
      PAYMENT_METHODS.forEach(m => {
        paymentMethods[m.key] = { active: paymentActive[m.key] || false, values: paymentValues[m.key] || [] };
      });

      await setDoc(doc(db, 'organizers', user.uid), {
        uid: user.uid,
        email: user.email,
        businessName: bizName,
        phone, website,
        defaultCurrency,
        exchangeRate,
        paymentMethods,
        scanner: { defaultEventId: scannerEvent, mode: scannerMode, sound: scannerSound, vibrate: scannerVibrate, showName: scannerShowName },
        staffDefaults: { pinLength: staffPinLength, pinExpiry: staffPinExpiry, autoDeactivate: staffAutoDeactivate, allowOverride: staffAllowOverride, deviceLock: staffDeviceLock, defaultSections: staffDefaultSections },
        notifications: { staffActivated: notifyStaffActivated, lowCapacity: notifyLowCapacity, lowCapacityPct: notifyLowCapacityPct, newSale: notifyNewSale, incident: notifyIncident, channel: notifyChannel },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('save settings', err);
    } finally {
      setSaving(false);
    }
  };

  const TABS: { key: SettingsTab; icon: string; label: string }[] = [
    { key: 'profile',       icon: '🏢', label: L('Pwofil',        'Profile',       'Profil') },
    { key: 'payments',      icon: '💳', label: L('Peman',         'Payments',      'Paiements') },
    { key: 'scanner',       icon: '📱', label: L('Eskanè',        'Scanner',       'Scanner') },
    { key: 'staff',         icon: '👥', label: L('Staff',         'Staff',         'Personnel') },
    { key: 'notifications', icon: '🔔', label: L('Notifikasyon',  'Notifications', 'Notifications') },
  ];

  const sections = ['GA', 'VIP', 'VVIP'];

  return (
    <div className="max-w-2xl">

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === t.key ? 'border-orange text-orange' : 'border-transparent text-gray-muted hover:text-white'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══ PROFILE ══ */}
      {activeTab === 'profile' && (
        <SectionCard title={L('Enfòmasyon Biznis', 'Business Info', 'Informations Entreprise')}>
          <div className="space-y-3">

            {/* ── Logo upload ── */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-2">{L('Logo Biznis', 'Business Logo', 'Logo Entreprise')}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: 12, background: '#1e1e2e', border: '2px dashed #333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {logoURL
                    ? <img src={logoURL} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 28 }}>🏢</span>}
                </div>
                <div>
                  <label style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 8, background: '#f97316', color: '#000', fontSize: 12, fontWeight: 700, cursor: logoUploading ? 'not-allowed' : 'pointer', opacity: logoUploading ? 0.6 : 1 }}>
                    {logoUploading ? L('Ap chaje...', 'Uploading...', 'Chargement...') : L('📷 Chwazi Logo', '📷 Choose Logo', '📷 Choisir Logo')}
                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={logoUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user?.uid) return;
                        setLogoUploading(true);
                        try {
                          const compressed = await compressLogo(file);
                          await updateOrganizerLogo(user.uid, compressed);
                          setLogoURL(compressed);
                        } catch (err) { console.error('logo upload', err); }
                        finally { setLogoUploading(false); }
                      }} />
                  </label>
                  {logoURL && (
                    <button onClick={async () => { if (!user?.uid) return; await updateOrganizerLogo(user.uid, ''); setLogoURL(null); }}
                      style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {L('Retire Logo', 'Remove Logo', 'Supprimer Logo')}
                    </button>
                  )}
                  <p style={{ color: '#555', fontSize: 11, marginTop: 6 }}>
                    {L('JPG, PNG, WebP · Max 5MB · Rezize otomatikman', 'JPG, PNG, WebP · Max 5MB · Auto-resized to 256px', 'JPG, PNG, WebP · Max 5MB · Redimensionné automatiquement')}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Business Name ── */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Non Biznis', 'Business Name', 'Nom Entreprise')}</label>
              <input value={bizName} onChange={e => setBizName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Imèl', 'Email', 'Email')}</label>
                <input value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Telefòn', 'Phone', 'Téléphone')}</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+509 ..."
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Sit Entènèt', 'Website', 'Site Web')}</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange placeholder:text-gray-muted" />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Monè Default', 'Default Currency', 'Devise par défaut')}</label>
              <div className="flex gap-2">
                {(['USD', 'HTG'] as const).map(c => (
                  <button key={c} onClick={() => setDefaultCurrency(c)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${defaultCurrency === c ? 'bg-orange text-white border-orange' : 'border-border text-gray-light hover:text-white'}`}>
                    {c === 'USD' ? '🇺🇸 USD' : '🇭🇹 HTG'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ══ PAYMENTS ══ */}
      {activeTab === 'payments' && (
        <SectionCard
          title={L('Metòd Peman', 'Payment Methods', 'Méthodes de Paiement')}
          sub={L('Kijan ou vle resevwa lajan vant tikè ou yo.', 'How you want to receive your ticket sales.', 'Comment vous souhaitez recevoir vos ventes.')}>
          {/* Exchange rate */}
          <div className="border border-border rounded-xl p-4 mb-3">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">💱</span>
              <div className="flex-1">
                <p className="text-xs font-bold">{L('To Echanj USD → HTG', 'USD → HTG Exchange Rate', 'Taux USD → HTG')}</p>
                <p className="text-[10px] text-gray-muted">{L('Itilize pou konvèti pri USD an Goud pou peman MonCash/Natcash', 'Used to convert USD prices to Gourdes for MonCash/Natcash payments', 'Utilisé pour convertir les prix USD en Gourdes')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-gray-muted mb-1">1 USD =</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={exchangeRate}
                    onChange={e => setExchangeRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[13px] font-bold outline-none focus:border-orange" />
                  <span className="text-xs font-bold text-gray-light whitespace-nowrap">HTG</span>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-border rounded-lg p-3 text-center min-w-[100px]">
                <p className="text-[9px] text-gray-muted uppercase mb-1">{L('Egzanp', 'Example', 'Exemple')}</p>
                <p className="text-xs font-bold text-white">$10 USD</p>
                <p className="text-[10px] text-orange font-bold mt-0.5">{(10 * exchangeRate).toLocaleString()} HTG</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {PAYMENT_METHODS.map(m => (
              <div key={m.key} className="border border-border rounded-xl p-4 hover:border-white/[0.1] transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{m.icon}</span>
                  <p className="text-xs font-bold flex-1">{m.name}</p>
                  {m.key !== 'stripe' && (
                    <button onClick={() => setPaymentActive(a => ({ ...a, [m.key]: !a[m.key] }))}
                      className={`px-2.5 py-1 rounded text-[8px] font-bold uppercase transition-all ${
                        paymentActive[m.key]
                          ? 'bg-green-dim text-green border border-green-border'
                          : 'bg-white/[0.05] text-gray-muted border border-border hover:border-white/20'
                      }`}>
                      {paymentActive[m.key] ? L('AKTIF', 'ACTIVE', 'ACTIF') : L('INAKTIF', 'INACTIVE', 'INACTIF')}
                    </button>
                  )}
                  {m.key === 'stripe' && stripeStatus?.chargesEnabled && (
                    <span className="px-2.5 py-1 rounded text-[8px] font-bold uppercase bg-green-dim text-green border border-green-border">✓ KONEKTE</span>
                  )}
                </div>

                {/* ── Stripe Connect special UI ── */}
                {m.key === 'stripe' && (
                  <div>
                    {!stripeAccountId && (
                      <div className="bg-white/[0.03] rounded-xl p-4">
                        <p className="text-xs text-gray-300 mb-1">{L('Aksepte kart kredi ak debi nan evènman ou yo.', 'Accept credit and debit cards at your events.', 'Acceptez les cartes bancaires à vos événements.')}</p>
                        <p className="text-[11px] text-gray-500 mb-3">{L('Anbyans pran 9% frè — rès la ale dirèkteman nan kont ou.', 'Anbyans takes 9% — the rest goes directly to your account.', 'Anbyans prend 9% — le reste va directement sur votre compte.')}</p>
                        {stripeError && <p className="text-red-400 text-[11px] mb-2">{stripeError}</p>}
                        <button onClick={handleConnectStripe} disabled={stripeConnecting}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold transition-all disabled:opacity-50">
                          {stripeConnecting ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {L('Ap konekte...', 'Connecting...', 'Connexion...')}</> : <>💳 {L('Konekte Stripe', 'Connect Stripe', 'Connecter Stripe')}</>}
                        </button>
                      </div>
                    )}
                    {stripeAccountId && !stripeStatus?.chargesEnabled && (
                      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
                        <p className="text-xs text-yellow-300 font-bold mb-1">⏳ {L('Kont Stripe ou an atant verifikasyon', 'Your Stripe account is pending verification', 'Votre compte Stripe est en attente de vérification')}</p>
                        <p className="text-[11px] text-gray-400 mb-3">{L('Ranpli onboarding Stripe a pou aktive peman kart.', 'Complete Stripe onboarding to activate card payments.', 'Complétez l'onboarding Stripe pour activer les paiements par carte.')}</p>
                        <button onClick={handleConnectStripe} disabled={stripeConnecting}
                          className="text-xs text-orange hover:underline font-bold">
                          {L('Kontinye onboarding →', 'Continue onboarding →', 'Continuer l'onboarding →')}
                        </button>
                      </div>
                    )}
                    {stripeAccountId && stripeStatus?.chargesEnabled && (
                      <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4">
                        <p className="text-xs text-green-400 font-bold mb-1">✅ {L('Stripe aktif — kart aksepte', 'Stripe active — cards accepted', 'Stripe actif — cartes acceptées')}</p>
                        <p className="text-[11px] text-gray-400">ID: <span className="font-mono text-gray-300">{stripeAccountId}</span></p>
                        <p className="text-[11px] text-gray-500 mt-1">{L('Peman yo ale dirèkteman nan kont bank ou aprè 2 jou.', 'Payments go directly to your bank account after 2 days.', 'Les paiements vont directement sur votre compte bancaire après 2 jours.')}</p>
                      </div>
                    )}
                  </div>
                )}

                {m.key !== 'stripe' && paymentActive[m.key] && (
                  <div className="grid grid-cols-2 gap-3">
                    {m.fields.map((f, fi) => (
                      <div key={f}>
                        <label className="block text-[10px] font-semibold text-gray-muted mb-1">{f}</label>
                        <input
                          value={(paymentValues[m.key] || [])[fi] || ''}
                          onChange={e => setPaymentValues(v => {
                            const arr = [...(v[m.key] || [])];
                            arr[fi] = e.target.value;
                            return { ...v, [m.key]: arr };
                          })}
                          placeholder={f}
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-border text-white text-[12px] outline-none focus:border-orange placeholder:text-gray-muted" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ══ SCANNER ══ */}
      {activeTab === 'scanner' && (
        <SectionCard
          title={L('Jestion Eskanè', 'Scanner Management', 'Gestion Scanner')}
          sub={L('Konfigire eskanè QR pou evènman ou yo.', 'Configure QR scanner for your events.', 'Configurer le scanner QR.')}>
          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Evènman pa defo', 'Default Event', 'Événement par défaut')}</label>
              <select value={scannerEvent} onChange={e => setScannerEvent(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange">
                <option value="">{L('Chwazi yon evènman...', 'Choose an event...', 'Choisir un événement...')}</option>
                {events.map(e => <option key={e.id} value={e.id!}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Mòd Eskanè', 'Scanner Mode', 'Mode Scanner')}</label>
              <div className="flex gap-2">
                {([
                  ['single',     L('Yon pa yon', 'One by one', 'Un par un')],
                  ['continuous', L('Kontinyèl',  'Continuous', 'Continu')],
                ] as [string, string][]).map(([val, label]) => (
                  <button key={val} onClick={() => setScannerMode(val as typeof scannerMode)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${scannerMode === val ? 'bg-orange text-white border-orange' : 'border-border text-gray-light hover:text-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="border border-border rounded-xl p-4 space-y-0">
              <Toggle label={L('Son', 'Sound feedback', 'Son')}         hint={L('Bip lè tikè eskane', 'Beep on scan', 'Bip lors du scan')} value={scannerSound}    onChange={setScannerSound} />
              <Toggle label={L('Vibre', 'Vibration', 'Vibration')}      hint={L('Vibre sou telefòn', 'Vibrate on phone', 'Vibration téléphone')} value={scannerVibrate}  onChange={setScannerVibrate} />
              <Toggle label={L('Montre non', 'Show guest name', 'Afficher nom')} hint={L('Afiche non moun apre eskane', 'Show name after scan', 'Afficher nom après scan')} value={scannerShowName} onChange={setScannerShowName} />
            </div>
          </div>
        </SectionCard>
      )}

      {/* ══ STAFF DEFAULTS ══ */}
      {activeTab === 'staff' && (
        <>
          <SectionCard
            title={L('Règ PIN', 'PIN Policy', 'Politique PIN')}
            sub={L('Paramèt default pou tout nouvo manm staff.', 'Default settings applied to all new staff members.', 'Paramètres par défaut pour tout nouveau personnel.')}>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Longè PIN', 'PIN Length', 'Longueur PIN')}</label>
                <div className="flex gap-2">
                  {([4, 6] as const).map(n => (
                    <button key={n} onClick={() => setStaffPinLength(n)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${staffPinLength === n ? 'bg-orange text-white border-orange' : 'border-border text-gray-light hover:text-white'}`}>
                      {n} {L('chif', 'digits', 'chiffres')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('PIN Ekspire', 'PIN Expiry', 'Expiration PIN')}</label>
                <div className="flex gap-2">
                  {([
                    ['never', L('Jamè', 'Never', 'Jamais')],
                    ['event', L('Apre evèn', 'After event', 'Après événement')],
                    ['30d',   L('30 jou', '30 days', '30 jours')],
                  ] as [string, string][]).map(([val, label]) => (
                    <button key={val} onClick={() => setStaffPinExpiry(val as typeof staffPinExpiry)}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-bold border transition-all ${staffPinExpiry === val ? 'bg-orange text-white border-orange' : 'border-border text-gray-light hover:text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={L('Aksè Default Eskanè', 'Default Scanner Access', 'Accès Scanner par défaut')}
            sub={L('Seksyon tikè eskanè ka valide pa default.', 'Ticket sections scanners can validate by default.', 'Sections que les scanners peuvent valider par défaut.')}>
            <div className="flex gap-2 flex-wrap">
              {['all', ...sections].map(sec => (
                <button key={sec} onClick={() => {
                  const cur = staffDefaultSections;
                  const next = sec === 'all' ? ['all'] : cur.includes(sec) ? cur.filter(x => x !== sec) : [...cur.filter(x => x !== 'all'), sec];
                  setStaffDefaultSections(next.length ? next : ['all']);
                }} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${staffDefaultSections.includes(sec) ? 'bg-orange text-white border-orange' : 'border-border text-gray-light hover:text-white'}`}>
                  {sec === 'all' ? '✓ All' : sec}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={L('Sekirite Staff', 'Staff Security', 'Sécurité Personnel')}>
            <div className="space-y-0">
              <Toggle
                label={L('Device Lock', 'Device Lock', 'Verrouillage appareil')}
                hint={L('Eskanè bloke sou premye aparèy li konekte a', 'Scanner locks to first device that logs in', 'Scanner verrouillé au premier appareil connecté')}
                value={staffDeviceLock}
                onChange={setStaffDeviceLock} />
              <Toggle
                label={L('Dezaktive apre evèn', 'Auto-deactivate after event', 'Désactivation auto après événement')}
                hint={L('Tout staff dezaktive otomatikman lè evènman fini', 'All staff auto-deactivated when event ends', 'Tout le personnel désactivé automatiquement à la fin')}
                value={staffAutoDeactivate}
                onChange={setStaffAutoDeactivate} />
              <Toggle
                label={L('Pèmèt Override', 'Allow Override', 'Autoriser le contournement')}
                hint={L('Eskanè ka force-aksepte tikè envalid — Risk segirte', 'Scanners can force-accept invalid tickets — Security risk', 'Risque sécurité — À activer avec précaution')}
                value={staffAllowOverride}
                onChange={setStaffAllowOverride}
                warn />
            </div>
          </SectionCard>
        </>
      )}

      {/* ══ NOTIFICATIONS ══ */}
      {activeTab === 'notifications' && (
        <>
          <SectionCard
            title={L('Kanal Notifikasyon', 'Notification Channel', 'Canal de Notification')}
            sub={L('Ki jan ou vle resevwa alèt yo.', 'How you want to receive alerts.', 'Comment recevoir les alertes.')}>
            <div className="flex gap-2">
              {([
                ['email',    '📧 Email'],
                ['whatsapp', '💬 WhatsApp'],
                ['both',     L('Tou de', 'Both', 'Les deux')],
              ] as [string, string][]).map(([val, label]) => (
                <button key={val} onClick={() => setNotifyChannel(val as typeof notifyChannel)}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-bold border transition-all ${notifyChannel === val ? 'bg-orange text-white border-orange' : 'border-border text-gray-light hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={L('Deklanche Notifikasyon', 'Notification Triggers', 'Déclencheurs')}>
            <div className="space-y-0">
              <Toggle
                label={L('Staff Aktive', 'Staff Activated', 'Personnel activé')}
                hint={L('Notifye lè yon manm staff aktive', 'Notify when a staff member is activated', 'Notifier quand un membre est activé')}
                value={notifyStaffActivated}
                onChange={setNotifyStaffActivated} />
              <Toggle
                label={L('Rapò Ensidan', 'Incident Report Filed', 'Rapport d\'incident')}
                hint={L('Notifye imedyatman lè sekirite depoze rapò', 'Notify immediately when security files a report', 'Notifier immédiatement lors d\'un rapport de sécurité')}
                value={notifyIncident}
                onChange={setNotifyIncident} />
              <Toggle
                label={L('Kapasite Ba', 'Low Capacity Warning', 'Avertissement capacité')}
                hint={L(`Notifye lè evènman rive ${notifyLowCapacityPct}% plen`, `Notify when event reaches ${notifyLowCapacityPct}% full`, `Notifier à ${notifyLowCapacityPct}% de la capacité`)}
                value={notifyLowCapacity}
                onChange={setNotifyLowCapacity} />
              {notifyLowCapacity && (
                <div className="pl-6 pb-3 pt-1">
                  <div className="flex items-center gap-3">
                    <input type="range" min={50} max={100} step={5}
                      value={notifyLowCapacityPct}
                      onChange={e => setNotifyLowCapacityPct(Number(e.target.value))}
                      className="flex-1 accent-orange" />
                    <span className="text-xs font-bold text-orange w-10 text-right">{notifyLowCapacityPct}%</span>
                  </div>
                </div>
              )}
              <Toggle
                label={L('Nouvo Vant', 'New Sale', 'Nouvelle vente')}
                hint={L('Notifye pou chak tikè vann — ka anpil mesaj', 'Notify for every ticket sold — can be noisy', 'Notifier pour chaque billet vendu — peut être nombreux')}
                value={notifyNewSale}
                onChange={setNotifyNewSale} />
            </div>
          </SectionCard>
        </>
      )}

      {/* ── Save ── */}
      <button onClick={handleSave} disabled={saving}
        className="px-6 py-2.5 rounded-[10px] bg-orange text-white text-xs font-bold hover:bg-orange/80 transition-all disabled:opacity-50 flex items-center gap-2">
        {saving ? (
          <><div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> {L('Anrejistre...', 'Saving...', 'Enregistrement...')}</>
        ) : saved ? (
          `✓ ${L('Anrejistre!', 'Saved!', 'Enregistré!')}`
        ) : (
          L('Anrejistre Chanjman', 'Save Changes', 'Enregistrer les changements')
        )}
      </button>

    </div>
  );
}

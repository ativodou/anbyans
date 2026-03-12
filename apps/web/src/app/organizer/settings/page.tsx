'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getOrganizerEvents, type EventData } from '@/lib/db';

interface PaymentMethod {
  key: string;
  icon: string;
  name: string;
  fields: string[];
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { key: 'moncash',  icon: '📱', name: 'MonCash',  fields: ['Nimewo MonCash', 'Non sou kont lan'] },
  { key: 'natcash',  icon: '💚', name: 'Natcash',  fields: ['Nimewo Natcash', 'Non sou kont lan'] },
  { key: 'zelle',    icon: '⚡', name: 'Zelle',    fields: ['Imèl oswa Telefòn Zelle', 'Non sou kont lan'] },
  { key: 'paypal',   icon: '🅿️', name: 'PayPal',   fields: ['Imèl PayPal'] },
  { key: 'cashapp',  icon: '💲', name: 'Cash App', fields: ['$cashtag'] },
];

export default function OrganizerSettingsPage() {
  const { user } = useAuth();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) =>
    ({ ht, en, fr } as Record<string, string>)[locale] ?? ht;

  const [events, setEvents] = useState<EventData[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile
  const [bizName, setBizName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');

  // Payment methods — active flags and values
  const [paymentActive, setPaymentActive] = useState<Record<string, boolean>>({ moncash: true });
  const [paymentValues, setPaymentValues] = useState<Record<string, string[]>>({});

  // Scanner settings
  const [scannerEvent, setScannerEvent] = useState('');
  const [scannerMode, setScannerMode] = useState<'single' | 'continuous'>('single');

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      try {
        const evs = await getOrganizerEvents(user.uid);
        setEvents(evs);

        const orgSnap = await getDocs(query(collection(db, 'organizers'), where('uid', '==', user.uid)));
        if (!orgSnap.empty) {
          const data = orgSnap.docs[0].data();
          setBizName(data.businessName || data.bizName || '');
          setPhone(data.phone || '');
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
          }
        }
      } catch (err) {
        console.error('settings load', err);
      }
    };
    load();
  }, [user?.uid]);

  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      const paymentMethods: Record<string, any> = {};
      PAYMENT_METHODS.forEach(m => {
        paymentMethods[m.key] = {
          active: paymentActive[m.key] || false,
          values: paymentValues[m.key] || [],
        };
      });

      await setDoc(doc(db, 'organizers', user.uid), {
        uid: user.uid,
        email: user.email,
        businessName: bizName,
        phone,
        paymentMethods,
        scanner: { defaultEventId: scannerEvent, mode: scannerMode },
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

  return (
    <div className="max-w-2xl">

      {/* ── Biznis Info ── */}
      <div className="bg-dark-card border border-border rounded-card p-5 space-y-3.5 mb-5">
        <p className="text-[10px] uppercase tracking-widest text-orange font-bold">{L('Enfòmasyon Biznis', 'Business Info', 'Informations Entreprise')}</p>
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
      </div>

      {/* ── Payment Methods ── */}
      <div className="bg-dark-card border border-border rounded-card p-5 mb-5">
        <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-1">{L('Metòd Peman', 'Payment Methods', 'Méthodes de Paiement')}</p>
        <p className="text-[10px] text-gray-light mb-4">{L('Kijan ou vle resevwa lajan vant tikè ou yo.', 'How you want to receive your ticket sales.', 'Comment vous souhaitez recevoir vos ventes.')}</p>
        <div className="space-y-3">
          {PAYMENT_METHODS.map(m => (
            <div key={m.key} className="border border-border rounded-xl p-4 hover:border-white/[0.1] transition-all">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">{m.icon}</span>
                <p className="text-xs font-bold flex-1">{m.name}</p>
                <button
                  onClick={() => setPaymentActive(a => ({ ...a, [m.key]: !a[m.key] }))}
                  className={`px-2.5 py-1 rounded text-[8px] font-bold uppercase transition-all ${
                    paymentActive[m.key]
                      ? 'bg-green-dim text-green border border-green-border'
                      : 'bg-white/[0.05] text-gray-muted border border-border hover:border-white/20'
                  }`}>
                  {paymentActive[m.key] ? L('AKTIF', 'ACTIVE', 'ACTIF') : L('INAKTIF', 'INACTIVE', 'INACTIF')}
                </button>
              </div>
              {paymentActive[m.key] && (
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
      </div>

      {/* ── Scanner Settings ── */}
      <div className="bg-dark-card border border-border rounded-card p-5 mb-5">
        <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-1">{L('Jestion Eskanè', 'Scanner Management', 'Gestion Scanner')}</p>
        <p className="text-[10px] text-gray-light mb-4">{L('Konfigire eskanè QR pou evènman ou yo.', 'Configure QR scanner for your events.', 'Configurer le scanner QR pour vos événements.')}</p>

        <div className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-gray-light mb-1.5">{L('Evènman pa defo', 'Default Event', 'Événement par défaut')}</label>
            <select value={scannerEvent} onChange={e => setScannerEvent(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[10px] bg-white/[0.04] border border-border text-white text-[13px] outline-none focus:border-orange">
              <option value="">{L('Chwazi yon evènman...', 'Choose an event...', 'Choisir un événement...')}</option>
              {events.map(e => (
                <option key={e.id} value={e.id!}>{e.name}</option>
              ))}
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
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                    scannerMode === val
                      ? 'bg-orange text-white border-orange'
                      : 'bg-white/[0.04] border-border text-gray-light hover:text-white'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
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
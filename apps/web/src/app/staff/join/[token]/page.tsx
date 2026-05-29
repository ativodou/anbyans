'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  getStaffPoolByToken,
  acceptStaffInvite,
  type StaffPoolDoc,
} from '@/lib/db';
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

const ROLE_ICONS: Record<string, string> = {
  scanner: '📱',
  door: '🚪',
  sales: '💰',
  security: '🛡️',
  fb: '🍽️',
  manager: '🧑‍💼',
};

const ROLE_HT: Record<string, string> = {
  scanner: 'Eskanè',
  door: 'Pòt',
  sales: 'Vant',
  security: 'Sekirite',
  fb: 'Manje & Bweson',
  manager: 'Manadjè',
};

export default function StaffJoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [poolDoc, setPoolDoc] = useState<StaffPoolDoc | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.token) return;
    setFetchLoading(true);
    getStaffPoolByToken(params.token)
      .then(doc => {
        if (!doc) setFetchError('Lyen envitasyon sa a pa valid oswa ekspire.');
        else setPoolDoc(doc);
      })
      .catch(() => setFetchError('Erè chajman. Eseye ankò.'))
      .finally(() => setFetchLoading(false));
  }, [params.token]);

  const handleJoin = async () => {
    if (!poolDoc || !poolDoc.id) return;
    setSaving(true);
    setError('');
    try {
      let uid = user?.uid || '';
      let displayName = user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : '';

      if (!user) {
        // Create new Firebase Auth account
        if (!form.name.trim() || !form.email.trim() || !form.password) {
          setError('Ranpli tout chan yo.');
          setSaving(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        await updateProfile(cred.user, { displayName: form.name.trim() });
        uid = cred.user.uid;
        displayName = form.name.trim();
      }

      await acceptStaffInvite(params.token, uid, displayName);
      router.replace('/staff');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/email-already-in-use') {
        setError('Imèl sa a deja itilize. Konekte epi eseye ankò.');
      } else if (e.code === 'auth/weak-password') {
        setError('Modpas twò kout (6+ karaktè).');
      } else {
        setError(e.message || 'Yon erè rive. Eseye ankò.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || fetchLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center px-4">
        <div className="bg-dark-card border border-red/40 rounded-2xl p-8 max-w-sm w-full text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-red font-semibold">{fetchError}</p>
        </div>
      </div>
    );
  }

  if (poolDoc?.inviteStatus === 'joined') {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center px-4">
        <div className="bg-dark-card border border-green/40 rounded-2xl p-8 max-w-sm w-full text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-bold text-lg mb-2">Ou deja nan ekip la!</p>
          <p className="text-gray-muted text-sm mb-5">Kont ou deja konekte ak ekip {poolDoc.organizerName || 'la'}.</p>
          <button onClick={() => router.push('/staff')}
            className="w-full py-3 rounded-xl bg-orange text-white font-bold text-sm">
            Ale nan tablo mwen →
          </button>
        </div>
      </div>
    );
  }

  const roleIcon = ROLE_ICONS[poolDoc?.role || ''] || '👤';
  const roleLabel = ROLE_HT[poolDoc?.role || ''] || poolDoc?.role || '';

  return (
    <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="font-heading font-black text-2xl text-orange">ANBYANS</span>
          <p className="text-gray-muted text-sm mt-1">Sistèm ekip evènman</p>
        </div>

        {/* Invite info card */}
        <div className="bg-dark-card border border-orange/30 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-widest text-orange font-bold mb-3">Envitasyon Ekip</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange/10 rounded-xl flex items-center justify-center text-xl">
              {roleIcon}
            </div>
            <div>
              <p className="font-bold">{poolDoc?.name}</p>
              <p className="text-xs text-gray-muted">{roleLabel}</p>
            </div>
          </div>
          {poolDoc?.organizerName && (
            <p className="text-xs text-gray-light">
              👋 <span className="font-semibold text-white">{poolDoc.organizerName}</span> envite ou nan ekip li a.
            </p>
          )}
        </div>

        {/* Action area */}
        {user ? (
          <div className="bg-dark-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold mb-1">
              Konekte kòm{' '}
              <span className="text-orange">
                {`${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || user.email}
              </span>
            </p>
            <p className="text-xs text-gray-muted mb-4">Ou pral rejoindre ekip la ak kont sa a.</p>
            {error && <p className="text-red text-xs mb-3">{error}</p>}
            <button onClick={handleJoin} disabled={saving}
              className="w-full py-3 rounded-xl bg-orange text-white font-bold text-sm disabled:opacity-50 hover:bg-orange/80 transition-all">
              {saving ? '...' : 'Rejoindre Ekip La ✓'}
            </button>
          </div>
        ) : (
          <div className="bg-dark-card border border-border rounded-2xl p-5 space-y-3">
            <p className="text-sm font-bold mb-1">Kreye kont ou</p>
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Non Konplè *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Jean Pierre"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Imèl *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jean@example.com"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-light mb-1.5">Modpas *</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="6+ karaktè"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange placeholder:text-gray-muted"
              />
            </div>
            {error && <p className="text-red text-xs">{error}</p>}
            <button onClick={handleJoin} disabled={saving}
              className="w-full py-3 rounded-xl bg-orange text-white font-bold text-sm disabled:opacity-50 hover:bg-orange/80 transition-all mt-1">
              {saving ? '...' : 'Kreye Kont & Rejoindre →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

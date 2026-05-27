'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { updateUserPhoto, getUserPhoto, getVendorByUid, updateUserProfile, deleteVendorData } from '@/lib/db';
import { deleteUserAccount } from '@/lib/auth';
import { compressImage } from '@/lib/compressImage';

export default function VendorProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useT();

  const [photoURL,   setPhotoURL]   = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [vendorCity, setVendorCity] = useState('');
  const [uploading,  setUploading]  = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting,   setDeleting]   = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Editable profile fields
  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [phone,      setPhone]      = useState('');
  const [city,       setCity]       = useState('');
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoSaved,  setInfoSaved]  = useState(false);
  const [infoError,  setInfoError]  = useState('');

  const displayName = (user as any)?.firstName
    ? `${(user as any).firstName} ${(user as any).lastName ?? ''}`.trim()
    : user?.email?.split('@')[0] ?? '';

  useEffect(() => {
    if (!user?.uid) return;
    getUserPhoto(user.uid).then(url => setPhotoURL(url)).catch(() => {});
    getVendorByUid(user.uid).then(v => {
      if (v) { setVendorName(v.name || ''); setVendorCity(v.city || ''); }
    }).catch(() => {});
    const u = user as any;
    setFirstName(u?.firstName ?? '');
    setLastName(u?.lastName ?? '');
    setPhone(u?.phone ?? '');
    setCity(u?.city ?? '');
  }, [user?.uid]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(t('profile_photo_too_large'));
      return;
    }
    setError('');
    setUploading(true);
    try {
      const compressed = await compressImage(file, 128);
      await updateUserPhoto(user.uid, compressed);
      setPhotoURL(compressed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(t('profile_upload_failed'));
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveInfo() {
    if (!user?.uid) return;
    setInfoSaving(true);
    setInfoError('');
    try {
      await updateUserProfile(user.uid, { firstName, lastName, phone, city });
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 2500);
    } catch {
      setInfoError('Erè — eseye ankò.');
    } finally {
      setInfoSaving(false);
    }
  }

  async function handleRemove() {
    if (!user?.uid) return;
    await updateUserPhoto(user.uid, '');
    setPhotoURL(null);
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#aaa' }}>{t('profile_please_signin')}</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff' }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer' }}>
          ← {t('back')}
        </button>
        <span style={{ color: '#a855f7', fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>ANBYANS</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          {t('vend_profile_title')}
        </h1>
        <p style={{ color: '#555', fontSize: 13, marginBottom: 32 }}>
          {t('vend_profile_desc')}
        </p>

        {/* Photo card */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 28 }}>

          {/* Current photo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, fontSize: 32, fontWeight: 800, color: '#fff' }}>
              {photoURL
                ? <img src={photoURL} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 2 }}>{vendorName || displayName}</div>
              <div style={{ fontSize: 12, color: '#a855f7', marginBottom: 4 }}>
                🏪 {t('vend_profile_role')} {vendorCity ? `· ${vendorCity}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#555' }}>{user.email}</div>
            </div>
          </div>

          {/* Upload area */}
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: 24, borderRadius: 12, border: '2px dashed #1e1e2e',
            cursor: uploading ? 'not-allowed' : 'pointer', background: '#0a0a0f',
            transition: 'border-color .2s', marginBottom: 16,
          }}>
            <span style={{ fontSize: 32 }}>{uploading ? '⏳' : '📷'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>
              {uploading
                ? t('profile_uploading')
                : t('profile_choose_photo')}
            </span>
            <span style={{ fontSize: 11, color: '#555' }}>
              JPG, PNG, WebP · {t('profile_max_size')}
            </span>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={handleFileChange}
            />
          </label>

          {/* Error */}
          {error && (
            <div style={{ background: '#2a1515', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Success */}
          {saved && (
            <div style={{ background: '#0d2a1a', border: '1px solid #22c55e', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#22c55e', fontSize: 13 }}>
              ✓ {t('profile_photo_saved')}
            </div>
          )}

          {/* Remove */}
          {photoURL && (
            <button onClick={handleRemove}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #2a1515', background: 'transparent', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              🗑 {t('profile_remove_photo')}
            </button>
          )}
        </div>

        {/* Editable account info */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 24, marginTop: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#aaa', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('profile_account_info')}
          </h2>

          {/* Email — read-only */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 5 }}>{t('profile_email_label')}</label>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#0a0a0f', border: '1px solid #1a1a2a', color: '#555', fontSize: 13 }}>
              {user.email}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 5 }}>Prenon</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, background: '#0a0a0f', border: '1px solid #1a1a2a', color: '#fff', fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 5 }}>Non</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, background: '#0a0a0f', border: '1px solid #1a1a2a', color: '#fff', fontSize: 13, outline: 'none' }} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 5 }}>{t('profile_phone_label')}</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, background: '#0a0a0f', border: '1px solid #1a1a2a', color: '#fff', fontSize: 13, outline: 'none' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 5 }}>{t('profile_city_label')}</label>
            <input value={city} onChange={e => setCity(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, background: '#0a0a0f', border: '1px solid #1a1a2a', color: '#fff', fontSize: 13, outline: 'none' }} />
          </div>

          {infoError && (
            <div style={{ background: '#2a1515', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#ef4444', fontSize: 13 }}>
              {infoError}
            </div>
          )}
          {infoSaved && (
            <div style={{ background: '#0d2a1a', border: '1px solid #22c55e', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#22c55e', fontSize: 13 }}>
              ✓ Sove!
            </div>
          )}

          <button onClick={handleSaveInfo} disabled={infoSaving}
            style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#a855f7', color: '#fff', fontSize: 14, fontWeight: 700, cursor: infoSaving ? 'not-allowed' : 'pointer', opacity: infoSaving ? 0.6 : 1 }}>
            {infoSaving ? '...' : 'Sove Chanjman yo'}
          </button>
        </div>

        {/* Dashboard link */}
        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <Link href="/vendor/dashboard"
            style={{ flex: 1, display: 'block', padding: '12px', borderRadius: 10, background: '#a855f7', color: '#fff', textAlign: 'center', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
            {t('vend_profile_dashboard')}
          </Link>
          <Link href="/legal"
            style={{ padding: '12px 16px', borderRadius: 10, background: '#1e1e2e', color: '#666', textDecoration: 'none', fontSize: 13 }}>
            ⚖️
          </Link>
        </div>

        {/* Danger Zone */}
        <div style={{ marginTop: 32, border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, color: '#ef4444', fontWeight: 700, marginBottom: 4 }}>Danger Zone</p>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
            Efase kont ou pou toutan. Tout achè tikè ak done ou yo ap disparèt. Sa pa ka defèt.
          </p>
          <input
            value={deleteConfirm}
            onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(''); }}
            placeholder='Tape "DELETE" pou konfime'
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, background: '#0a0a0f', border: '1px solid rgba(239,68,68,0.3)', color: '#fff', fontSize: 13, outline: 'none', marginBottom: 12 }}
          />
          {deleteError && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{deleteError}</p>}
          <button
            disabled={deleteConfirm !== 'DELETE' || deleting}
            onClick={async () => {
              if (!user?.uid || deleteConfirm !== 'DELETE') return;
              setDeleting(true);
              setDeleteError('');
              try {
                await deleteVendorData(user.uid);
                await deleteUserAccount();
                router.push('/');
              } catch (e: any) {
                setDeleteError(e?.code === 'auth/requires-recent-login' ? 'Rekonekte epi eseye ankò.' : 'Erè — eseye ankò.');
                setDeleting(false);
              }
            }}
            style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: deleteConfirm !== 'DELETE' || deleting ? 'not-allowed' : 'pointer', opacity: deleteConfirm !== 'DELETE' || deleting ? 0.3 : 1 }}>
            {deleting ? 'Ap efase…' : '🗑 Efase Kont Mwen'}
          </button>
        </div>
      </div>
    </div>
  );
}

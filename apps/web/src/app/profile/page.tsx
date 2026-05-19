'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { updateUserPhoto, getUserPhoto } from '@/lib/db';
import { compressImage } from '@/lib/compressImage';

export default function FanProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useT();

  const [photoURL,    setPhotoURL]    = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');

  const displayName = (user as any)?.firstName
    ? `${(user as any).firstName} ${(user as any).lastName ?? ''}`.trim()
    : user?.email?.split('@')[0] ?? '';

  useEffect(() => {
    if (!user?.uid) return;
    getUserPhoto(user.uid).then(url => setPhotoURL(url)).catch(() => {});
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
        <span style={{ color: '#06b6d4', fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>ANBYANS</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          {t('profile_title')}
        </h1>
        <p style={{ color: '#555', fontSize: 13, marginBottom: 32 }}>
          {t('profile_photo_desc')}
        </p>

        {/* Photo card */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 28 }}>

          {/* Current photo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, fontSize: 32, fontWeight: 800, color: '#000' }}>
              {photoURL
                ? <img src={photoURL} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 2 }}>{displayName}</div>
              <div style={{ fontSize: 12, color: '#06b6d4', marginBottom: 4 }}>Fan</div>
              <div style={{ fontSize: 11, color: '#555' }}>{user.email}</div>
            </div>
          </div>

          {/* Upload area */}
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: 24, borderRadius: 12, border: '2px dashed #1e1e2e',
            cursor: uploading ? 'not-allowed' : 'pointer', background: '#0a0a0f',
            transition: 'border-color .2s', marginBottom: 16,
          }}
            onDragOver={e => e.preventDefault()}
          >
            <span style={{ fontSize: 32 }}>{uploading ? '⏳' : '📷'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>
              {uploading ? t('profile_uploading') : t('profile_choose_photo')}
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
              {t('profile_remove_photo')}
            </button>
          )}
        </div>

        {/* Other profile info (read-only for now) */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 24, marginTop: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#aaa', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('profile_account_info')}
          </h2>
          {[
            { label: t('profile_email_label'), value: user.email ?? '' },
            { label: t('profile_name_label'),  value: displayName },
            { label: t('profile_phone_label'), value: (user as any)?.phone || '—' },
            { label: t('profile_city_label'), value: (user as any)?.city || '—' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1a1a2a' }}>
              <span style={{ color: '#555', fontSize: 12 }}>{row.label}</span>
              <span style={{ color: '#ccc', fontSize: 12 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Legal link */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12 }}>
          <Link href="/legal" style={{ color: '#333', textDecoration: 'none' }}>
            ⚖️ {t('profile_terms_link')}
          </Link>
        </p>
      </div>
    </div>
  );
}

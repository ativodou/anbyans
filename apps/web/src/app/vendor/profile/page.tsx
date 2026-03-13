'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { updateUserPhoto, getUserPhoto, getVendorByUid } from '@/lib/db';
import { compressImage } from '@/lib/compressImage';

export default function VendorProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { locale } = useT();
  const L = (ht: string, en: string, fr: string) => ({ ht, en, fr }[locale] ?? en);

  const [photoURL,   setPhotoURL]   = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [vendorCity, setVendorCity] = useState('');
  const [uploading,  setUploading]  = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState('');

  const displayName = (user as any)?.firstName
    ? `${(user as any).firstName} ${(user as any).lastName ?? ''}`.trim()
    : user?.email?.split('@')[0] ?? '';

  useEffect(() => {
    if (!user?.uid) return;
    getUserPhoto(user.uid).then(url => setPhotoURL(url)).catch(() => {});
    getVendorByUid(user.uid).then(v => {
      if (v) { setVendorName(v.name || ''); setVendorCity(v.city || ''); }
    }).catch(() => {});
  }, [user?.uid]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(L('Foto a twò gwo (max 5MB)', 'Photo too large (max 5MB)', 'Photo trop grande (max 5 Mo)'));
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
      setError(L('Erè pandan chajman', 'Upload failed', 'Échec du chargement'));
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
        <p style={{ color: '#aaa' }}>{L('Konekte dabò', 'Please sign in', 'Veuillez vous connecter')}</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff' }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer' }}>
          ← {L('Retounen', 'Back', 'Retour')}
        </button>
        <span style={{ color: '#a855f7', fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>ANBYANS</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          {L('Pwofil Revandè', 'Vendor Profile', 'Profil Revendeur')}
        </h1>
        <p style={{ color: '#555', fontSize: 13, marginBottom: 32 }}>
          {L('Foto ou parèt bay òganizatè ak nan aplikasyon an', 'Your photo is visible to organizers and across the app', 'Votre photo est visible par les organisateurs')}
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
                🏪 {L('Revandè', 'Vendor', 'Revendeur')} {vendorCity ? `· ${vendorCity}` : ''}
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
                ? L('Ap chaje...', 'Uploading...', 'Chargement...')
                : L('Chwazi yon foto', 'Choose a photo', 'Choisir une photo')}
            </span>
            <span style={{ fontSize: 11, color: '#555' }}>
              JPG, PNG, WebP · {L('Max 5MB', 'Max 5MB', 'Max 5 Mo')}
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
              ✓ {L('Foto anrejistre!', 'Photo saved!', 'Photo enregistrée !')}
            </div>
          )}

          {/* Remove */}
          {photoURL && (
            <button onClick={handleRemove}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #2a1515', background: 'transparent', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {L('🗑 Retire Foto', '🗑 Remove Photo', '🗑 Supprimer Photo')}
            </button>
          )}
        </div>

        {/* Account info */}
        <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 24, marginTop: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#aaa', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
            {L('Enfòmasyon Kont', 'Account Info', 'Informations du Compte')}
          </h2>
          {[
            { label: L('Imel', 'Email', 'E-mail'), value: user.email ?? '' },
            { label: L('Non', 'Name', 'Nom'), value: vendorName || displayName },
            { label: L('Vil', 'City', 'Ville'), value: vendorCity || '—' },
            { label: L('Telefòn', 'Phone', 'Téléphone'), value: (user as any)?.phone || '—' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1a1a2a' }}>
              <span style={{ color: '#555', fontSize: 12 }}>{row.label}</span>
              <span style={{ color: '#ccc', fontSize: 12 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Dashboard link */}
        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <Link href="/vendor/dashboard"
            style={{ flex: 1, display: 'block', padding: '12px', borderRadius: 10, background: '#a855f7', color: '#fff', textAlign: 'center', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
            {L('← Dachbod', '← Dashboard', '← Tableau de bord')}
          </Link>
          <Link href="/legal"
            style={{ padding: '12px 16px', borderRadius: 10, background: '#1e1e2e', color: '#666', textDecoration: 'none', fontSize: 13 }}>
            ⚖️
          </Link>
        </div>
      </div>
    </div>
  );
}

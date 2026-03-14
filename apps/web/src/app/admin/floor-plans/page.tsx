'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { compressImage } from '@/lib/compressImage';

interface FloorPlan {
  placeId: string;
  venueName: string;
  image: string;
  createdBy: string;
  isVerified: boolean;
  createdAt: any;
  updatedAt: any;
}

export default function AdminFloorPlansPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [plans, setPlans]     = useState<FloorPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [uploading, setUploading] = useState(false);

  // New plan form
  const [newPlaceId,    setNewPlaceId]    = useState('');
  const [newVenueName,  setNewVenueName]  = useState('');
  const [newImage,      setNewImage]      = useState<string | null>(null);
  const [showAddForm,   setShowAddForm]   = useState(false);

  useEffect(() => {
    if (!user) return;
    const role = (user as any)?.role;
    if (role !== 'admin') { router.push('/'); return; }
    loadPlans();
  }, [user]);

  async function loadPlans() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'floorPlans'));
      setPlans(snap.docs.map(d => ({ placeId: d.id, ...d.data() } as FloorPlan)));
    } finally { setLoading(false); }
  }

  async function toggleVerified(plan: FloorPlan) {
    await updateDoc(doc(db, 'floorPlans', plan.placeId), {
      isVerified: !plan.isVerified,
      updatedAt: serverTimestamp(),
    });
    setPlans(prev => prev.map(p => p.placeId === plan.placeId ? { ...p, isVerified: !p.isVerified } : p));
  }

  async function deletePlan(placeId: string) {
    if (!confirm('Delete this floor plan? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'floorPlans', placeId));
    setPlans(prev => prev.filter(p => p.placeId !== placeId));
  }

  async function handleAddPlan() {
    if (!newPlaceId.trim() || !newVenueName.trim() || !newImage || !user?.uid) return;
    setUploading(true);
    try {
      await setDoc(doc(db, 'floorPlans', newPlaceId.trim()), {
        placeId:    newPlaceId.trim(),
        venueName:  newVenueName.trim(),
        image:      newImage,
        createdBy:  user.uid,
        isVerified: true,  // admin-uploaded = auto-verified
        createdAt:  serverTimestamp(),
        updatedAt:  serverTimestamp(),
      });
      setNewPlaceId(''); setNewVenueName(''); setNewImage(null); setShowAddForm(false);
      await loadPlans();
    } finally { setUploading(false); }
  }

  const filtered = plans.filter(p =>
    p.venueName?.toLowerCase().includes(search.toLowerCase()) ||
    p.placeId?.toLowerCase().includes(search.toLowerCase())
  );

  const s = {
    page:  { minHeight: '100vh', background: '#0a0a0f', color: '#fff', padding: '24px 20px' } as React.CSSProperties,
    card:  { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16, marginBottom: 12 } as React.CSSProperties,
    img:   { width: '100%', borderRadius: 8, marginBottom: 10, maxHeight: 200, objectFit: 'cover' as const } as React.CSSProperties,
    input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #1e1e2e', background: '#0a0a0f', color: '#fff', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' as const } as React.CSSProperties,
  };
  const badge = (v: boolean): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: v ? '#166534' : '#1e1e2e', color: v ? '#86efac' : '#555' });
  const btn = (color = '#f97316'): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 8, border: 'none', background: color, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' });

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🗺️ Floor Plan Manager</h1>
          <p style={{ color: '#555', fontSize: 12, margin: '4px 0 0' }}>{plans.length} venues · {plans.filter(p => p.isVerified).length} verified</p>
        </div>
        <button style={btn()} onClick={() => setShowAddForm(!showAddForm)}>
          + Add Venue Plan
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{ ...s.card, border: '1px solid #f97316' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add New Floor Plan</h3>
          <input style={s.input} placeholder="Google Place ID (e.g. ChIJN1t_tDeuEmsRUsoyG83frY4)" value={newPlaceId} onChange={e => setNewPlaceId(e.target.value)} />
          <input style={s.input} placeholder="Venue Name (e.g. Karibe Convention Center)" value={newVenueName} onChange={e => setNewVenueName(e.target.value)} />
          <label style={{ display: 'block', marginBottom: 10 }}>
            <div style={{ padding: '12px 16px', borderRadius: 8, border: '2px dashed #1e1e2e', textAlign: 'center', cursor: 'pointer', color: '#666', fontSize: 13 }}>
              {newImage ? '✅ Image loaded — click to replace' : '📷 Upload floor plan image'}
            </div>
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const compressed = await compressImage(file, 800);
                setNewImage(compressed);
              }} />
          </label>
          {newImage && <img src={newImage} alt="preview" style={{ ...s.img, maxHeight: 150 }} />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn()} onClick={handleAddPlan} disabled={uploading}>
              {uploading ? '⏳ Saving...' : '✅ Save Plan'}
            </button>
            <button style={btn('#1e1e2e')} onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <input style={s.input} placeholder="🔍 Search by venue name or Place ID..." value={search} onChange={e => setSearch(e.target.value)} />

      {/* Plans list */}
      {loading ? (
        <p style={{ color: '#555', textAlign: 'center', padding: 40 }}>Loading floor plans...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🏟️</p>
          <p style={{ color: '#555', fontSize: 14 }}>No floor plans yet.</p>
          <p style={{ color: '#333', fontSize: 12, marginTop: 4 }}>Organizers upload them when creating events. You can also add them manually above.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map(plan => (
            <div key={plan.placeId} style={s.card}>
              <img src={plan.image} alt={plan.venueName} style={s.img} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{plan.venueName}</p>
                  <p style={{ color: '#555', fontSize: 10, wordBreak: 'break-all' }}>{plan.placeId}</p>
                </div>
                <span style={badge(plan.isVerified)}>
                  {plan.isVerified ? '✓ Verified' : 'Unverified'}
                </span>
              </div>
              <p style={{ color: '#555', fontSize: 11, marginBottom: 10 }}>
                Uploaded by: {plan.createdBy?.slice(0, 8)}...
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={btn(plan.isVerified ? '#374151' : '#166534')} onClick={() => toggleVerified(plan)}>
                  {plan.isVerified ? '✗ Unverify' : '✓ Verify'}
                </button>
                <button style={btn('#7f1d1d')} onClick={() => deletePlan(plan.placeId)}>
                  🗑 Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

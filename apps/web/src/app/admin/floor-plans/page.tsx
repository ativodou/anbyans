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

  const [plans, setPlans]         = useState<FloorPlan[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [newPlaceId,   setNewPlaceId]   = useState('');
  const [newVenueName, setNewVenueName] = useState('');
  const [newImage,     setNewImage]     = useState<string | null>(null);
  const [showAddForm,  setShowAddForm]  = useState(false);

  useEffect(() => {
    if (!user) return;
    if ((user as any)?.role !== 'admin') { router.push('/'); return; }
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
    await updateDoc(doc(db, 'floorPlans', plan.placeId), { isVerified: !plan.isVerified, updatedAt: serverTimestamp() });
    setPlans(prev => prev.map(p => p.placeId === plan.placeId ? { ...p, isVerified: !p.isVerified } : p));
  }

  async function deletePlan(placeId: string) {
    await deleteDoc(doc(db, 'floorPlans', placeId));
    setPlans(prev => prev.filter(p => p.placeId !== placeId));
    setConfirmDelete(null);
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
        isVerified: true,
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

  return (
    <div className="min-h-screen bg-dark text-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl">🗺️ Floor Plans</h1>
          <p className="text-[11px] text-gray-muted mt-1">{plans.length} venues · {plans.filter(p => p.isVerified).length} verified</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2.5 rounded-xl bg-orange text-black text-xs font-bold">
          + Add Venue Plan
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-dark-card border border-orange rounded-2xl p-5 mb-5">
          <h3 className="text-sm font-bold mb-4">Add New Floor Plan</h3>
          <input
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange mb-3 placeholder:text-gray-muted"
            placeholder="Google Place ID (e.g. ChIJN1t_tDeuEmsRUsoyG83frY4)"
            value={newPlaceId} onChange={e => setNewPlaceId(e.target.value)} />
          <input
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border text-white text-sm outline-none focus:border-orange mb-3 placeholder:text-gray-muted"
            placeholder="Venue Name (e.g. Karibe Convention Center)"
            value={newVenueName} onChange={e => setNewVenueName(e.target.value)} />
          <label className="block mb-3 cursor-pointer">
            <div className="px-4 py-3 rounded-xl border-2 border-dashed border-border text-center text-gray-muted text-sm hover:border-orange transition-all">
              {newImage ? '✅ Image loaded — click to replace' : '📷 Upload floor plan image'}
            </div>
            <input type="file" accept="image/*" className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const compressed = await compressImage(file, 800);
                setNewImage(compressed);
              }} />
          </label>
          {newImage && <img src={newImage} alt="preview" className="w-full rounded-xl mb-3 max-h-40 object-cover" />}
          <div className="flex gap-2">
            <button onClick={handleAddPlan} disabled={uploading}
              className="px-4 py-2.5 rounded-xl bg-orange text-black text-xs font-bold disabled:opacity-50">
              {uploading ? '⏳ Saving...' : '✅ Save Plan'}
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] border border-border text-gray-light text-xs font-bold hover:text-white transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        className="w-full px-4 py-3 rounded-xl bg-dark-card border border-border text-white text-sm outline-none focus:border-orange mb-4 placeholder:text-gray-muted"
        placeholder="🔍 Search by venue name or Place ID..."
        value={search} onChange={e => setSearch(e.target.value)} />

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🏟️</p>
          <p className="text-gray-muted text-sm mb-1">No floor plans yet.</p>
          <p className="text-gray-muted text-xs">Organizers upload them when creating events. You can also add them manually above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(plan => (
            <div key={plan.placeId} className="bg-dark-card border border-border rounded-xl p-4">
              <img src={plan.image} alt={plan.venueName} className="w-full rounded-xl mb-3 max-h-48 object-cover" />
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{plan.venueName}</p>
                  <p className="text-[10px] text-gray-muted break-all mt-0.5">{plan.placeId}</p>
                </div>
                <span className={`ml-2 text-[9px] font-bold px-2 py-0.5 rounded border ${plan.isVerified ? 'bg-green-dim text-green border-green/20' : 'bg-white/[0.05] text-gray-muted border-border'}`}>
                  {plan.isVerified ? '✓ Verified' : 'Unverified'}
                </span>
              </div>
              <p className="text-[11px] text-gray-muted mb-3">Uploaded by: {plan.createdBy?.slice(0, 8)}...</p>
              <div className="flex gap-2">
                <button onClick={() => toggleVerified(plan)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${plan.isVerified ? 'bg-white/[0.05] text-gray-light border-border hover:text-white' : 'bg-green-dim text-green border-green/30'}`}>
                  {plan.isVerified ? '✗ Unverify' : '✓ Verify'}
                </button>
                {confirmDelete === plan.placeId ? (
                  <div className="flex gap-1 flex-1">
                    <button onClick={() => deletePlan(plan.placeId)} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-red text-white">✓</button>
                    <button onClick={() => setConfirmDelete(null)} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-white/[0.05] border border-border text-gray-light">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(plan.placeId)}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-red/10 border border-red/20 text-red hover:bg-red/20 transition-all">
                    🗑 Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

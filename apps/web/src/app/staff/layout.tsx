'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    // Allow staff and organizers (organizers can preview staff view)
    const role = user.role as string;
    if (role !== 'staff' && role !== 'organizer' && role !== 'admin') {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || user.email || 'Staff';

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      {/* Minimal header */}
      <header className="border-b border-border bg-dark-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-heading font-black text-lg tracking-tight text-orange">ANBYANS</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-light truncate max-w-[140px]">{displayName}</span>
            <button
              onClick={() => logout()}
              className="text-[11px] text-gray-muted hover:text-white border border-border px-3 py-1.5 rounded-lg transition-colors"
            >
              Dekonekte
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

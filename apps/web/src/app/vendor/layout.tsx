'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const PUBLIC_PATHS = ['/vendor/auth', '/vendor/login', '/vendor/join'];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  useEffect(() => {
    if (loading || isPublic) return;
    if (!user) { router.push('/'); return; }
    if (user.role !== 'reseller' && user.role !== 'admin') router.push('/');
  }, [user, loading, isPublic]);

  return <>{children}</>;
}

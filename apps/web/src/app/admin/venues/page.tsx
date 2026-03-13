'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminVenuesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/dashboard?tab=venues'); }, [router]);
  return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-light">...</p></div>;
}

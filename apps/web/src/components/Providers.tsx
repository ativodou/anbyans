'use client';
import { I18nProvider } from '@/i18n';
import { AuthProvider } from '@/hooks/useAuth';
import NavBar from '@/components/NavBar';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const noNav = pathname === '/' || pathname.startsWith('/auth');
  return (
    <>
      {!noNav && user && <NavBar />}
      {children}
    </>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppShell>{children}</AppShell>
      </AuthProvider>
    </I18nProvider>
  );
}

'use client';
import { I18nProvider } from '@/i18n';
import { AuthProvider } from '@/hooks/useAuth';
import NavBar from '@/components/NavBar';
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const noNav =
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/organizer') ||
    pathname.startsWith('/vendor') ||
    pathname.startsWith('/admin');
  return (
    <>
      {/* Show NavBar as soon as auth resolves, or once user is known */}
      {!noNav && !loading && <NavBar />}
      {children}
    </>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppShell>{children}</AppShell>
        <ProgressBar
          height="3px"
          color="#06b6d4"
          options={{ showSpinner: false }}
          shallowRouting
        />
      </AuthProvider>
    </I18nProvider>
  );
}

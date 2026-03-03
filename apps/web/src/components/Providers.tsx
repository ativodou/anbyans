'use client';
import { I18nProvider } from '@/i18n';
import { AuthProvider } from '@/hooks/useAuth';
import NavBar from '@/components/NavBar';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <NavBar />
        {children}
      </AuthProvider>
    </I18nProvider>
  );
}

import type { Metadata } from 'next';
import '@/styles/globals.css';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Anbyans Entertainment — Evènman pou nou, pa nou',
  description: 'Premye platfòm tikè konplè pou Ayiti ak dyaspora a.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ht">
      <body className="min-h-screen bg-dark text-white font-body">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
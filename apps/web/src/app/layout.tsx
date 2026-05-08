import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import Providers from '@/components/Providers';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

export const metadata: Metadata = {
  title: 'Anbyans Entertainment — Evènman pou nou, pa nou',
  description: 'Premye platfòm tikè konplè pou Ayiti ak dyaspora a.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Anbyans',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  icons: {
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0D9488',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ht">
      <body className="min-h-screen bg-dark text-white font-body">
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

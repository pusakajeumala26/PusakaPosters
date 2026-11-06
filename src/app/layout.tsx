import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { PwaRegister } from '@/components/PwaRegister';
import { ToastProvider } from '@/components/ToastProvider';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'PusakaPosters', template: '%s · PusakaPosters' },
  description: 'Dashboard untuk mendata anggota leting Pusaka Jeumala dan mengumpulkan foto untuk poster branding.',
  applicationName: 'PusakaPosters',
  appleWebApp: { capable: true, title: 'PusakaPosters', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head><link rel="preload" as="image" href="/images/logo.svg" /></head>
      <body>
        <ToastProvider>
          {children}
          <PwaRegister />
        </ToastProvider>
      </body>
    </html>
  );
}

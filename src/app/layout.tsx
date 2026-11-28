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
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-theme="dark" data-theme-mode="system" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{const r=document.documentElement;const m=localStorage.getItem('pusaka-theme');const p=['system','light','dark'].includes(m)?m:'system';r.dataset.themeMode=p;r.dataset.theme=p==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):p}catch{document.documentElement.dataset.themeMode='system';document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}" }} />
        <link rel="preload" as="image" href="/brand/pusaka-jeumala.webp" />
      </head>
      <body>
        <ToastProvider>
          {children}
          <PwaRegister />
        </ToastProvider>
      </body>
    </html>
  );
}

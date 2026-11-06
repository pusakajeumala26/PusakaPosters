import { AppShell } from '@/components/AppShell';
import { isAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [settings, admin] = await Promise.all([getSettings(), isAdmin()]);
  return (
    <AppShell letingName={settings.letingName} admin={admin}>
      {children}
    </AppShell>
  );
}

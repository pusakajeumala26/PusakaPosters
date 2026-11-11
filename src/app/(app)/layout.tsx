import { AppShell } from '@/components/AppShell';
import { AppStage } from '@/components/AppStage';
import { isAdmin, isSuperAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [settings, admin, superAdmin] = await Promise.all([getSettings(), isAdmin(), isSuperAdmin()]);
  return (
    <AppStage><AppShell letingName={settings.letingName} admin={admin} superAdmin={superAdmin}>{children}</AppShell></AppStage>
  );
}

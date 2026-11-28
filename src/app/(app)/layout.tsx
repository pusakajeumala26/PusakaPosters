import { AppShell } from '@/components/AppShell';
import { AppStage } from '@/components/AppStage';
import { isAdmin, isSuperAdmin } from '@/lib/auth';
import { getMemberSession } from '@/lib/member-auth';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [settings, admin, superAdmin, memberSession] = await Promise.all([getSettings(), isAdmin(), isSuperAdmin(), getMemberSession()]);
  return (
    <AppStage><AppShell letingName={settings.letingName} admin={admin} superAdmin={superAdmin} member={memberSession ? { name: memberSession.member.name } : null}>{children}</AppShell></AppStage>
  );
}

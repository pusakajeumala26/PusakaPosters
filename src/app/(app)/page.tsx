import { HomeView } from '@/components/HomeView';
import { isAdmin } from '@/lib/auth';
import { getStats, listMembers } from '@/lib/members';
import { getSettings } from '@/lib/settings';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ upload?: string }> }) {
  const [settings, admin, params] = await Promise.all([getSettings(), isAdmin(), searchParams]);
  const [members, stats] = await Promise.all([listMembers(admin), getStats(settings)]);
  return (
    <HomeView
      members={members}
      stats={stats}
      admin={admin}
      uploadOpen={settings.uploadOpen}
      autoUpload={params.upload === '1'}
    />
  );
}

import { HomeView } from '@/components/HomeView';
import { isAdmin } from '@/lib/auth';
import { getStats, listMembers } from '@/lib/members';
import { getSettings } from '@/lib/settings';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ upload?: string }> }) {
  // Mulai semua query sekaligus: daftar anggota hanya butuh status admin, statistik hanya butuh pengaturan.
  const adminPromise = isAdmin();
  const settingsPromise = getSettings();
  const [settings, admin, params, members, stats] = await Promise.all([
    settingsPromise,
    adminPromise,
    searchParams,
    adminPromise.then((isAdminUser) => listMembers(isAdminUser)),
    settingsPromise.then((s) => getStats(s)),
  ]);
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

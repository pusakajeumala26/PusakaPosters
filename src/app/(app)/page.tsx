import { HomeView } from '@/components/HomeView';
import { MemberAccessView } from '@/components/MemberAccessView';
import { MemberProfileView } from '@/components/MemberProfileView';
import { isAdmin } from '@/lib/auth';
import { getMemberSession } from '@/lib/member-auth';
import { getMemberProfile, getStats, listMembers } from '@/lib/members';
import { getSettings } from '@/lib/settings';

export default async function HomePage() {
  const [admin, session] = await Promise.all([isAdmin(), getMemberSession()]);
  if (admin) {
    const [settings, members] = await Promise.all([getSettings(), listMembers()]);
    const stats = await getStats(settings);
    return <HomeView members={members} stats={stats} admin uploadOpen={settings.uploadOpen} autoUpload={false} />;
  }
  if (session) {
    const member = await getMemberProfile(session.memberId);
    if (member) return <MemberProfileView member={member} />;
  }
  return <MemberAccessView />;
}

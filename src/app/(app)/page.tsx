import { AdminDashboardView } from '@/components/AdminDashboardView';
import { MemberAccessView } from '@/components/MemberAccessView';
import { MemberProfileView } from '@/components/MemberProfileView';
import { isAdmin } from '@/lib/auth';
import { getMemberSession } from '@/lib/member-auth';
import { getMemberProfile } from '@/lib/members';
import { getAdminDashboardData } from '@/lib/admin-dashboard';

export default async function HomePage() {
 const [admin,session]=await Promise.all([isAdmin(),getMemberSession()]);
 if(admin) return <AdminDashboardView {...await getAdminDashboardData()} />;
 if(session){const member=await getMemberProfile(session.memberId);if(member)return <MemberProfileView member={member}/>;}
 return <MemberAccessView/>;
}

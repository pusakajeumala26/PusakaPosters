import { MemberAccessView } from '@/components/MemberAccessView';
import { MemberProfileView } from '@/components/MemberProfileView';
import { isAdmin } from '@/lib/auth';
import { getMemberSession } from '@/lib/member-auth';
import { getMemberProfile } from '@/lib/members';
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }){
 const [{edit},admin,session]=await Promise.all([searchParams,isAdmin(),getMemberSession()]);
 if(admin||!session)return <MemberAccessView/>;
 const member=await getMemberProfile(session.memberId);
 return member?<MemberProfileView member={member} autoEdit={edit==='1'}/>:<MemberAccessView/>;
}

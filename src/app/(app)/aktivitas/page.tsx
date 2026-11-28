import { MemberAccessView } from '@/components/MemberAccessView';
import { MemberActivityView } from '@/components/MemberActivityView';
import { isAdmin } from '@/lib/auth';
import { getMemberSession } from '@/lib/member-auth';
import { getMemberProfile } from '@/lib/members';
export default async function ActivityPage(){
 const [admin,session]=await Promise.all([isAdmin(),getMemberSession()]);
 if(admin||!session)return <MemberAccessView/>;
 const member=await getMemberProfile(session.memberId);
 return member?<MemberActivityView member={member}/>:<MemberAccessView/>;
}

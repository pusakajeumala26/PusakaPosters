import type { Metadata } from 'next';
import { SecurityView } from '@/components/SecurityView';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { isSuperAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'Security' };

export default async function SecurityPage() {
  if (!(await isSuperAdmin())) return <SuperAdminGate pageName="Security" />;
  return <SecurityView />;
}

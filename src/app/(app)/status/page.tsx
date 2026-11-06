import type { Metadata } from 'next';
import { AdminGate } from '@/components/AdminGate';
import { StatusBoard } from '@/components/StatusBoard';
import { isAdmin } from '@/lib/auth';
import { listMembers } from '@/lib/members';

export const metadata: Metadata = { title: 'Status Poster' };

export default async function StatusPage() {
  if (!(await isAdmin())) return <AdminGate pageName="Status Poster" />;
  return <StatusBoard members={await listMembers(true)} />;
}

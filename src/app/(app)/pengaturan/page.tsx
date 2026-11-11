import type { Metadata } from 'next';
import { AdminGate } from '@/components/AdminGate';
import { SettingsView } from '@/components/SettingsView';
import { isAdmin } from '@/lib/auth';
import { getPortfolioStatus } from '@/lib/feedback-service';
import { listMembers, toSettingsView } from '@/lib/members';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Pengaturan' };

export default async function SettingsPage() {
  if (!(await isAdmin())) return <AdminGate pageName="Pengaturan" />;
  const [settings, members, portfolio] = await Promise.all([getSettings(), listMembers(true), getPortfolioStatus()]);
  return <SettingsView settings={toSettingsView(settings)} members={members} portfolio={portfolio} />;
}

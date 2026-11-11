import type { Metadata } from 'next';
import { McpServerView } from '@/components/McpServerView';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { isSuperAdmin } from '@/lib/auth';
import { getPortfolioStatus } from '@/lib/feedback-service';

export const metadata: Metadata = { title: 'MCP Server' };

export default async function McpServerPage() {
  if (!(await isSuperAdmin())) return <SuperAdminGate pageName="MCP Server" />;
  return <McpServerView portfolio={await getPortfolioStatus()} />;
}

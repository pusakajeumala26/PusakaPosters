import type { Metadata } from 'next';
import { after } from 'next/server';
import { AdminGate } from '@/components/AdminGate';
import { FeedbackAdmin } from '@/components/FeedbackAdmin';
import { isAdmin } from '@/lib/auth';
import { listFeedback, processDueFeedback } from '@/lib/feedback-service';

export const metadata: Metadata = { title: 'Feedback' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function FeedbackAdminPage() {
  if (!(await isAdmin())) return <AdminGate pageName="Feedback" />;
  // Membuka halaman ini juga memicu pengiriman ulang otomatis untuk antrean yang jatuh tempo.
  after(async () => {
    try { await processDueFeedback(); } catch { console.error('[feedback] process due failed'); }
  });
  return <FeedbackAdmin rows={await listFeedback()} />;
}

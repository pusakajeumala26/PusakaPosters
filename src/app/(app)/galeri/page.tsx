import type { Metadata } from 'next';
import { AdminGate } from '@/components/AdminGate';
import { GalleryView } from '@/components/GalleryView';
import { isAdmin } from '@/lib/auth';
import { listMembers } from '@/lib/members';

export const metadata: Metadata = { title: 'Galeri Foto' };

export default async function GalleryPage() {
  if (!(await isAdmin())) return <AdminGate pageName="Galeri Foto" />;
  return <GalleryView members={await listMembers(true)} />;
}

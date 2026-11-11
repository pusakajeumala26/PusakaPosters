/** Tipe tampilan feedback/koneksi yang dipakai server dan komponen klien (tanpa nilai runtime). */

export type PortfolioStatus = {
  url: string;
  hasKey: boolean;
  keyHint: string | null;
  connected: boolean;
  keyUnreadable: boolean;
  lastTest: { at: string; ok: boolean; kind: string | null; ms: number | null; note: string | null } | null;
  queue: { queued: number; failed: number; sent: number };
};

export type FeedbackRowView = {
  id: string;
  name: string;
  role: string | null;
  message: string;
  rating: number;
  avatarUrl: string | null;
  syncStatus: 'QUEUED' | 'SENT' | 'FAILED';
  attempts: number;
  lastError: string | null;
  lastErrorText: string | null;
  uncertain: boolean;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

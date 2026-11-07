export type Gender = 'L' | 'P';
export const GENDER_LABELS: Record<Gender, string> = { L: 'Pria', P: 'Wanita' };
export type PosterStatus = 'MASUK' | 'DESAIN' | 'SIAP' | 'POSTING';

export const STATUS_META: { id: PosterStatus; label: string; chip: string }[] = [
  { id: 'MASUK', label: 'Foto masuk', chip: 'chip chip-masuk' },
  { id: 'DESAIN', label: 'Didesain', chip: 'chip chip-desain' },
  { id: 'SIAP', label: 'Siap posting', chip: 'chip chip-siap' },
  { id: 'POSTING', label: 'Terposting', chip: 'chip chip-posting' },
];

export type MemberView = {
  id: string;
  name: string;
  quote: string;
  gender: Gender;
  countryCode: string;
  /** Untuk non-admin: "+62 •••• 1021". Untuk admin: nomor lengkap. */
  phoneDisplay: string;
  status: PosterStatus;
  createdAt: string;
  /** URL bertanda tangan: foto tanpa latar, atau foto asli jika belum ada. */
  photoUrl: string | null;
  hasCutout: boolean;
  /** Hanya terisi untuk admin */
  phone?: string;
  folder?: string;
  cutoutUrl?: string | null;
  cutoutPath?: string | null;
  originalUrl?: string | null;
};

export type DayStat = { label: string; n: number; today: boolean };

export type Stats = {
  count: number;
  target: number;
  pct: number;
  left: number;
  deadlineLabel: string;
  days: DayStat[];
};

export type SettingsView = {
  letingName: string;
  target: number;
  /** YYYY-MM-DD (WIB) atau string kosong */
  deadline: string;
  uploadOpen: boolean;
};

/** Data yang boleh diedit anggota setelah verifikasi password. */
export type EditableMember = {
  name: string;
  countryCode: string;
  phone: string;
  gender: Gender;
};

/** Konstanta yang aman dipakai di server maupun browser. */

export const COUNTRY_OPTIONS = [
  { code: '+62', label: 'ID +62' },
  { code: '+60', label: 'MY +60' },
  { code: '+65', label: 'SG +65' },
  { code: '+966', label: 'SA +966' },
  { code: '+20', label: 'EG +20' },
  { code: '+90', label: 'TR +90' },
  { code: '+212', label: 'MA +212' },
  { code: '+1', label: 'US +1' },
] as const;

export const COUNTRY_CODES = ['+62', '+60', '+65', '+966', '+20', '+90', '+212', '+1'] as const;

/** WIB (Aceh) = UTC+7, tanpa DST. Dipakai untuk "hari ini" di grafik harian. */
export const APP_TZ = 'Asia/Jakarta';
export const APP_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

export const QUOTE_MAX = 120;

/** Batas body request di Vercel adalah 4,5 MB; sisakan ruang untuk field teks. */
export const MAX_UPLOAD_TOTAL_BYTES = 4.2 * 1024 * 1024;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 1600;

/** Ukuran thumbnail yang boleh diminta; nilai lain jatuh ke ukuran bawaan agar cache CDN tidak membengkak. */
export const THUMB_WIDTHS = [160, 480] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];
export const DEFAULT_THUMB_WIDTH: ThumbWidth = 480;

/** Alamat thumbnail yang stabil; versi (updatedAt) membuat cache browser/CDN berganti saat foto diubah. */
export const thumbPath = (id: string, version: number) => `/api/members/${encodeURIComponent(id)}/thumb?v=${version}`;

export const thumbSrc = (url: string | null, width: ThumbWidth): string | null => (url ? `${url}&w=${width}` : null);

export function parseThumbWidth(raw: string | null): ThumbWidth {
  const n = Number(raw);
  return (THUMB_WIDTHS as readonly number[]).includes(n) ? (n as ThumbWidth) : DEFAULT_THUMB_WIDTH;
}

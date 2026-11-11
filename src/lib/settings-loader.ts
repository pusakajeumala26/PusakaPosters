import { Prisma, type Setting } from '@prisma/client';

export type SettingsSource = {
  find: () => Promise<Setting | null>;
  create: () => Promise<Setting>;
};

/**
 * Baca baris pengaturan tunggal; buat hanya jika belum ada. Membaca dulu karena
 * upsert menulis ke database pada setiap permintaan, padahal barisnya hampir selalu ada.
 */
export async function findOrCreateSetting(source: SettingsSource): Promise<Setting> {
  const existing = await source.find();
  if (existing) return existing;
  try {
    return await source.create();
  } catch (error) {
    // Permintaan lain membuatnya lebih dulu: baca hasilnya.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const created = await source.find();
      if (created) return created;
    }
    throw error;
  }
}

import { cache } from 'react';
import { db } from './db';
import { findOrCreateSetting } from './settings-loader';

/** Baca (atau buat) baris pengaturan tunggal. Tanpa cache: untuk route handler & auth. */
export const loadSettings = () =>
  findOrCreateSetting({
    find: () => db.setting.findUnique({ where: { id: 1 } }),
    create: () => db.setting.create({ data: { id: 1 } }),
  });

/** Versi ber-cache per request untuk Server Components. */
export const getSettings = cache(loadSettings);

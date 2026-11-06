import { cache } from 'react';
import { db } from './db';

/** Baca (atau buat) baris pengaturan tunggal. Tanpa cache: untuk route handler & auth. */
export const loadSettings = () => db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

/** Versi ber-cache per request untuk Server Components. */
export const getSettings = cache(loadSettings);

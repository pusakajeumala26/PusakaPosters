import { formString, HttpError } from './http';
import { memberFields } from './validation';

/** Baca & validasi field teks anggota dari FormData (dipakai POST dan PATCH). */
export function parseMemberFields(form: FormData) {
  const r = memberFields.safeParse({
    name: formString(form.get('name')),
    countryCode: formString(form.get('countryCode')),
    phone: formString(form.get('phone')),
    gender: formString(form.get('gender')),
  });
  if (!r.success) throw new HttpError(422, r.error.issues[0]?.message ?? 'Data tidak valid.');
  return r.data;
}

export const isUniqueViolation = (e: unknown) => (e as { code?: string } | null)?.code === 'P2002';

export const optionalFile = (v: FormDataEntryValue | null) => (v instanceof File && v.size > 0 ? v : null);

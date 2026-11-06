export type AdminContact = { name: string; phone: string; title: string };

export const ADMIN_CONTACTS = [
  { name: 'Ata Sidqi', phone: '08136173909', title: 'Ketua Leting' },
  { name: 'Alfiz Ilham', phone: '085213896460', title: 'Sekretaris 1' },
  { name: 'Raisya Zumara', phone: '081262040241', title: 'Bendahara' },
  { name: 'Naurah Syifa', phone: '082277247480', title: 'Sekretaris 2' },
  { name: 'Fasyadil Ridha', phone: '085191815396', title: 'Divisi Media' },
] as const satisfies readonly AdminContact[];

export function toWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

export function formatNationalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

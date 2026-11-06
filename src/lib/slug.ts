/** "Nurul Aini Safira" -> "nurul-aini-safira". Nama non-Latin jatuh ke "anggota". */
export function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'anggota'
  );
}

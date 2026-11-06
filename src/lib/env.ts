export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} belum diisi (lihat .env.example).`);
  return v;
}

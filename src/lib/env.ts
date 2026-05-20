/**
 * Variables de entorno requeridas. Centralizadas y validadas en un solo lugar.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[env] Variable de entorno faltante: ${name}. Revisa tu .env.local.`
    );
  }
  return value;
}

export const env = {
  supabase: {
    url: required(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    anonKey: required(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    // service role solo en server; puede estar vacío en local hasta que se necesite
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },
  tenor: {
    apiKey: process.env.TENOR_API_KEY ?? '',
  },
  giphy: {
    apiKey: process.env.GIPHY_API_KEY ?? '',
  },
} as const;

export interface DatabaseUrlOptions {
  requireSupabase?: boolean;
}

export function isSupabaseDatabaseHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "supabase.co"
    || host.endsWith(".supabase.co")
    || host === "supabase.com"
    || host.endsWith(".supabase.com");
}

export function requireDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  options: DatabaseUrlOptions = {},
): string {
  const raw = env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error("DATABASE_URL is required. Use the PostgreSQL connection string from Supabase.");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string.");
  }

  const requireSupabase = options.requireSupabase ?? env.NODE_ENV === "production";
  if (requireSupabase && !isSupabaseDatabaseHost(parsed.hostname)) {
    throw new Error("Production DATABASE_URL must point to Supabase, not Replit or another database provider.");
  }

  return raw;
}

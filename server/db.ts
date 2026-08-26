import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { requireDatabaseUrl } from "./config/database";

const pool = new pg.Pool({
  connectionString: requireDatabaseUrl(),
});

export const db = drizzle(pool, { schema });

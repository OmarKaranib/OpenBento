import { defineConfig } from "drizzle-kit";
import { requireDatabaseUrl } from "./server/config/database";

const databaseUrl = requireDatabaseUrl();

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});

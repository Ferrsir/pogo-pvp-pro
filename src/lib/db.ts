import "server-only";

import { neon } from "@neondatabase/serverless";

let databaseClient: ReturnType<typeof neon> | null = null;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!databaseClient) {
    databaseClient = neon(connectionString);
  }

  return databaseClient;
}

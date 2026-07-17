import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const migrationUrl = new URL("../db/migrations/001_initial.sql", import.meta.url);
const migration = await readFile(migrationUrl, "utf8");
const statements = migration
  .split("-- statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);

const sql = neon(connectionString);
for (const statement of statements) {
  await sql.query(statement);
}

console.log(`Applied ${statements.length} database statements.`);

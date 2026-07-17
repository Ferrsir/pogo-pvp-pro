import { readdir, readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const sql = neon(connectionString);
const migrationsUrl = new URL("../db/migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationsUrl)).filter((file) => file.endsWith(".sql")).sort();
let statementCount = 0;

for (const migrationFile of migrationFiles) {
  const migration = await readFile(new URL(migrationFile, migrationsUrl), "utf8");
  const statements = migration
    .split("-- statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
    statementCount += 1;
  }
}

console.log(`Applied ${statementCount} statements from ${migrationFiles.length} migration files.`);

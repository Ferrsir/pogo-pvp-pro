import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isSameOriginRequest, jsonError, readJson } from "@/lib/http";
import { trainerStateSchema } from "@/lib/validation";

export const runtime = "nodejs";

type StateRow = {
  collection: unknown;
  saved_teams: unknown;
  updated_at: string;
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Sign in to load your collection.", 401);

    const sql = getDb();
    const rows = await sql`
      SELECT collection, saved_teams, updated_at
      FROM trainer_data
      WHERE user_id = ${user.id}
      LIMIT 1
    ` as StateRow[];
    const state = rows[0];

    return Response.json({
      collection: state?.collection ?? [],
      savedTeams: state?.saved_teams ?? [],
      updatedAt: state?.updated_at ?? null,
    });
  } catch (error) {
    console.error("Trainer data load failed", error);
    return jsonError("We couldn’t load your saved data.", 500);
  }
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin was rejected.", 403);

  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Sign in to save your collection.", 401);

    const parsed = trainerStateSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError("Some roster data could not be saved.", 400, parsed.error.flatten().fieldErrors);

    const sql = getDb();
    await sql`
      INSERT INTO trainer_data (user_id, collection, saved_teams, updated_at)
      VALUES (
        ${user.id},
        ${JSON.stringify(parsed.data.collection)}::jsonb,
        ${JSON.stringify(parsed.data.savedTeams)}::jsonb,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        collection = EXCLUDED.collection,
        saved_teams = EXCLUDED.saved_teams,
        updated_at = NOW()
    `;

    return Response.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Trainer data save failed", error);
    return jsonError("We couldn’t save your changes.", 500);
  }
}

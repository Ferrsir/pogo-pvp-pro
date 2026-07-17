import { randomUUID } from "node:crypto";
import { createSession, hashPassword, normalizeUsername, setSessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isSameOriginRequest, isUniqueViolation, jsonError, readJson } from "@/lib/http";
import { signupSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin was rejected.", 403);

  try {
    const parsed = signupSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError("Check the highlighted account details.", 400, parsed.error.flatten().fieldErrors);

    const { username, password, team, trainerLevel } = parsed.data;
    const sql = getDb();
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);

    await sql`
      INSERT INTO users (id, username, username_normalized, password_hash, team, trainer_level)
      VALUES (${userId}, ${username}, ${normalizeUsername(username)}, ${passwordHash}, ${team}, ${trainerLevel})
    `;
    await sql`
      INSERT INTO trainer_data (user_id, collection, saved_teams)
      VALUES (${userId}, ${JSON.stringify([])}::jsonb, ${JSON.stringify([])}::jsonb)
    `;

    const session = await createSession(userId);
    await setSessionCookie(session.token, session.expiresAt);

    return Response.json({ user: { id: userId, username, team, trainerLevel } }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return jsonError("That username is already taken.", 409);
    console.error("Account creation failed", error);
    return jsonError("We couldn’t create the account right now.", 500);
  }
}

import { getCurrentUser, normalizeUsername } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isSameOriginRequest, isUniqueViolation, jsonError, readJson } from "@/lib/http";
import { profileSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin was rejected.", 403);

  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Sign in to update your profile.", 401);

    const parsed = profileSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError("Check the highlighted profile details.", 400, parsed.error.flatten().fieldErrors);

    const { username, team, trainerLevel } = parsed.data;
    const sql = getDb();
    await sql`
      UPDATE users
      SET username = ${username},
          username_normalized = ${normalizeUsername(username)},
          team = ${team},
          trainer_level = ${trainerLevel},
          updated_at = NOW()
      WHERE id = ${user.id}
    `;

    return Response.json({ user: { ...user, username, team, trainerLevel } });
  } catch (error) {
    if (isUniqueViolation(error)) return jsonError("That username is already taken.", 409);
    console.error("Profile update failed", error);
    return jsonError("We couldn’t update your profile right now.", 500);
  }
}

import {
  authAttemptKey,
  clearLoginAttempts,
  createSession,
  hashPassword,
  isLoginBlocked,
  normalizeUsername,
  recordFailedLogin,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import type { TrainerTeam } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getClientAddress, isSameOriginRequest, jsonError, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

type LoginRow = {
  id: string;
  username: string;
  password_hash: string;
  team: TrainerTeam;
  trainer_level: number;
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin was rejected.", 403);

  try {
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError("Enter a valid username and password.", 400, parsed.error.flatten().fieldErrors);

    const { username, password } = parsed.data;
    const attemptKey = authAttemptKey(username, getClientAddress(request));
    if (await isLoginBlocked(attemptKey)) return jsonError("Too many attempts. Try again in 15 minutes.", 429);

    const sql = getDb();
    const rows = await sql`
      SELECT id, username, password_hash, team, trainer_level
      FROM users
      WHERE username_normalized = ${normalizeUsername(username)}
      LIMIT 1
    ` as LoginRow[];
    const user = rows[0];
    const passwordMatches = user ? await verifyPassword(password, user.password_hash) : Boolean(await hashPassword(password)) && false;

    if (!user || !passwordMatches) {
      await recordFailedLogin(attemptKey);
      return jsonError("Username or password is incorrect.", 401);
    }

    await clearLoginAttempts(attemptKey);
    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);

    return Response.json({
      user: { id: user.id, username: user.username, team: user.team, trainerLevel: user.trainer_level },
    });
  } catch (error) {
    console.error("Sign in failed", error);
    return jsonError("We couldn’t sign you in right now.", 500);
  }
}

import "server-only";

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import type { trainerTeams } from "@/lib/validation";

const SESSION_COOKIE = "pogo_pvp_session";
const SESSION_DAYS = 30;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 16_384;

export type TrainerTeam = (typeof trainerTeams)[number];

export type UserProfile = {
  id: string;
  username: string;
  team: TrainerTeam;
  trainerLevel: number;
};

type UserRow = {
  id: string;
  username: string;
  team: TrainerTeam;
  trainer_level: number;
};

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function derivePassword(password: string, salt: Buffer, cost: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_LENGTH, { N: cost, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await derivePassword(password, salt, SCRYPT_COST);
  return `scrypt$${SCRYPT_COST}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, costValue, saltValue, keyValue] = storedHash.split("$");
  if (algorithm !== "scrypt" || !costValue || !saltValue || !keyValue) return false;

  const cost = Number(costValue);
  const salt = Buffer.from(saltValue, "base64url");
  const storedKey = Buffer.from(keyValue, "base64url");
  if (!Number.isInteger(cost) || storedKey.length !== SCRYPT_KEY_LENGTH) return false;

  const suppliedKey = await derivePassword(password, salt, cost);
  return timingSafeEqual(storedKey, suppliedKey);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const sql = getDb();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (${randomUUID()}, ${userId}, ${tokenHash}, ${expiresAt})
  `;

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sql = getDb();
  const rows = await sql`
    SELECT u.id, u.username, u.team, u.trainer_level
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashSessionToken(token)}
      AND s.expires_at > NOW()
    LIMIT 1
  ` as UserRow[];

  const user = rows[0];
  if (!user) return null;
  return { id: user.id, username: user.username, team: user.team, trainerLevel: user.trainer_level };
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const sql = getDb();
    await sql`DELETE FROM sessions WHERE token_hash = ${hashSessionToken(token)}`;
  }
  await clearSessionCookie();
}

export function authAttemptKey(username: string, clientAddress: string) {
  return createHash("sha256").update(`${normalizeUsername(username)}|${clientAddress}`).digest("hex");
}

export async function isLoginBlocked(keyHash: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT blocked_until
    FROM auth_attempts
    WHERE key_hash = ${keyHash}
    LIMIT 1
  ` as { blocked_until: string | null }[];
  const blockedUntil = rows[0]?.blocked_until;
  return Boolean(blockedUntil && new Date(blockedUntil).getTime() > Date.now());
}

export async function recordFailedLogin(keyHash: string) {
  const sql = getDb();
  await sql`
    INSERT INTO auth_attempts (key_hash, attempts, window_started, blocked_until)
    VALUES (${keyHash}, 1, NOW(), NULL)
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE
        WHEN auth_attempts.window_started < NOW() - INTERVAL '15 minutes' THEN 1
        ELSE auth_attempts.attempts + 1
      END,
      window_started = CASE
        WHEN auth_attempts.window_started < NOW() - INTERVAL '15 minutes' THEN NOW()
        ELSE auth_attempts.window_started
      END,
      blocked_until = CASE
        WHEN auth_attempts.window_started >= NOW() - INTERVAL '15 minutes'
          AND auth_attempts.attempts + 1 >= 8
        THEN NOW() + INTERVAL '15 minutes'
        ELSE NULL
      END
  `;
}

export async function clearLoginAttempts(keyHash: string) {
  const sql = getDb();
  await sql`DELETE FROM auth_attempts WHERE key_hash = ${keyHash}`;
}

import { deleteCurrentSession } from "@/lib/auth";
import { isSameOriginRequest, jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Request origin was rejected.", 403);

  try {
    await deleteCurrentSession();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Sign out failed", error);
    return jsonError("We couldn’t sign you out cleanly.", 500);
  }
}

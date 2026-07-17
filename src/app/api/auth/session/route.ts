import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return Response.json({ user });
  } catch (error) {
    console.error("Session lookup failed", error);
    return jsonError("The account service is temporarily unavailable.", 503);
  }
}

import "server-only";

export function jsonError(message: string, status: number, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}

export async function readJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Expected a JSON request.");
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_500_000) {
    throw new Error("Request is too large.");
  }

  return request.json() as Promise<unknown>;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function getClientAddress(request: Request) {
  return (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim() || "unknown";
}

export function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

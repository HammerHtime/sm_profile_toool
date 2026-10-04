import { cleanText, deleteSession, expired, getSession, jsonResponse, putSession, safeEqual } from "./photo-session-lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const id = cleanText(body.id, 80);
    const joinToken = cleanText(body.joinToken, 120);
    const record = await getSession(id);

    if (!record) return jsonResponse({ error: "Session not found" }, 404);
    if (expired(record)) {
      await deleteSession(id);
      return jsonResponse({ error: "Session expired" }, 410);
    }
    if (!safeEqual(joinToken, record.joinTokenHash)) return jsonResponse({ error: "Invalid session link" }, 403);

    if (record.status === "waiting") {
      record.status = "joined";
      record.joinedAt = new Date().toISOString();
      await putSession(record);
    }

    return jsonResponse({ ok: true, status: record.status, expiresAt: record.expiresAt });
  } catch (error) {
    console.error("photo-join failed", error);
    return jsonResponse({ error: "Could not join the live photo session.", detail: error?.message || "Unknown error" }, 500);
  }
};

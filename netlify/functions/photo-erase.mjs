import { cleanText, deleteSession, getSession, jsonResponse, safeEqual } from "./photo-session-lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const id = cleanText(body.id, 80);
    const presenterToken = cleanText(body.presenterToken, 120);
    const record = await getSession(id);

    if (!record) return jsonResponse({ ok: true, deleted: true });
    if (!safeEqual(presenterToken, record.presenterTokenHash)) return jsonResponse({ error: "Invalid presenter token" }, 403);

    await deleteSession(id);
    return jsonResponse({ ok: true, deleted: true });
  } catch (error) {
    console.error("photo-erase failed", error);
    return jsonResponse({ error: "Could not erase the live photo session.", detail: error?.message || "Unknown error" }, 500);
  }
};

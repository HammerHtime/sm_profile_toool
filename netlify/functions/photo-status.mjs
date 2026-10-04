import { cleanText, deleteSession, expired, getSession, jsonResponse, safeEqual } from "./photo-session-lib.mjs";

export default async (req) => {
  if (!["POST","GET"].includes(req.method)) return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    let id = "";
    let presenterToken = "";

    if (req.method === "POST") {
      const body = await req.json();
      id = cleanText(body.id, 80);
      presenterToken = cleanText(body.presenterToken, 120);
    } else {
      // GET remains temporarily compatible with older presenter tabs.
      const url = new URL(req.url);
      id = cleanText(url.searchParams.get("id"), 80);
      presenterToken = cleanText(url.searchParams.get("token"), 120);
    }
    const record = await getSession(id);

    if (!record) return jsonResponse({ error: "Session not found" }, 404);
    if (expired(record)) {
      await deleteSession(id);
      return jsonResponse({ error: "Session expired" }, 410);
    }
    if (!safeEqual(presenterToken, record.presenterTokenHash)) return jsonResponse({ error: "Invalid presenter token" }, 403);

    return jsonResponse({
      id: record.id,
      status: record.status,
      expiresAt: record.expiresAt,
      consent: record.consent,
      submittedAt: record.submittedAt || null,
      participant: record.submission ? {
        firstName: record.submission.firstName,
        city: record.submission.city,
        usernameMasked: record.submission.usernameMasked
      } : null,
      image: record.submission?.image || null,
      voiceSample: record.submission?.voiceSample || { recorded:false, durationMs:0, localOnly:true, rawAudioPersisted:false },
      findings: record.findings || null,
      correlation: record.correlation || null
    });
  } catch (error) {
    console.error("photo-status failed", error);
    return jsonResponse({ error: "Could not read the live photo session.", detail: error?.message || "Unknown error" }, 500);
  }
};

import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { expiresIso, hash, jsonResponse, nowIso, putSession, token } from "./photo-session-lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const id = randomUUID().replaceAll("-", "");
    const joinToken = token();
    const presenterToken = token();
    const record = {
      id,
      status: "waiting",
      createdAt: nowIso(),
      expiresAt: expiresIso(),
      joinTokenHash: hash(joinToken),
      presenterTokenHash: hash(presenterToken),
      consent: false,
      submission: null,
      findings: null
    };

    await putSession(record);

    const origin = new URL(req.url).origin;
    const joinUrl = new URL("/volunteer.html", origin);
    joinUrl.hash = new URLSearchParams({ session:id, token:joinToken }).toString();

    const qrDataUrl = await QRCode.toDataURL(joinUrl.toString(), {
      width: 720,
      margin: 2,
      errorCorrectionLevel: "M"
    });

    return jsonResponse({
      id,
      presenterToken,
      expiresAt: record.expiresAt,
      joinUrl: joinUrl.toString(),
      qrDataUrl
    });
  } catch (error) {
    console.error("photo-create failed", error);
    return jsonResponse({ error: "Could not create the live photo session.", detail: error?.message || "Unknown error" }, 500);
  }
};


export const config = {
  path:"/api/photo-create",
  rateLimit:{
    action:"rate_limit",
    aggregateBy:["ip","domain"],
    windowSize:60,
    windowLimit:10
  }
};

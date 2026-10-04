import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

export const SESSION_MINUTES = 15;
export const sessionKey = (id) => "sessions/" + id + ".json";
export const voiceAudioKey = (id, index) => "audio/" + id + "/" + index + ".b64";
export const nowIso = () => new Date().toISOString();
export const expiresIso = () => new Date(Date.now() + SESSION_MINUTES * 60000).toISOString();
export const token = (bytes = 24) => randomBytes(bytes).toString("base64url");
export const hash = (value = "") => createHash("sha256").update(String(value)).digest("hex");
export const cleanText = (v, max = 80) => typeof v === "string" ? v.trim().replace(/[\u0000-\u001f]/g, "").slice(0, max) : "";
export const expired = (r) => !r?.expiresAt || Date.parse(r.expiresAt) <= Date.now();

export function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      "pragma": "no-cache"
    }
  });
}

export function store() {
  return getStore("photo-demo-sessions");
}

export const safeEqual = (plain, storedHash) => {
  const a = Buffer.from(hash(plain));
  const b = Buffer.from(String(storedHash || ""));
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function getSession(id) {
  if (!id || !/^[a-zA-Z0-9_-]{12,80}$/.test(id)) return null;
  return await store().get(sessionKey(id), { type: "json", consistency: "strong" });
}

export async function putSession(record) {
  await store().setJSON(sessionKey(record.id), record);
}

export async function deleteSession(id) {
  await store().delete(sessionKey(id));
}

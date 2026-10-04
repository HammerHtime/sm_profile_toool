import exifr from "exifr";
import { cleanText, deleteSession, expired, getSession, jsonResponse, putSession, safeEqual } from "./photo-session-lib.mjs";

const MAX_BYTES = 4 * 1024 * 1024;
const allowed = new Set(["image/jpeg","image/jpg","image/png","image/webp","image/heic","image/heif"]);

function maskHandle(v = "") {
  const s = cleanText(v, 80);
  if (!s) return "";
  const prefix = s.startsWith("@") ? "@" : "";
  const body = prefix ? s.slice(1) : s;
  if (body.length <= 3) return prefix + body[0] + "•".repeat(Math.max(1, body.length - 2)) + body.slice(-1);
  const left = Math.max(1, Math.ceil(body.length * 0.25));
  const right = Math.max(1, Math.ceil(body.length * 0.2));
  return prefix + body.slice(0, left) + "•".repeat(Math.max(3, body.length - left - right)) + body.slice(-right);
}

function coarseZone(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat: Math.round(lat * 2) / 2, lon: Math.round(lon * 2) / 2, radiusKm: 50, count: 1 };
}

function cameraLabel(exif = {}) {
  const make = cleanText(exif.Make || "", 35);
  const model = cleanText(exif.Model || "", 50);
  return [make, model].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

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
    if (body.consent !== true) return jsonResponse({ error: "Consent is required" }, 400);

    const firstName = cleanText(body.firstName, 40);
    const city = cleanText(body.city, 80);
    const username = cleanText(body.username, 80);
    const mime = cleanText(body.mime, 40).toLowerCase();

    if (!firstName) return jsonResponse({ error: "First name is required" }, 400);
    if (!allowed.has(mime)) return jsonResponse({ error: "Unsupported image type" }, 400);
    if (typeof body.imageData !== "string" || !body.imageData) return jsonResponse({ error: "A photo is required" }, 400);

    let bytes = Buffer.from(body.imageData, "base64");
    if (!bytes.length || bytes.length > MAX_BYTES) return jsonResponse({ error: "Photo must be 4 MB or smaller" }, 413);

    let exif = {};
    try {
      exif = await exifr.parse(bytes, { gps:true, tiff:true, exif:true, ifd0:true, xmp:false, iptc:false }) || {};
    } catch {}

    const lat = Number(exif.latitude);
    const lon = Number(exif.longitude);
    const zone = coarseZone(lat, lon);
    const captured = exif.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : null;
    const camera = cameraLabel(exif);
    const width = Number(body.width) || Number(exif.ExifImageWidth) || Number(exif.ImageWidth) || 0;
    const height = Number(body.height) || Number(exif.ExifImageHeight) || Number(exif.ImageHeight) || 0;

    record.status = "submitted";
    record.consent = true;
    record.submittedAt = new Date().toISOString();
    record.submission = {
      firstName,
      city,
      usernameMasked: maskHandle(username),
      image: { mime, bytes: bytes.length, width, height }
    };
    record.findings = {
      gpsEmbedded: !!zone,
      locationZone: zone,
      captureDateEmbedded: !!captured,
      capturedAtYear: captured ? captured.getUTCFullYear() : null,
      cameraMetadataEmbedded: !!camera,
      cameraSummary: camera || "",
      rawPhotoPersisted: false
    };

    await putSession(record);

    bytes.fill(0);
    bytes = null;
    exif = {};

    return jsonResponse({ ok:true, status:"submitted" });
  } catch (error) {
    console.error("photo-submit failed", error);
    return jsonResponse({ error:"Could not process the photo.", detail:error?.message || "Unknown error" }, 500);
  }
};

import { store, voiceAudioKey } from "./photo-session-lib.mjs";

export default async () => {
  const s = store();
  const now = Date.now();
  const hardCutoff = now - 24 * 60 * 60 * 1000;
  let deleted = 0;
  let audioDeleted = 0;

  let cursor;
  do {
    const page = await s.list({ prefix:"sessions/", ...(cursor ? { cursor } : {}) });

    for (const blob of page.blobs || []) {
      try {
        const record = await s.get(blob.key, { type:"json", consistency:"strong" });
        const expiredBySession = !record?.expiresAt || Date.parse(record.expiresAt) <= now;
        const olderThan24h = !!record?.createdAt && Date.parse(record.createdAt) <= hardCutoff;

        if (expiredBySession || olderThan24h) {
          for (const sample of record?.submission?.voiceSamples || []) {
            try {
              await s.delete(voiceAudioKey(record.id,sample.index));
              audioDeleted++;
            } catch {}
          }
          await s.delete(blob.key);
          deleted++;
        }
      } catch (error) {
        console.error("photo-cleanup entry failed", blob.key, error);
      }
    }

    cursor = page.cursor || null;
  } while (cursor);

  // Clean orphaned audio conservatively. Only delete it when the parent
  // session is gone and the blob is older than the 24-hour hard limit.
  cursor = undefined;
  do {
    const page = await s.list({ prefix:"audio/", ...(cursor ? { cursor } : {}) });

    for (const blob of page.blobs || []) {
      try {
        const match = String(blob.key || "").match(/^audio\/([^/]+)\/\d+\.b64$/);
        if (!match) continue;

        const updated = Date.parse(blob.updated_at || blob.updatedAt || blob.created_at || blob.createdAt || "");
        if (!Number.isFinite(updated) || updated > hardCutoff) continue;

        const parent = await s.get("sessions/" + match[1] + ".json", { type:"json", consistency:"strong" });
        if (parent?.id) continue;

        await s.delete(blob.key);
        audioDeleted++;
      } catch {}
    }

    cursor = page.cursor || null;
  } while (cursor);

  return Response.json({
    deleted,
    audioDeleted,
    hardRetentionHours:24
  });
};

export const config = { schedule:"@hourly" };

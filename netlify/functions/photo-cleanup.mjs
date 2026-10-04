import { store, voiceAudioKey } from "./photo-session-lib.mjs";

export default async () => {
  const s = store();
  let deleted = 0;

  const page = await s.list({ prefix:"sessions/" });
  const now = Date.now();
  const hardCutoff = now - 24 * 60 * 60 * 1000;

  for (const blob of page.blobs || []) {
    try {
      const record = await s.get(blob.key, { type:"json", consistency:"strong" });
      const expiredBySession = !record?.expiresAt || Date.parse(record.expiresAt) <= now;
      const olderThan24h = !!record?.createdAt && Date.parse(record.createdAt) <= hardCutoff;
      if (expiredBySession || olderThan24h) {
        for (const sample of record?.submission?.voiceSamples || []) {
          try { await s.delete(voiceAudioKey(record.id,sample.index)); } catch {}
        }
        await s.delete(blob.key);
        deleted++;
      }
    } catch (error) {
      console.error("photo-cleanup entry failed", blob.key, error);
    }
  }

  let orphanAudioDeleted = 0;
  try {
    const audioPage = await s.list({ prefix:"audio/" });
    for (const blob of audioPage.blobs || []) {
      const updated = Date.parse(blob.updated_at || blob.updatedAt || blob.created_at || blob.createdAt || "");
      if (Number.isFinite(updated) && updated <= hardCutoff) {
        try {
          await s.delete(blob.key);
          orphanAudioDeleted++;
        } catch {}
      }
    }
  } catch {}

  return Response.json({ deleted, orphanAudioDeleted, hardRetentionHours:24 });
};

export const config = { schedule:"@hourly" };

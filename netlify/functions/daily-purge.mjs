import { store, voiceAudioKey } from "./photo-session-lib.mjs";

export default async () => {
  const s = store();
  const now = Date.now();
  const hardCutoff = now - 24 * 60 * 60 * 1000;
  let sessionsDeleted = 0;
  let audioDeleted = 0;
  const survivingSessionIds = new Set();

  let cursor;
  do {
    const page = await s.list({ prefix:"sessions/", ...(cursor ? {cursor} : {}) });
    for (const blob of page.blobs || []) {
      try {
        const record = await s.get(blob.key,{type:"json",consistency:"strong"});
        const createdAt = Date.parse(record?.createdAt || "");
        const expiresAt = Date.parse(record?.expiresAt || "");
        const expired = !Number.isFinite(expiresAt) || expiresAt <= now;
        const overHardLimit = Number.isFinite(createdAt) && createdAt <= hardCutoff;

        if (expired || overHardLimit) {
          for (const sample of record?.submission?.voiceSamples || []) {
            try {
              await s.delete(voiceAudioKey(record.id,sample.index));
              audioDeleted++;
            } catch {}
          }
          await s.delete(blob.key);
          sessionsDeleted++;
        } else if (record?.id) {
          survivingSessionIds.add(record.id);
        }
      } catch {}
    }
    cursor = page.cursor || null;
  } while (cursor);

  // Remove orphaned audio whose parent session no longer exists. This catches
  // interrupted deletes while leaving a currently active demo untouched.
  cursor = undefined;
  do {
    const page = await s.list({ prefix:"audio/", ...(cursor ? {cursor} : {}) });
    for (const blob of page.blobs || []) {
      const match = String(blob.key || "").match(/^audio\/([^/]+)\/\d+\.b64$/);
      if (!match) continue;
      const sessionId = match[1];

      if (survivingSessionIds.has(sessionId)) continue;

      try {
        const record = await s.get("sessions/" + sessionId + ".json",{type:"json",consistency:"strong"});
        if (record?.id) {
          survivingSessionIds.add(record.id);
          continue;
        }
      } catch {}

      try {
        await s.delete(blob.key);
        audioDeleted++;
      } catch {}
    }
    cursor = page.cursor || null;
  } while (cursor);

  return Response.json({
    ok:true,
    sessionsDeleted,
    audioDeleted,
    hardRetentionHours:24,
    reason:"Daily failsafe purge of expired, over-retention and orphaned demo data"
  });
};

export const config = { schedule:"0 9 * * *" };

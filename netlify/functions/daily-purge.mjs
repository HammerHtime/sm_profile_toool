import { store } from "./photo-session-lib.mjs";

export default async () => {
  const s = store();
  let sessionsDeleted = 0;
  let audioDeleted = 0;

  const sessions = await s.list({ prefix:"sessions/" });
  for (const blob of sessions.blobs || []) {
    try {
      await s.delete(blob.key);
      sessionsDeleted++;
    } catch {}
  }

  const audio = await s.list({ prefix:"audio/" });
  for (const blob of audio.blobs || []) {
    try {
      await s.delete(blob.key);
      audioDeleted++;
    } catch {}
  }

  return Response.json({
    ok:true,
    sessionsDeleted,
    audioDeleted,
    reason:"24-hour failsafe purge"
  });
};

export const config = { schedule:"0 9 * * *" };

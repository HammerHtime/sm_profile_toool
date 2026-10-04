import { store } from "./photo-session-lib.mjs";

export default async () => {
  const s = store();
  let deleted = 0;

  const page = await s.list({ prefix:"sessions/" });

  for (const blob of page.blobs || []) {
    try {
      const record = await s.get(blob.key, { type:"json", consistency:"strong" });
      if (!record?.expiresAt || Date.parse(record.expiresAt) <= Date.now()) {
        await s.delete(blob.key);
        deleted++;
      }
    } catch (error) {
      console.error("photo-cleanup entry failed", blob.key, error);
    }
  }

  return Response.json({ deleted });
};

export const config = { schedule:"@hourly" };

import { cleanText, deleteSession, expired, getSession, jsonResponse, safeEqual, store, voiceAudioKey } from "./photo-session-lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return jsonResponse({ error:"Method not allowed" },405);

  try {
    const body = await req.json();
    const id = cleanText(body.id,80);
    const presenterToken = cleanText(body.presenterToken,120);
    const index = Number(body.index);

    if (!Number.isInteger(index) || index < 0 || index > 2) {
      return jsonResponse({ error:"Invalid voice sample" },400);
    }

    const record = await getSession(id);
    if (!record) return jsonResponse({ error:"Session not found" },404);
    if (expired(record)) {
      const s = store();
      for (const sample of record.submission?.voiceSamples || []) {
        try { await s.delete(voiceAudioKey(id,sample.index)); } catch {}
      }
      await deleteSession(id);
      return jsonResponse({ error:"Session expired" },410);
    }

    if (!safeEqual(presenterToken,record.presenterTokenHash)) {
      return jsonResponse({ error:"Invalid presenter token" },403);
    }

    const meta = (record.submission?.voiceSamples || []).find(sample => Number(sample.index) === index && sample.available);
    if (!meta) return jsonResponse({ error:"Voice sample not found" },404);

    const encoded = await store().get(voiceAudioKey(id,index),{type:"text",consistency:"strong"});
    if (!encoded) return jsonResponse({ error:"Voice sample not found" },404);

    const bytes = Buffer.from(encoded,"base64");
    return new Response(new Uint8Array(bytes),{
      status:200,
      headers:{
        "content-type":meta.mime || "audio/webm",
        "content-length":String(bytes.length),
        "cache-control":"no-store, max-age=0",
        "pragma":"no-cache",
        "content-disposition":"inline"
      }
    });
  } catch (error) {
    console.error("photo-audio failed",error);
    return jsonResponse({ error:"Could not retrieve the voice sample.", detail:error?.message || "Unknown error" },500);
  }
};

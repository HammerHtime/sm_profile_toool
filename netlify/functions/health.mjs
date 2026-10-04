import { randomUUID } from "node:crypto";
import { store } from "./photo-session-lib.mjs";

function respond(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control":"no-store, max-age=0",
      "pragma":"no-cache"
    }
  });
}

export default async (req) => {
  if (req.method !== "GET") return respond({ error:"GET required" },405);

  const result = {
    ok:true,
    timestamp:new Date().toISOString(),
    functionsRuntime:"request-response",
    liveSearchConfigured:!!process.env.BRAVE_SEARCH_API_KEY,
    blobs:{ ok:false }
  };

  const key="health/"+randomUUID()+".json";
  try {
    const s=store();
    const marker={ ts:Date.now(), kind:"public-footprint-health" };
    await s.setJSON(key,marker);
    const roundTrip=await s.get(key,{type:"json",consistency:"strong"});
    await s.delete(key);
    result.blobs={
      ok:roundTrip?.kind==="public-footprint-health",
      strongConsistency:true
    };
  } catch (error) {
    result.ok=false;
    result.blobs={
      ok:false,
      error:error?.message || "Blob storage check failed"
    };
  }

  return respond(result,result.ok?200:503);
};

import { openAIConfigured, openAIModel } from "./profile-intelligence.mjs";
import { googleVisionConfigured } from "./google-vision-web.mjs";
import { googleGeocodingConfigured } from "./google-geocoding.mjs";
import { randomUUID } from "node:crypto";
import { store } from "./photo-session-lib.mjs";

function normalizeBraveApiKey(value = "") {
  let candidate = String(value || "").trim();
  if (!candidate) return "";
  const assignment = candidate.match(/^(?:BRAVE_SEARCH_API_KEY|BRAVE_API_KEY|BRAVE_SEARCH_KEY)\s*=\s*(.+)$/i);
  if (assignment) candidate = assignment[1].trim();
  const quoted = (candidate.startsWith('"') && candidate.endsWith('"')) || (candidate.startsWith("'") && candidate.endsWith("'"));
  if (quoted && candidate.length >= 2) candidate = candidate.slice(1, -1).trim();
  return candidate.replace(/^Bearer\s+/i, "").trim();
}

function getBraveApiKey() {
  return normalizeBraveApiKey(
    process.env.BRAVE_SEARCH_API_KEY ||
    process.env.BRAVE_API_KEY ||
    process.env.BRAVE_SEARCH_KEY ||
    ""
  );
}

function braveKeySource() {
  if (process.env.BRAVE_SEARCH_API_KEY) return "BRAVE_SEARCH_API_KEY";
  if (process.env.BRAVE_API_KEY) return "BRAVE_API_KEY";
  if (process.env.BRAVE_SEARCH_KEY) return "BRAVE_SEARCH_KEY";
  return null;
}

function normalizeSerpApiKey(value = "") {
  let candidate = String(value || "").trim();
  if (!candidate) return "";
  const assignment = candidate.match(/^(?:SERPAPI_API_KEY|SERPAPI_KEY)\s*=\s*(.+)$/i);
  if (assignment) candidate = assignment[1].trim();
  const quoted = (candidate.startsWith('"') && candidate.endsWith('"')) || (candidate.startsWith("'") && candidate.endsWith("'"));
  if (quoted && candidate.length >= 2) candidate = candidate.slice(1, -1).trim();
  return candidate.replace(/^Bearer\s+/i, "").trim();
}

function getSerpApiKey() {
  return normalizeSerpApiKey(process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY || "");
}

async function checkSerpApiAccount(apiKey) {
  if (!apiKey) return { configured:false, valid:false };
  const url=new URL("https://serpapi.com/account.json");
  url.searchParams.set("api_key",apiKey);
  try {
    const response=await fetch(url,{headers:{"accept":"application/json"},signal:AbortSignal.timeout(10000)});
    const data=await response.json().catch(()=>({}));
    if (!response.ok || data?.error) {
      return { configured:true, valid:false, error:data?.error || ("HTTP "+response.status) };
    }
    return {
      configured:true,
      valid:true,
      accountStatus:data?.account_status || null,
      planName:data?.plan_name || null,
      searchesLeft:Number.isFinite(Number(data?.total_searches_left)) ? Number(data.total_searches_left) : null
    };
  } catch (error) {
    return { configured:true, valid:false, error:error?.message || "SerpApi account check failed" };
  }
}

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

  const serpApiAccount=await checkSerpApiAccount(getSerpApiKey());

  const result = {
    ok:true,
    timestamp:new Date().toISOString(),
    functionsRuntime:"request-response",
    liveSearchConfigured:!!(getBraveApiKey() || getSerpApiKey()),
    braveSearchConfigured:!!getBraveApiKey(),
    braveKeySource:braveKeySource(),
    serpApiConfigured:!!getSerpApiKey(),
    serpApiValid:serpApiAccount.valid,
    serpApiAccount:{
      accountStatus:serpApiAccount.accountStatus || null,
      planName:serpApiAccount.planName || null,
      searchesLeft:serpApiAccount.searchesLeft ?? null,
      error:serpApiAccount.error || null
    },
    openAIConfigured:openAIConfigured(),
    openAIModel:openAIModel(),
    googleVisionConfigured:googleVisionConfigured(),
    googleGeocodingConfigured:googleGeocodingConfigured(),
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

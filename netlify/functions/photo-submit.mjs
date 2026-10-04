import exifr from "exifr";
import { cleanText, deleteSession, expired, getSession, jsonResponse, putSession, safeEqual, store, voiceAudioKey } from "./photo-session-lib.mjs";

const MAX_BYTES = 4 * 1024 * 1024;
const allowed = new Set(["image/jpeg","image/jpg","image/png","image/webp","image/heic","image/heif"]);
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const MAX_VOICE_BYTES = 150 * 1024;
const MAX_VOICE_MS = 10000;
const allowedAudio = new Set(["audio/webm","audio/webm;codecs=opus","audio/mp4","audio/mpeg","audio/ogg","audio/ogg;codecs=opus"]);

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

function normalize(v = "") {
  return String(v).toLowerCase().normalize("NFKD").replace(/[^a-z0-9@._ -]/g, " ").replace(/\s+/g, " ").trim();
}

function platformFor(url = "") {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch {}
  const rules = [
    ["linkedin.com","LinkedIn"],["instagram.com","Instagram"],["facebook.com","Facebook"],
    ["tiktok.com","TikTok"],["reddit.com","Reddit"],["x.com","X / Twitter"],
    ["twitter.com","X / Twitter"],["youtube.com","YouTube"],["youtu.be","YouTube"],
    ["threads.net","Threads"],["strava.com","Strava"],["github.com","GitHub"],
    ["medium.com","Medium"],["substack.com","Substack"],["pinterest.com","Pinterest"],
    ["twitch.tv","Twitch"],["bsky.app","Bluesky"],["meetup.com","Meetup"],["flickr.com","Flickr"]
  ];
  for (const [needle,label] of rules) if (host.includes(needle)) return label;
  return "Public web";
}

const PRESENTATION_SENSITIVE_TERMS = /\b(?:diagnos(?:is|ed)|cancer|hiv|aids|medical condition|medication|depression|suicid|religion|religious|catholic|muslim|jewish|christian|hindu|mosque|synagogue|sexual orientation|gay|lesbian|bisexual|transgender|political party|liberal party|conservative party|new democratic party|ndp|arrested|criminal charge|convicted|conviction)\b/i;

function safeForPresentation(value = "") {
  return !PRESENTATION_SENSITIVE_TERMS.test(String(value || ""));
}

function safePublicExcerpt(value = "", max = 112) {
  let text = cleanText(String(value || "").replace(/\s+/g," "), 220);
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[email masked]");
  text = text.replace(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g,"[phone masked]");
  text = text.replace(/\b\d{1,6}[A-Za-z]?\s+(?:[A-Za-z0-9.'-]+\s+){0,4}(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Crescent|Cres|Way)\b/gi,"[address masked]");
  if (text.length <= max) return text;
  const cut=text.slice(0,max).replace(/\s+\S*$/,"").trim();
  return (cut||text.slice(0,max)).trim()+"…";
}

function braveThumb(result = {}) {
  const src=result.thumbnail?.src || result.profile?.img || "";
  return typeof src==="string" && /^https:\/\/imgs\.search\.brave\.com\//i.test(src) ? src : "";
}

const PUBLIC_THEME_STOP = new Set([
  "the","and","for","with","from","that","this","your","you","are","was","were","has","have","had","but","not","all","can",
  "about","into","more","than","their","they","them","his","her","who","what","when","where","how","www","http","https",
  "com","org","net","profile","public","page","pages","official","search","facebook","instagram","linkedin","tiktok","twitter",
  "reddit","youtube","threads","github","strava"
]);

function correlationThemes(items, handle, firstName, city) {
  const excluded=new Set([handle,firstName,city].filter(Boolean).flatMap(v=>normalize(v).replace(/[@._-]/g," ").split(/\s+/)).filter(Boolean));
  ["masked","email","phone","address","contact","result","results"].forEach(term=>excluded.add(term));
  const counts=new Map();
  for(const item of items){
    const text=normalize([item.title,item.description].filter(Boolean).join(" ")).replace(/[@._-]/g," ");
    for(const rawToken of text.split(/\s+/)){
      const token=rawToken.replace(/[^a-z0-9]/g,"");
      if(!token||token.length<4||token.length>24||PUBLIC_THEME_STOP.has(token)||excluded.has(token)||/^\d+$/.test(token)||/xxx|masked/.test(token))continue;
      counts.set(token,(counts.get(token)||0)+1);
    }
  }
  return [...counts.entries()]
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .slice(0,10)
    .map(([term,count])=>({term,count}));
}

async function braveSearch(apiKey, q) {
  const response = await fetch(BRAVE_ENDPOINT, {
    method:"POST",
    headers:{
      "accept":"application/json",
      "content-type":"application/json",
      "x-subscription-token":apiKey
    },
    body:JSON.stringify({ q, country:"CA", search_lang:"en", count:20 })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.detail || data?.message || "Public correlation search failed");
  return data?.web?.results || [];
}

async function publicHandleCorrelation(username, firstName, city) {
  const handle = cleanText(String(username || "").replace(/^@/, ""), 80);
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!handle) {
    return {
      attempted:false,
      configured:!!apiKey,
      basis:"No public username supplied",
      totalMatches:0,
      platforms:[],
      sourceDomains:[],
      presentation:{photos:[],quotes:[],themes:[]}
    };
  }

  if (!apiKey) {
    return {
      attempted:false,
      configured:false,
      basis:"Public username supplied, but live public correlation is not configured",
      totalMatches:0,
      platforms:[],
      sourceDomains:[],
      presentation:{photos:[],quotes:[],themes:[]}
    };
  }

  const quoted = '"' + handle.replaceAll('"',"") + '"';
  const queries = [
    quoted + " (site:instagram.com OR site:facebook.com OR site:tiktok.com OR site:linkedin.com OR site:threads.net)",
    quoted + " (site:reddit.com OR site:x.com OR site:twitter.com OR site:youtube.com OR site:github.com OR site:strava.com)",
    [quoted, firstName && '"' + firstName.replaceAll('"',"") + '"', city && '"' + city.replaceAll('"',"") + '"'].filter(Boolean).join(" ")
  ];

  const batches = await Promise.all(queries.map(q => braveSearch(apiKey,q)));
  const seen = new Map();
  const normalizedHandle = normalize(handle);

  for (const result of batches.flat()) {
    if (!result?.url) continue;
    const hay = normalize([result.title,result.description,result.url].filter(Boolean).join(" "));
    if (!hay.includes(normalizedHandle)) continue;

    let domain = "";
    try { domain = new URL(result.url).hostname.replace(/^www\./,"").toLowerCase(); } catch {}
    if (!domain) continue;

    if (!seen.has(result.url)) {
      seen.set(result.url,{
        platform:platformFor(result.url),
        domain,
        title:safePublicExcerpt(result.title || "",96),
        description:safePublicExcerpt(result.description || "",112),
        thumbnail:braveThumb(result)
      });
    }
  }

  const matches = [...seen.values()];
  const counts = new Map();
  matches.forEach(m => counts.set(m.platform,(counts.get(m.platform)||0)+1));

  const presentationPhotos=matches
    .filter(match=>match.thumbnail)
    .slice(0,8)
    .map(match=>({
      src:match.thumbnail,
      platform:match.platform,
      domain:match.domain
    }));
  const presentationQuotes=matches
    .filter(match=>match.description && safeForPresentation(match.description))
    .slice(0,6)
    .map(match=>({
      platform:match.platform,
      text:match.description
    }));
  const presentationThemes=correlationThemes(matches.filter(match=>safeForPresentation([match.title,match.description].join(" "))),handle,firstName,city);

  return {
    attempted:true,
    configured:true,
    basis:"Supplied public username only. No facial identification.",
    totalMatches:matches.length,
    platforms:[...counts.entries()]
      .map(([name,count]) => ({ name,count,label:"public pages matching supplied handle" }))
      .sort((a,b)=>b.count-a.count)
      .slice(0,10),
    sourceDomains:[...new Set(matches.map(m=>m.domain))].slice(0,12),
    presentation:{
      photos:presentationPhotos,
      quotes:presentationQuotes,
      themes:presentationThemes
    }
  };
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
    if (record.status === "submitted") return jsonResponse({ error: "This session has already been submitted." }, 409);
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
    const requestedVoiceSamples = Array.isArray(body.voiceSamples) ? body.voiceSamples.slice(0,1) : [];
    const voiceSamples = [];

    for (const item of requestedVoiceSamples) {
      const index = Number(item?.index);
      const durationMs = Math.min(MAX_VOICE_MS, Math.max(0, Number(item?.durationMs) || 0));
      const audioMime = cleanText(item?.mime || "", 80).toLowerCase();
      const audioData = typeof item?.audioData === "string" ? item.audioData : "";

      if (index !== 0) continue;
      if (!durationMs || !audioData) continue;
      if (!allowedAudio.has(audioMime)) return jsonResponse({ error:"Unsupported voice audio type" },400);

      const audioBytes = Buffer.from(audioData,"base64");
      if (!audioBytes.length || audioBytes.length > MAX_VOICE_BYTES) {
        return jsonResponse({ error:"Each voice sample must be 150 KB or smaller" },413);
      }

      voiceSamples.push({
        index,
        durationMs:Math.round(durationMs),
        mime:audioMime,
        bytes:audioBytes.length,
        audioData
      });
      audioBytes.fill(0);
    }

    const storedVoiceMetadata = [];
    const audioStore = store();
    for (const sample of voiceSamples) {
      await audioStore.set(voiceAudioKey(id,sample.index),sample.audioData);
      storedVoiceMetadata.push({
        index:sample.index,
        durationMs:sample.durationMs,
        mime:sample.mime,
        bytes:sample.bytes,
        available:true,
        temporary:true,
        cloned:false
      });
      sample.audioData = "";
    }

    const voiceDeliveryInput = body.voiceDelivery && typeof body.voiceDelivery === "object" ? body.voiceDelivery : {};
    const speakingRateFactor = Math.min(1.20,Math.max(0.80,Number(voiceDeliveryInput.speakingRateFactor)||1));

    record.submission = {
      firstName,
      city,
      usernameMasked: maskHandle(username),
      image: { mime, bytes: bytes.length, width, height },
      voiceSamples: storedVoiceMetadata,
      voiceDelivery:{
        speakingRateFactor:Number(speakingRateFactor.toFixed(2)),
        identityReproduction:false,
        generatedVoice:"generic"
      }
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

    try {
      record.correlation = await publicHandleCorrelation(username, firstName, city);
    } catch (correlationError) {
      console.error("photo public correlation failed", correlationError);
      record.correlation = {
        attempted:true,
        configured:!!process.env.BRAVE_SEARCH_API_KEY,
        basis:"Public correlation failed. No public matches were displayed.",
        totalMatches:0,
        platforms:[],
        sourceDomains:[],
        presentation:{photos:[],quotes:[],themes:[]}
      };
    }

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

import { synthesizePublicProfile } from "./profile-intelligence.mjs";
const arr = (v) => Array.isArray(v) ? v : [];
const clean = (v, max = 120) => typeof v === "string"
  ? v.trim().replace(/[\u0000-\u001f]/g, "").slice(0, max)
  : "";

function respond(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control":"no-store, max-age=0",
      "pragma":"no-cache"
    }
  });
}

function maskEmail(v = "") {
  const s = clean(typeof v === "object" ? v.value : v, 160);
  const at = s.indexOf("@");
  if (at < 1) return "email detected";
  const a = s.slice(0, at);
  const d = s.slice(at + 1);
  const parts = d.split(".");
  const tld = parts.length > 1 ? parts.pop() : "";
  const root = parts.join(".") || d;
  return a.slice(0, 2) + "•••••@" + (root[0] || "•") + "•••" + (tld ? "." + tld : "");
}

function maskPhone(v = "") {
  const s = clean(typeof v === "object" ? v.value : v, 80);
  const digits = s.replace(/\D/g, "");
  if (digits.length < 7) return "phone detected";
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return local.slice(0, 3) + "-xxx-xx" + local.slice(-2);
}

function maskAddress(v = "") {
  const s = clean(typeof v === "object" ? v.value : v, 180);
  const m = s.match(/\b(\d{1,6}[A-Za-z]?)\b/);
  return m ? m[1] + " xxxxx St" : "address detected (masked)";
}

function maskHandle(v = "") {
  const s = clean(v, 100);
  if (!s) return "";
  const pre = s.startsWith("@") ? "@" : "";
  const b = pre ? s.slice(1) : s;
  if (!b) return "";
  if (b.length < 4) return pre + b[0] + "••" + b.slice(-1);
  const l = Math.max(2, Math.ceil(b.length * .25));
  const r = Math.max(1, Math.ceil(b.length * .2));
  return pre + b.slice(0, l) + "•".repeat(Math.max(3, b.length - l - r)) + b.slice(-r);
}

export default async (req) => {
  if (req.method !== "POST") return respond({ error:"POST required" }, 405);

  let body = {};
  try { body = await req.json(); }
  catch { return respond({ error:"Invalid JSON" }, 400); }

  if (body.consent !== true) return respond({ error:"Consent is required" }, 400);
  const input = body.evidence && typeof body.evidence === "object" ? body.evidence : {};

  const f = input.findings || {};
  const addresses = arr(f.addresses);
  const education = arr(f.education);
  const employment = arr(f.employment);
  const social = arr(f.socialProfiles);
  const contacts = arr(f.contacts);
  const images = arr(f.images);
  const content = arr(f.publicContent);
  const locations = arr(f.locationSignals);
  const timeline = arr(f.timeline);

  const emails = contacts.filter(x => x?.type === "email");
  const phones = contacts.filter(x => x?.type === "phone");
  const platforms = [...new Set(social.map(x => x?.platform).filter(Boolean))];
  const years = timeline.map(x => Number(x?.year)).filter(Number.isFinite);
  const span = years.length > 1 ? Math.max(...years) - Math.min(...years) : 0;

  const score = Math.min(
    100,
    addresses.length * 7 +
    education.length * 4 +
    employment.length * 2 +
    social.length * 4 +
    (emails.length + phones.length) * 3 +
    Math.ceil(images.length / 40) * 2 +
    locations.length * 2 +
    Math.ceil(content.length / 100) * 2
  );

  const stats = [
    { n:platforms.length, k:"social platforms" },
    { n:images.length, k:"public images" },
    { n:content.length, k:"posts / comments" },
    { n:span || "—", k:"years of history" }
  ];

  const findings = [];
  if (addresses.length) findings.push(["Previous addresses", addresses.length + " historical address references. Example: " + maskAddress(addresses[0]) + ".", "MASKED"]);
  if (emails.length) findings.push(["Email exposure", emails.length + " public email references. Example: " + maskEmail(emails[0]) + ".", "MASKED"]);
  if (phones.length) findings.push(["Phone exposure", phones.length + " public phone references. Example: " + maskPhone(phones[0]) + ".", "MASKED"]);
  if (education.length) findings.push(["Education", education.length + " education records identified. Institution names hidden.", "HIDDEN"]);
  if (employment.length) findings.push(["Employment", employment.length + " employment or organizational associations identified.", "SUMMARY"]);
  if (social.length) findings.push(["Social accounts", social.length + " public account matches across " + platforms.length + " platforms.", "MASKED"]);
  if (images.length) findings.push(["Images", images.length + " publicly indexed images classified by what they reveal.", "SUMMARY"]);
  if (content.length) findings.push(["Public activity", content.length + " posts, comments, replies, shares or public mentions catalogued.", "SUMMARY"]);

  const accounts = social.slice(0, 12).map(x => [
    x.platform || "Public account",
    maskHandle(x.handle || x.username || x.value || "account")
  ]);

  const intelligenceSources = [];
  for (const item of content.slice(0, 30)) {
    const text = typeof item === "string" ? item : clean(item?.text || item?.snippet || item?.description || "", 260);
    const title = typeof item === "string" ? "Public activity" : clean(item?.title || item?.label || "Public activity", 160);
    if (!text && !title) continue;
    intelligenceSources.push({
      platform:typeof item === "object" ? clean(item?.platform || item?.source || "Evidence file", 60) : "Evidence file",
      domain:"",
      confidence:"strong",
      title,
      snippet:text,
      published:typeof item === "object" ? clean(item?.date || item?.publishedAt || item?.year || "", 50) : ""
    });
  }

  for (const item of timeline.slice(0, 12)) {
    const text = typeof item === "string" ? item : clean(item?.summary || item?.description || item?.event || item?.label || "", 260);
    if (!text) continue;
    intelligenceSources.push({
      platform:"Timeline evidence",
      domain:"",
      confidence:"strong",
      title:"Timeline item",
      snippet:text,
      published:typeof item === "object" ? clean(item?.date || item?.period || item?.year || "", 50) : ""
    });
  }

  if (intelligenceSources.length < 2) {
    social.slice(0, 6).forEach(item => intelligenceSources.push({
      platform:clean(item?.platform || "Public account",60),
      domain:"",
      confidence:"possible",
      title:"Public account match",
      snippet:"A public account association was supplied in the evidence file.",
      published:""
    }));
  }

  const intelligence = await synthesizePublicProfile({
    subject:input.subject?.displayName || "Consenting Participant",
    city:input.subject?.city || "",
    sources:intelligenceSources,
    recurringThemes:[]
  });

  return respond({
    dataMode:"evidence",
    synthetic:false,
    subject:input.subject?.displayName || "Consenting Participant",
    score,
    level:score >= 75 ? "HIGH EXPOSURE" : score >= 45 ? "MODERATE" : "LOW",
    stats,
    findings,
    accounts,
    intelligence,
    sourceHits:null,
    imageBreakdown:[],
    activity:[],
    themes:[],
    signals:[]
  });
};


export const config = {
  rateLimit:{
    action:"rate_limit",
    aggregateBy:["ip","domain"],
    windowSize:60,
    windowLimit:8
  }
};

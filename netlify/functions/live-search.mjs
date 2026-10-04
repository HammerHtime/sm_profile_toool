const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

const clean = (v, max = 120) =>
  typeof v === "string" ? v.trim().replace(/[\u0000-\u001f]/g, "").slice(0, max) : "";

const normalize = (v = "") =>
  String(v).toLowerCase().normalize("NFKD").replace(/[^a-z0-9@._ -]/g, " ").replace(/\s+/g, " ").trim();

function respond(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store, max-age=0", "pragma": "no-cache" }
  });
}

function maskEmail(value = "") {
  const parts = String(value).split("@");
  if (parts.length !== 2) return "[email masked]";
  const local = parts[0], domain = parts[1];
  const dot = domain.lastIndexOf(".");
  const root = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return (local.slice(0, 2) || "•") + "•••••@" + (root[0] || "•") + "•••" + tld;
}

function maskPhone(value = "") {
  const d = String(value).replace(/\D/g, "");
  if (d.length < 7) return "[phone masked]";
  const x = d.slice(-10);
  return x.slice(0,3) + "-xxx-xx" + x.slice(-2);
}

function maskAddress(value = "") {
  const m = String(value).match(/\b(\d{1,6}[A-Za-z]?)\s+(.+?)\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Crescent|Cres|Way)\b/i);
  return m ? m[1] + " xxxxx " + m[3] : "[address masked]";
}

function redact(text = "") {
  let out = String(text);
  const emails = [...out.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(m => m[0]);
  const phones = [...out.matchAll(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g)].map(m => m[0]);
  const addresses = [...out.matchAll(/\b\d{1,6}[A-Za-z]?\s+(?:[A-Za-z0-9.'-]+\s+){0,4}(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Crescent|Cres|Way)\b/gi)].map(m => m[0]);

  for (const v of emails) out = out.replaceAll(v, maskEmail(v));
  for (const v of phones) out = out.replaceAll(v, maskPhone(v));
  for (const v of addresses) out = out.replaceAll(v, maskAddress(v));

  return {
    text: out,
    emails: emails.map(maskEmail),
    phones: phones.map(maskPhone),
    addresses: addresses.map(maskAddress)
  };
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
  for (const [needle, label] of rules) if (host.includes(needle)) return label;
  return host || "Public web";
}

function maskedHandle(url = "", platform = "") {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    let candidate = "";
    if (platform === "LinkedIn" && parts[0] === "in") candidate = parts[1] || "";
    else if (platform === "YouTube" && ["channel","c","user"].includes(parts[0])) candidate = parts[1] || "";
    else candidate = parts[0] || "";
    candidate = candidate.replace(/^@/, "");
    if (!candidate || /^(posts?|share|watch|groups?|pages?|search|explore|company|school)$/i.test(candidate)) return "";
    const left = Math.max(1, Math.ceil(candidate.length * .28));
    const right = Math.max(1, Math.ceil(candidate.length * .20));
    const hidden = Math.max(3, candidate.length - left - right);
    return "@" + candidate.slice(0,left) + "•".repeat(hidden) + candidate.slice(-right);
  } catch {
    return "";
  }
}

function buildAgeContext(age) {
  const n = Number(age);
  if (!Number.isFinite(n) || n < 18 || n > 100) return null;
  const currentYear = new Date().getUTCFullYear();
  const minAge = Math.max(18, n - 5);
  const maxAge = Math.min(100, n + 5);
  return {
    entered: n,
    minAge,
    maxAge,
    minBirthYear: currentYear - maxAge - 1,
    maxBirthYear: currentYear - minAge
  };
}

function ageSupport(haystack, ageCtx) {
  if (!ageCtx) return { supported:false, reason:"" };
  const h = String(haystack);

  const agePatterns = [
    /\b(?:age|aged)\s+(\d{2})\b/gi,
    /\b(\d{2})[- ]year[- ]old\b/gi
  ];
  for (const re of agePatterns) {
    for (const m of h.matchAll(re)) {
      const value = Number(m[1]);
      if (value >= ageCtx.minAge && value <= ageCtx.maxAge) {
        return { supported:true, reason:"rough age compatible ("+ageCtx.minAge+"–"+ageCtx.maxAge+")" };
      }
    }
  }

  for (const m of h.matchAll(/\b(?:born|birth|dob|date of birth)\D{0,12}(19\d{2}|20\d{2})\b/gi)) {
    const year = Number(m[1]);
    if (year >= ageCtx.minBirthYear && year <= ageCtx.maxBirthYear) {
      return { supported:true, reason:"birth-year clue compatible" };
    }
  }

  return { supported:false, reason:"" };
}

function matchResult(result, person) {
  const raw = [result.title, result.description, result.url].filter(Boolean).join(" ");
  const hay = normalize(raw);
  const full = normalize(person.fullName);
  const city = normalize(person.city);
  const username = normalize(person.username.replace(/^@/, ""));
  const reasons = [];

  const fullName = full && hay.includes(full);
  const cityMatch = city && hay.includes(city);
  const usernameUrl = username && normalize(result.url).includes(username);
  const usernameAny = username && hay.includes(username);
  const age = ageSupport(raw, person.ageContext);

  if (usernameUrl) reasons.push("username in URL");
  else if (usernameAny) reasons.push("username match");
  if (fullName) reasons.push("full name");
  if (cityMatch) reasons.push("city");
  if (age.supported) reasons.push(age.reason);

  // Age is intentionally never required. It can only strengthen a match.
  if (usernameUrl || (fullName && cityMatch) || (fullName && age.supported)) {
    return { confidence:"strong", reasons };
  }
  if (fullName || usernameAny) return { confidence:"possible", reasons };
  return { confidence:"discard", reasons:[] };
}

async function searchWeb(apiKey, q) {
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
  if (!response.ok) {
    const detail = data?.error?.detail || data?.message || "Search provider request failed";
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return data?.web?.results || [];
}

export default async (req) => {
  if (req.method !== "POST") return respond({ error:"POST required" }, 405);

  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return respond({
      error:"Live public search is not configured.",
      detail:"Add BRAVE_SEARCH_API_KEY to the Netlify site's environment variables."
    }, 503);
  }

  let body;
  try { body = await req.json(); }
  catch { return respond({ error:"Invalid JSON" }, 400); }

  if (body.consent !== true) return respond({ error:"Consent is required." }, 400);

  const firstName = clean(body.firstName, 60);
  const lastName = clean(body.lastName, 60);
  const city = clean(body.city, 80);
  const username = clean(body.username, 100);
  const age = clean(body.age, 3);
  const fullName = [firstName,lastName].filter(Boolean).join(" ").trim();

  if (!firstName || !lastName) return respond({ error:"First and last name are required." }, 400);
  if (age && Number(age) < 18) return respond({ error:"Live person search is disabled for minors." }, 400);

  const ageContext = buildAgeContext(age);
  const quotedName = '"' + fullName.replaceAll('"',"") + '"';

  // Do not put exact age into the main search queries. Age is a soft local ranking signal only.
  const queries = [
    { group:"Open web", q:[quotedName, city && '"' + city.replaceAll('"',"") + '"'].filter(Boolean).join(" ") },
    { group:"Professional", q:quotedName + " site:linkedin.com/in" },
    { group:"Social", q:quotedName + " (site:instagram.com OR site:facebook.com OR site:tiktok.com OR site:threads.net)" },
    { group:"Discussion", q:quotedName + " (site:reddit.com OR site:x.com OR site:twitter.com)" },
    { group:"Video", q:quotedName + " site:youtube.com" },
    { group:"Activity", q:quotedName + " (site:strava.com OR site:github.com OR site:medium.com OR site:substack.com)" },
    { group:"News & organizations", q:[quotedName, city, "(news OR bio OR event OR conference OR organization)"].filter(Boolean).join(" ") }
  ];
  if (username) queries.push({ group:"Username", q:'"' + username.replaceAll('"',"") + '"' });

  const person = { fullName, city, username, ageContext };
  const byUrl = new Map();
  const clues = { emails:[], phones:[], addresses:[] };

  for (const query of queries) {
    const results = await searchWeb(apiKey, query.q);
    for (const raw of results) {
      if (!raw?.url) continue;
      const match = matchResult(raw, person);
      if (match.confidence === "discard") continue;

      const title = redact(raw.title || "");
      const snippet = redact(raw.description || "");
      clues.emails.push(...title.emails,...snippet.emails);
      clues.phones.push(...title.phones,...snippet.phones);
      clues.addresses.push(...title.addresses,...snippet.addresses);

      const platform = platformFor(raw.url);
      const item = {
        title:title.text || platform,
        url:raw.url,
        domain:(()=>{ try { return new URL(raw.url).hostname.replace(/^www\./,""); } catch { return ""; } })(),
        snippet:snippet.text,
        platform,
        confidence:match.confidence,
        reasons:match.reasons,
        queryGroup:query.group,
        handleMasked:maskedHandle(raw.url,platform)
      };

      const existing = byUrl.get(raw.url);
      if (!existing || (existing.confidence === "possible" && item.confidence === "strong")) {
        byUrl.set(raw.url,item);
      }
    }
  }

  const sources = [...byUrl.values()]
    .sort((a,b)=>{
      if (a.confidence !== b.confidence) return a.confidence === "strong" ? -1 : 1;
      return a.platform.localeCompare(b.platform);
    })
    .slice(0,60);

  const strong = sources.filter(s=>s.confidence==="strong").length;
  const possible = sources.filter(s=>s.confidence==="possible").length;
  const uniqueDomains = new Set(sources.map(s=>s.domain).filter(Boolean)).size;
  const platforms = new Set(sources.map(s=>s.platform).filter(Boolean));

  const accounts = sources
    .filter(s=>s.handleMasked)
    .slice(0,18)
    .map(s=>[s.platform,s.handleMasked,s.confidence,s.url]);

  const findings = [
    ["Public pages returned",sources.length+" unique public/indexed pages matched the supplied identifiers.","LIVE SOURCE"],
    ["Strong identity matches",strong+" results matched multiple identifiers.","MATCH CONFIDENCE"],
    ["Possible matches",possible+" results matched name or username but need human confirmation.","REVIEW"]
  ];

  const uniq = arr => [...new Set(arr)].slice(0,5);
  const emailClues = uniq(clues.emails), phoneClues = uniq(clues.phones), addressClues = uniq(clues.addresses);
  if (emailClues.length) findings.push(["Email clues",emailClues.length+" masked public email clues. Example: "+emailClues[0],"MASKED"]);
  if (phoneClues.length) findings.push(["Phone clues",phoneClues.length+" masked public phone clues. Example: "+phoneClues[0],"MASKED"]);
  if (addressClues.length) findings.push(["Address clues",addressClues.length+" masked public address clues. Example: "+addressClues[0],"MASKED"]);

  const coverageNames = ["LinkedIn","Instagram","Facebook","TikTok","Threads","Reddit","X / Twitter","YouTube","Strava","GitHub","Medium","Substack"];
  const sourceCoverage = {
    searched:queries.length,
    matched:new Set(sources.map(s=>s.queryGroup)).size,
    sources:coverageNames.map(name=>({name,matched:platforms.has(name)}))
  };

  return respond({
    dataMode:"verified",
    synthetic:false,
    subject:fullName,
    score:sources.length,
    level:"PUBLIC HITS",
    stats:[
      {n:strong,k:"strong matches"},
      {n:possible,k:"possible matches"},
      {n:platforms.size,k:"source types"},
      {n:uniqueDomains,k:"unique domains"}
    ],
    findings,
    accounts,
    sourceCoverage,
    publicSources:sources,
    ageMatching:ageContext ? {
      entered:ageContext.entered,
      supportingRange:ageContext.minAge+"–"+ageContext.maxAge,
      note:"Age is a soft supporting signal only and never filters out a result."
    } : null,
    signals:[],
    imageBreakdown:[],
    activity:[],
    themes:[],
    searchedAt:new Date().toISOString(),
    provider:"Brave Search API"
  });
};

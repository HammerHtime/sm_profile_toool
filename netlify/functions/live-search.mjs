import { synthesizePublicProfile } from "./profile-intelligence.mjs";
import { googleGeocodingConfigured, normalizeBroadPlace, normalizeStoryLocations } from "./google-geocoding.mjs";
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const BRAVE_IMAGE_ENDPOINT = "https://api.search.brave.com/res/v1/images/search";

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

  // Mask contact strings before scanning addresses so the tail of a phone
  // number cannot be mistaken for a street number.
  for (const v of emails) out = out.replaceAll(v, maskEmail(v));
  for (const v of phones) out = out.replaceAll(v, maskPhone(v));

  const addresses = [...out.matchAll(/\b\d{1,6}[A-Za-z]?\s+(?:[A-Za-z0-9.'-]+\s+){0,4}(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Crescent|Cres|Way)\b/gi)].map(m => m[0]);
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
    const supported = new Set([
      "LinkedIn","Instagram","Facebook","TikTok","Reddit","X / Twitter","YouTube",
      "Threads","Strava","GitHub","Medium","Pinterest","Twitch","Bluesky","Flickr"
    ]);
    if (!supported.has(platform)) return "";

    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    let candidate = "";

    if (platform === "LinkedIn") {
      if (parts[0] !== "in") return "";
      candidate = parts[1] || "";
    } else if (platform === "YouTube") {
      if (parts[0]?.startsWith("@")) candidate = parts[0];
      else if (["channel","c","user"].includes(parts[0])) candidate = parts[1] || "";
    } else if (platform === "Reddit") {
      if (!["user","u"].includes(parts[0])) return "";
      candidate = parts[1] || "";
    } else if (platform === "Strava") {
      if (parts[0] !== "athletes") return "";
      candidate = parts[1] || "";
    } else if (platform === "Bluesky") {
      if (parts[0] !== "profile") return "";
      candidate = parts[1] || "";
    } else if (platform === "Flickr") {
      if (parts[0] !== "people") return "";
      candidate = parts[1] || "";
    } else if (platform === "TikTok" || platform === "Threads" || platform === "Medium") {
      if (!parts[0]?.startsWith("@")) return "";
      candidate = parts[0];
    } else {
      candidate = parts[0] || "";
    }

    candidate = candidate.replace(/^@/, "");
    if (!candidate || /^(posts?|share|watch|groups?|pages?|search|explore|company|school|news|article|articles|sports)$/i.test(candidate)) return "";
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

function parseSearchClues(value) {
  if (typeof value !== "string") return [];
  const seen = new Set();
  const out = [];
  for (const raw of value.split(",")) {
    const clue = clean(raw, 80);
    const key = normalize(clue);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(clue);
    if (out.length >= 10) break;
  }
  return out;
}

function ageAssessment(haystack, ageCtx) {
  if (!ageCtx) return { supported:false, conflict:false, reason:"" };
  const h = String(haystack);

  const explicitAges = [];
  const agePatterns = [
    /\b(?:age|aged)\s+(\d{2})\b/gi,
    /\b(\d{2})[- ]year[- ]old\b/gi
  ];
  for (const re of agePatterns) {
    for (const m of h.matchAll(re)) explicitAges.push(Number(m[1]));
  }

  for (const value of explicitAges) {
    if (value >= ageCtx.minAge && value <= ageCtx.maxAge) {
      return { supported:true, conflict:false, reason:"rough age compatible ("+ageCtx.minAge+"–"+ageCtx.maxAge+")" };
    }
  }
  if (explicitAges.some(value => Number.isFinite(value))) {
    return { supported:false, conflict:true, reason:"explicit age conflicts with supplied age" };
  }

  const birthYears=[];
  for (const m of h.matchAll(/\b(?:born|birth|dob|date of birth)\D{0,12}(19\d{2}|20\d{2})\b/gi)) {
    birthYears.push(Number(m[1]));
  }
  for (const year of birthYears) {
    if (year >= ageCtx.minBirthYear && year <= ageCtx.maxBirthYear) {
      return { supported:true, conflict:false, reason:"birth-year clue compatible" };
    }
  }
  if (birthYears.length) {
    return { supported:false, conflict:true, reason:"birth-year clue conflicts with supplied age" };
  }

  return { supported:false, conflict:false, reason:"" };
}

function clueVariants(clue = "") {
  const key=normalize(clue);
  const variants=[key];
  if (key.includes("university of western ontario")) variants.push("western university");
  if (key.includes("western university")) variants.push("university of western ontario");
  if (key === "toronto police" || key.includes("toronto police service")) {
    variants.push("toronto police");
    variants.push("toronto police service");
    variants.push("tps");
  }
  return [...new Set(variants.filter(Boolean))];
}

function variantMatches(hay = "", variant = "") {
  const key=normalize(variant);
  if (!key) return false;
  if (key.length <= 3) {
    return hay.split(/[^a-z0-9]+/).filter(Boolean).includes(key);
  }
  return hay.includes(key);
}

function cityIdentitySupport(raw = "", city = "") {
  const key=normalize(city);
  if (!key) return { mentioned:false, anchored:false };
  const hay=normalize(raw);
  const mentioned=hay.includes(key);
  if (!mentioned) return { mentioned:false, anchored:false };

  const anchors=[
    "based in "+key,
    "based "+key,
    "from "+key,
    "lives in "+key,
    "located in "+key,
    key+" ontario",
    key+" on canada",
    key+" canada",
    key+" police",
    key+" university",
    key+" based"
  ];
  return { mentioned:true, anchored:anchors.some(anchor=>hay.includes(anchor)) };
}

function matchResult(result, person) {
  const raw = [result.title, result.description, result.url].filter(Boolean).join(" ");
  const hay = normalize(raw);
  const full = normalize(person.fullName);
  const username = normalize(person.username.replace(/^@/, ""));
  const reasons = [];

  const fullName = full && hay.includes(full);
  const city = cityIdentitySupport(raw, person.city);
  const cityRequired = !!normalize(person.city);
  const usernameUrl = username && normalize(result.url).includes(username);
  const usernameAny = username && hay.includes(username);
  const age = ageAssessment(raw, person.ageContext);

  const clueMatches = (person.searchClues || []).filter(clue =>
    clueVariants(clue).some(variant => variantMatches(hay,variant))
  );
  const clueGateActive = (person.searchClues || []).length > 0;

  if (usernameUrl) reasons.push("username in URL");
  else if (usernameAny) reasons.push("username match");
  if (fullName) reasons.push("full name");
  if (city.anchored) reasons.push("city identity context");
  else if (city.mentioned) reasons.push("city mentioned");
  if (age.supported) reasons.push(age.reason);
  if (age.conflict) reasons.push(age.reason);
  clueMatches.slice(0,4).forEach(clue => reasons.push("clue: " + clue));

  // An exact user-supplied username in an account URL is an independent identifier.
  if (usernameUrl) return { confidence:"strong", reasons };

  // Explicit age/birth-year contradictions beat a same-name hit.
  if (age.conflict && fullName) {
    return { confidence:"discard", reasons, identityRejected:true };
  }

  // When the user supplies identity clues, name-only results must overlap at least
  // one clue. This is the key protection against common-name collisions.
  if (clueGateActive && fullName && !usernameAny && clueMatches.length === 0) {
    return {
      confidence:"discard",
      reasons,
      identityRejected:true,
      geographyRejected:cityRequired && !city.anchored
    };
  }

  // A city appearing incidentally in an article is not enough. It needs profile-like
  // geographic context unless another supplied clue independently ties the result.
  if (cityRequired && fullName && !city.anchored && clueMatches.length === 0 && !usernameAny) {
    return { confidence:"discard", reasons, geographyRejected:city.mentioned };
  }

  if (
    (fullName && clueMatches.length >= 1) ||
    (usernameAny && clueMatches.length >= 1) ||
    (fullName && city.anchored) ||
    (usernameAny && city.anchored) ||
    (fullName && age.supported && !cityRequired)
  ) {
    return { confidence:"strong", reasons };
  }

  // If the search has no extra identity anchors, retain a plain name hit only for
  // human review. Once city/clues are supplied, weak name-only results stay out.
  if ((fullName || usernameAny) && !cityRequired && !clueGateActive) {
    return { confidence:"possible", reasons };
  }

  return { confidence:"discard", reasons:[] };
}

const PRESENTATION_STOP_WORDS = new Set([
  "the","and","for","with","from","that","this","your","you","are","was","were","has","have","had","but","not","all","can","our","out",
  "about","into","more","than","their","they","them","his","her","she","him","who","what","when","where","how","why","will","would",
  "www","http","https","com","org","net","ca","profile","public","page","pages","home","official","view","website","site","search",
  "facebook","instagram","linkedin","tiktok","twitter","reddit","youtube","threads","github","strava"
]);

const PRESENTATION_SENSITIVE_TERMS = /\b(?:diagnos(?:is|ed)|cancer|hiv|aids|medical condition|medication|depression|suicid|religion|religious|catholic|muslim|jewish|christian|hindu|mosque|synagogue|sexual orientation|gay|lesbian|bisexual|transgender|political party|liberal party|conservative party|new democratic party|ndp|arrested|criminal charge|convicted|conviction)\b/i;

function safeForPresentation(value = "") {
  return !PRESENTATION_SENSITIVE_TERMS.test(String(value || ""));
}

function safeExcerpt(value = "", max = 132) {
  const masked = redact(String(value || "")).text.replace(/\s+/g," ").trim();
  if (!masked) return "";
  if (masked.length <= max) return masked;
  const cut = masked.slice(0,max).replace(/\s+\S*$/,"").trim();
  return (cut || masked.slice(0,max)).trim() + "…";
}

function presentationThemes(items, person) {
  const excluded = new Set(
    [person.fullName,person.city,person.username]
      .filter(Boolean)
      .flatMap(v=>normalize(v).replace(/[@._-]/g," ").split(/\s+/))
      .filter(Boolean)
  );
  ["masked","email","phone","address","contact","result","results","community"].forEach(term=>{
    if(term==="community")return;
    excluded.add(term);
  });
  const counts = new Map();
  for (const item of items) {
    const text = normalize([item.title,item.snippet].filter(Boolean).join(" ")).replace(/[@._-]/g," ");
    for (const rawToken of text.split(/\s+/)) {
      const token=rawToken.replace(/[^a-z0-9]/g,"");
      if (!token || token.length < 4 || token.length > 24) continue;
      if (/^\d+$/.test(token) || /xxx|masked/.test(token) || PRESENTATION_STOP_WORDS.has(token) || excluded.has(token)) continue;
      counts.set(token,(counts.get(token)||0)+1);
    }
  }
  return [...counts.entries()]
    .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
    .slice(0,12)
    .map(([term,count])=>({term,count}));
}

function braveThumbnail(result = {}) {
  const candidates = [result.thumbnail?.src,result.profile?.img,result.meta_url?.favicon];
  return candidates.find(url=>typeof url==="string" && /^https:\/\/imgs\.search\.brave\.com\//i.test(url)) || "";
}

async function searchImages(apiKey, q) {
  const data = await braveJson(apiKey, BRAVE_IMAGE_ENDPOINT, {
    q,
    country:"CA",
    search_lang:"en",
    count:16,
    safesearch:"strict"
  });
  return Array.isArray(data?.results) ? data.results : [];
}

function imageMatchesPerson(result, person) {
  const hay = normalize([result?.title,result?.url,result?.source].filter(Boolean).join(" "));
  if (!hay) return false;
  const full = normalize(person.fullName);
  const city = normalize(person.city);
  const handle = normalize(String(person.username || "").replace(/^@/,""));
  const nameParts = full.split(/\s+/).filter(Boolean);
  const fullNameMatch = full && hay.includes(full);
  const partsMatch = nameParts.length >= 2 && nameParts.every(part=>hay.includes(part));
  const handleMatch = handle && hay.includes(handle);
  const cityMatch = city && hay.includes(city);

  // Exact handles can stand on their own. Name-only image matches must respect the
  // supplied city so unrelated same-name people do not appear in the presentation.
  if (handleMatch) return true;
  if (city && !cityMatch) return false;
  return !!(fullNameMatch || partsMatch);
}

const providerWait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function braveJson(apiKey, endpoint, params, maxRetries = 2) {
  const url = new URL(endpoint);
  for (const [key,value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key,String(value));
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method:"GET",
      headers:{
        "accept":"application/json",
        "x-subscription-token":apiKey
      },
      signal:AbortSignal.timeout(10000)
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;

    const detail = data?.error?.detail || data?.message || ("Search provider returned HTTP " + response.status);
    if (response.status === 429 && attempt < maxRetries) {
      const resetHeader = response.headers.get("x-ratelimit-reset") || "";
      const resetValues = resetHeader.split(",").map(v=>Number(v.trim())).filter(Number.isFinite);
      const seconds = Math.max(1, Math.min(4, resetValues[0] || 1));
      await providerWait(seconds * 1000 + 120);
      continue;
    }

    const error = new Error(detail);
    error.status = response.status;
    error.code = data?.error?.code || "";
    throw error;
  }

  throw new Error("Search provider retry limit reached");
}

async function searchWeb(apiKey, q) {
  const data = await braveJson(apiKey, BRAVE_ENDPOINT, {
    q,
    country:"CA",
    search_lang:"en",
    count:20
  });
  return data?.web?.results || [];
}

export default async (req) => {
  const apiKey = getBraveApiKey();

  if (req.method !== "POST") return respond({ error:"POST required" }, 405);

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
  const searchClues = parseSearchClues(body.clues || "");
  const fullName = [firstName,lastName].filter(Boolean).join(" ").trim();

  if (!firstName || !lastName) return respond({ error:"First and last name are required." }, 400);
  if (age && Number(age) < 18) return respond({ error:"Live person search is disabled for minors." }, 400);

  const ageContext = buildAgeContext(age);
  const quotedName = '"' + fullName.replaceAll('"',"") + '"';
  const quotedCity = city ? '"' + city.replaceAll('"',"") + '"' : "";
  const nameWithCity = [quotedName, quotedCity].filter(Boolean).join(" ");

  // Do not put exact age into the main search queries. Age is a soft local ranking signal only.
  // If a city is supplied, carry it through every name-based search pass so geography is
  // enforced both at the provider-query stage and again by the local match filter.
  const queries = [
    { group:"Open web", q:nameWithCity },
    { group:"Professional", q:nameWithCity + " site:linkedin.com/in" },
    { group:"Social", q:nameWithCity + " (site:instagram.com OR site:facebook.com OR site:tiktok.com OR site:threads.net)" },
    { group:"Discussion", q:nameWithCity + " (site:reddit.com OR site:x.com OR site:twitter.com)" },
    { group:"Video", q:nameWithCity + " site:youtube.com" },
    { group:"Activity", q:nameWithCity + " (site:strava.com OR site:github.com OR site:medium.com OR site:substack.com)" },
    { group:"News & organizations", q:[nameWithCity, "(news OR bio OR event OR conference OR organization)"].filter(Boolean).join(" ") }
  ];
  if (username) queries.push({ group:"Username", q:'"' + username.replaceAll('"',"") + '"' });

  for (let i = 0; i < searchClues.length; i += 3) {
    const group = searchClues.slice(i, i + 3);
    const clueExpression = group.map(clue => '"' + clue.replaceAll('"',"") + '"').join(" OR ");
    queries.push({
      group:"Clues: " + group.join(", "),
      q:nameWithCity + " (" + clueExpression + ")"
    });
  }

  const person = { fullName, city, username, ageContext, searchClues };
  const byUrl = new Map();
  let geographyRejected = 0;
  const contactClues = { emails:[], phones:[], addresses:[] };

  const queryBatches = [];
  for (const query of queries) {
    try {
      const results = await searchWeb(apiKey, query.q);
      queryBatches.push({ query, results, error:null });
    } catch (error) {
      console.error("live-search pass failed", query.group, error);
      queryBatches.push({
        query,
        results:[],
        error:error?.message || "Search pass failed",
        status:Number(error?.status) || null,
        code:error?.code || ""
      });
    }

    // A short spacing delay keeps the demo compatible with lower burst-rate plans.
    if (query !== queries[queries.length - 1]) await providerWait(220);
  }

  const completedPasses = queryBatches.filter(batch => !batch.error);
  const failedPasses = queryBatches.filter(batch => batch.error);

  if (!completedPasses.length) {
    return respond({
      error:"The public search provider did not complete any search passes.",
      detail:"Try again in a moment. Synthetic Demo remains available as a presentation fallback.",
      providerErrors:[...new Set(failedPasses.map(batch=>{
        const status=batch.status ? ("HTTP "+batch.status+" ") : "";
        const code=batch.code ? (batch.code+" ") : "";
        return (status+code+(batch.error||"Search pass failed")).trim();
      }))].slice(0,4)
    }, 502);
  }

  for (const batch of completedPasses) {
    const query = batch.query;
    for (const raw of batch.results) {
      if (!raw?.url) continue;
      try {
        const parsedUrl = new URL(raw.url);
        if (!["http:","https:"].includes(parsedUrl.protocol)) continue;
      } catch {
        continue;
      }
      const match = matchResult(raw, person);
      if (match.confidence === "discard") {
        if (match.geographyRejected) geographyRejected += 1;
        continue;
      }

      const title = redact(raw.title || "");
      const snippet = redact(raw.description || "");
      contactClues.emails.push(...title.emails,...snippet.emails);
      contactClues.phones.push(...title.phones,...snippet.phones);
      contactClues.addresses.push(...title.addresses,...snippet.addresses);

      const platform = platformFor(raw.url);
      const item = {
        url:raw.url,
        domain:(()=>{ try { return new URL(raw.url).hostname.replace(/^www\./,""); } catch { return ""; } })(),
        platform,
        confidence:match.confidence,
        reasons:match.reasons,
        queryGroup:query.group,
        handleMasked:maskedHandle(raw.url,platform),
        title:safeExcerpt(title.text,120),
        snippet:safeExcerpt(snippet.text,150),
        published:clean(raw.page_age || raw.age || "",50),
        thumbnail:braveThumbnail(raw)
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
    ["Strong identifier matches",strong+" results matched multiple supplied identifiers.","MATCH CONFIDENCE"],
    ["Possible matches",possible+" results matched name or username but need human confirmation.","REVIEW"]
  ];

  const uniq = arr => [...new Set(arr)].slice(0,5);
  const emailClues = uniq(contactClues.emails), phoneClues = uniq(contactClues.phones), addressClues = uniq(contactClues.addresses);
  if (emailClues.length) findings.push(["Email clues",emailClues.length+" masked public email clues. Example: "+emailClues[0],"MASKED"]);
  if (phoneClues.length) findings.push(["Phone clues",phoneClues.length+" masked public phone clues. Example: "+phoneClues[0],"MASKED"]);
  if (addressClues.length) findings.push(["Address clues",addressClues.length+" masked public address clues. Example: "+addressClues[0],"MASKED"]);

  const coverageNames = ["LinkedIn","Instagram","Facebook","TikTok","Threads","Reddit","X / Twitter","YouTube","Strava","GitHub","Medium","Substack"];
  const quoteSnippets = sources
    .filter(source=>source.snippet && safeForPresentation(source.snippet))
    .slice(0,8)
    .map(source=>({
      platform:source.platform,
      domain:source.domain,
      text:safeExcerpt(source.snippet,118),
      confidence:source.confidence
    }));

  const webThumbnails = sources
    .filter(source=>source.thumbnail)
    .map(source=>({
      src:source.thumbnail,
      platform:source.platform,
      domain:source.domain,
      confidence:source.confidence,
      basis:"Web result thumbnail"
    }));

  let imageSearch = { attempted:true, completed:false, error:null, results:[] };
  try {
    const imageQuery = [
      quotedName,
      city && '"' + city.replaceAll('"',"") + '"',
      username && '"' + username.replaceAll('"',"") + '"'
    ].filter(Boolean).join(" ");
    const imageResults = await searchImages(apiKey,imageQuery);
    imageSearch.completed = true;
    imageSearch.results = imageResults
      .filter(result=>imageMatchesPerson(result,person))
      .map(result=>({
        src:braveThumbnail(result),
        platform:platformFor(result.url || ""),
        domain:clean(result.source || (()=>{ try{return new URL(result.url).hostname.replace(/^www\./,"");}catch{return"";} })(),100),
        confidence:"candidate",
        basis:"Image search matched supplied identifiers"
      }))
      .filter(result=>result.src)
      .slice(0,12);
  } catch (error) {
    imageSearch.error = error?.message || "Image search failed";
    console.error("live image search failed",error);
  }

  const visualPhotos = [...webThumbnails,...imageSearch.results]
    .filter((item,index,list)=>list.findIndex(other=>other.src===item.src)===index)
    .slice(0,12);

  const themeTerms = presentationThemes(sources.filter(source=>safeForPresentation([source.title,source.snippet].join(" "))),person);
  const signals = [];
  if (platforms.size > 1) signals.push(["◎","Cross-platform presence",platforms.size+" public source types returned matching pages."]);
  if (platforms.has("LinkedIn") || platforms.has("News")) signals.push(["▤","Professional or public references","Professional, organization or news results were present in the public search."]);
  if (platforms.has("Reddit") || platforms.has("X / Twitter")) signals.push(["✎","Public discussion footprint","Public discussion or social-post results were returned by the search provider."]);
  if (visualPhotos.length) signals.push(["▣","Public image results",visualPhotos.length+" blurred image thumbnails matched the supplied search identifiers. These are not face-verified."]);

  const presentation = {
    photos:visualPhotos,
    quotes:quoteSnippets,
    themes:themeTerms,
    disclaimer:"Images are public search thumbnails matching supplied identifiers. They are blurred in the presentation and are not verified by facial recognition."
  };

  const sourceCoverage = {
    searched:completedPasses.length,
    attempted:queries.length,
    failed:failedPasses.length,
    matched:new Set(sources.map(s=>s.queryGroup)).size,
    sources:coverageNames.map(name=>({name,matched:platforms.has(name)}))
  };

  const intelligence = await synthesizePublicProfile({
    subject:fullName,
    city,
    sources,
    recurringThemes:themeTerms
  });

  const [enteredPlaceResult, storyLocations] = await Promise.all([
    city ? normalizeBroadPlace(city) : Promise.resolve({place:null}),
    normalizeStoryLocations(intelligence.locations || [],4)
  ]);
  const locationIntelligence = {
    configured:googleGeocodingConfigured(),
    searchAnchor:enteredPlaceResult?.place || null,
    storyLocations
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
    cluesUsed:searchClues,
    signals,
    intelligence,
    locationIntelligence,
    imageBreakdown:visualPhotos.length ? [["Public image search thumbnails",visualPhotos.length]] : [],
    activity:quoteSnippets.length ? [["Public excerpts surfaced",quoteSnippets.length]] : [],
    themes:themeTerms.map(item=>item.term),
    presentation,
    searchedAt:new Date().toISOString(),
    searchHealth:{
      attempted:queries.length,
      completed:completedPasses.length,
      failed:failedPasses.length,
      geographicFilterActive:!!city,
      geographicAnchor:city || null,
      geographyRejected,
      imageSearchCompleted:imageSearch.completed,
      imageSearchError:imageSearch.error
    },
    provider:"Brave Search API"
  });
};


export const config = {
  path:"/api/live-search",
  method:"POST",
  rateLimit:{
    action:"rate_limit",
    aggregateBy:["ip","domain"],
    windowSize:60,
    windowLimit:6
  }
};


export { matchResult, buildAgeContext, maskedHandle };

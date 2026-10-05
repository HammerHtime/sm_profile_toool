import { synthesizePublicProfile } from "./profile-intelligence.mjs";
import { googleGeocodingConfigured, normalizeBroadPlace, normalizeStoryLocations } from "./google-geocoding.mjs";
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const BRAVE_IMAGE_ENDPOINT = "https://api.search.brave.com/res/v1/images/search";
const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

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

function isProfileIdentityUrl(url = "", platform = "") {
  try {
    const u=new URL(url);
    const parts=u.pathname.split("/").filter(Boolean);
    if (!platform) platform=platformFor(url);

    if (platform==="LinkedIn") return parts[0]==="in" && !!parts[1];
    if (platform==="Facebook") {
      const first=(parts[0]||"").toLowerCase();
      if (!first || first.includes(".php")) return false;
      return !/^(posts?|share|watch|groups?|pages?|photos?|videos?|reels?|events?|marketplace|gaming)$/.test(first);
    }
    if (platform==="Instagram") return !!parts[0] && !/^(p|reel|reels|stories|explore)$/.test(parts[0]);
    if (platform==="TikTok" || platform==="Threads") return !!parts[0]?.startsWith("@");
    if (platform==="Reddit") return ["user","u"].includes(parts[0]) && !!parts[1];
    if (platform==="YouTube") return !!parts[0]?.startsWith("@") || ["channel","c","user"].includes(parts[0]);
    if (platform==="X / Twitter" || platform==="GitHub") return !!parts[0] && !/^(home|explore|search|i|intent|settings)$/.test(parts[0]);
  } catch {}
  return false;
}

function accountTokenFor(url = "", platform = "") {
  try {
    const u=new URL(url);
    const parts=u.pathname.split("/").filter(Boolean);
    if (platform==="LinkedIn" && parts[0]==="in") return normalize(parts[1]||"");
    if (platform==="Facebook" || platform==="Instagram" || platform==="X / Twitter" || platform==="GitHub" || platform==="Pinterest" || platform==="Twitch") return normalize(parts[0]||"").replace(/^@/,"");
    if ((platform==="TikTok" || platform==="Threads" || platform==="Medium") && parts[0]?.startsWith("@")) return normalize(parts[0]).replace(/^@/,"");
    if (platform==="Reddit" && ["user","u"].includes(parts[0])) return normalize(parts[1]||"");
    if (platform==="YouTube") {
      if (parts[0]?.startsWith("@")) return normalize(parts[0]).replace(/^@/,"");
      if (["channel","c","user"].includes(parts[0])) return normalize(parts[1]||"");
    }
  } catch {}
  return "";
}

function accountExpansionQuery(source, person = {}) {
  const token=accountTokenFor(source?.url||"",source?.platform||"");
  const fullName=clean(person.fullName||"",120);
  if (!token && !fullName) return "";

  const identity=fullName ? ('"'+fullName.replaceAll('"',"")+'"') : ('"'+token.replaceAll('"',"")+'"');
  const supportTerms=[
    clean(person.city||"",80),
    ...(person.searchClues||[]).slice(0,3)
  ].filter(Boolean).map(value=>'"'+String(value).replaceAll('"',"")+'"');
  const support=supportTerms.length ? " ("+supportTerms.join(" OR ")+")" : "";
  const tokenPart=token && fullName ? (' "'+token.replaceAll('"',"")+'"') : "";

  if (source.platform==="LinkedIn") return "site:linkedin.com/posts " + identity + support + tokenPart;
  if (source.platform==="Facebook") return "site:facebook.com " + identity + support + tokenPart + " (posts OR photos OR videos)";
  if (source.platform==="Instagram") return "site:instagram.com " + identity + support + tokenPart;
  if (source.platform==="X / Twitter") return "(site:x.com OR site:twitter.com) " + identity + support + tokenPart;
  if (source.platform==="TikTok") return "site:tiktok.com " + identity + support + tokenPart;
  if (source.platform==="Threads") return "site:threads.net " + identity + support + tokenPart;
  if (source.platform==="YouTube") return "site:youtube.com " + identity + support + tokenPart;
  if (source.platform==="Reddit") return "site:reddit.com " + identity + support + tokenPart;
  return "";
}

function accountExpansionMatches(raw, seed, person = {}) {
  if (platformFor(raw?.url||"") !== seed.platform) return false;

  const token=accountTokenFor(seed?.url||"",seed?.platform||"");
  const hay=normalize([raw?.url,raw?.title,raw?.description].filter(Boolean).join(" "));
  if (token && variantMatches(hay,token)) return true;

  const match=matchResult(raw,person);
  return match.confidence==="strong";
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
  if (/\btherapist\b|\btherapy\b|\bpsychotherapist\b/.test(key)) {
    variants.push(
      "therapist","therapy","psychotherapist","psychotherapy",
      "counsellor","counselor","counselling","counseling",
      "clinical counsellor","clinical counselor","registered clinical counsellor",
      "registered clinical counselor","rcc"
    );
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
  const provinceTerms=[
    "bc","british columbia","ab","alberta","sk","saskatchewan","mb","manitoba",
    "on","ontario","qc","quebec","nb","new brunswick","ns","nova scotia",
    "pei","prince edward island","nl","newfoundland","newfoundland and labrador",
    "yt","yukon","nt","northwest territories","nu","nunavut"
  ];
  const provinceAnchor=provinceTerms.some(term=>hay.includes(key+" "+term));
  const tokens=hay.split(/\s+/);
  const keyTokens=key.split(/\s+/);
  let postalAnchor=false;
  for(let i=0;i<=tokens.length-keyTokens.length-1;i++){
    if(keyTokens.every((part,j)=>tokens[i+j]===part)){
      const next=tokens[i+keyTokens.length]||"";
      if(/^[a-z]\d[a-z]$/.test(next)){ postalAnchor=true; break; }
    }
  }
  const contextualAnchor=[
    "based in "+key,"based "+key,"from "+key,"lives in "+key,"located in "+key,
    "location "+key,"locations "+key,key+" canada",key+" police",key+" university",
    key+" clinic",key+" counselling",key+" counseling",key+" therapist",key+" psychotherapist",key+" based"
  ].some(anchor=>hay.includes(anchor));
  return { mentioned:true, anchored:provinceAnchor || postalAnchor || contextualAnchor };
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
  const platform=platformFor(result.url||"");
  const profileIdentity=isProfileIdentityUrl(result.url||"",platform);
  const clueMatches = (person.searchClues || []).filter(clue =>
    clueVariants(clue).some(variant => variantMatches(hay,variant))
  );
  const clueGateActive = (person.searchClues || []).length > 0;

  if (usernameUrl) reasons.push("username in URL");
  else if (usernameAny) reasons.push("username match");
  if (fullName) reasons.push("full name");
  if (city.anchored) reasons.push("city identity context");
  else if (city.mentioned) reasons.push("city mentioned");
  if (profileIdentity) reasons.push("personal profile page");
  if (age.supported) reasons.push(age.reason);
  if (age.conflict) reasons.push(age.reason);
  clueMatches.slice(0,4).forEach(clue => reasons.push("clue: " + clue));

  if (usernameUrl) return { confidence:"strong", reasons };
  if (age.conflict && fullName) return { confidence:"discard", reasons, identityRejected:true };
  if (!fullName && !usernameAny) return { confidence:"discard", reasons:[] };

  // If the result does not expose the supplied city, two independent clues can
  // still establish identity. One generic clue alone is not enough.
  if (cityRequired && fullName && !city.anchored && !usernameAny) {
    if (clueMatches.length >= 2 || (clueMatches.length >= 1 && age.supported)) {
      return { confidence:"strong", reasons };
    }
    return {
      confidence:"discard",
      reasons,
      identityRejected:true,
      geographyRejected:true
    };
  }

  if (clueGateActive && fullName) {
    if (cityRequired && city.anchored && clueMatches.length >= 1) return { confidence:"strong", reasons };
    if (cityRequired && city.anchored && profileIdentity) return { confidence:"strong", reasons };
    if (!cityRequired && clueMatches.length >= 1) return { confidence:"strong", reasons };
    if (cityRequired && city.anchored) return { confidence:"possible", reasons };
    return { confidence:"discard", reasons, identityRejected:true };
  }

  if (fullName && city.anchored && profileIdentity) return { confidence:"strong", reasons };
  if (fullName && city.anchored) return { confidence:"possible", reasons };
  if (usernameAny && city.anchored) return { confidence:"strong", reasons };
  if (fullName && age.supported && !cityRequired) return { confidence:"strong", reasons };
  if ((fullName || usernameAny) && !cityRequired) return { confidence:"possible", reasons };

  return { confidence:"discard", reasons:[] };
}

const PRESENTATION_STOP_WORDS = new Set([
  "the","and","for","with","from","that","this","your","you","are","was","were","has","have","had","but","not","all","can","our","out",
  "about","into","more","than","their","they","them","his","her","she","him","who","what","when","where","how","why","will","would",
  "www","http","https","com","org","net","ca","profile","public","page","pages","home","official","view","website","site","search",
  "facebook","instagram","linkedin","tiktok","twitter","reddit","youtube","threads","github","strava",
  "strong","association","associations","define","defined","degree","degrees","holds","holding","life","master","masters","office",
  "member","members","work","working","experience","profile","result","results","page","pages"
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

function narrativeEligibleSource(source = {}) {
  if (source.confidence !== "strong") return false;
  const reasons = Array.isArray(source.reasons) ? source.reasons : [];
  const clueCount = reasons.filter(reason=>String(reason).startsWith("clue: ")).length;
  const username = reasons.some(reason=>/username in url|username match/i.test(reason));
  const city = reasons.some(reason=>/city identity context/i.test(reason));
  const age = reasons.some(reason=>/age compatible|birth-year clue compatible/i.test(reason));
  const profile = reasons.some(reason=>/personal profile page/i.test(reason));

  if (username) return true;
  if (clueCount >= 2) return true;
  if (clueCount >= 1 && (city || age)) return true;
  if (city && (age || profile)) return true;
  return false;
}

function presentationThemes(items, person) {
  const excluded = new Set(
    [person.fullName,person.city,person.username]
      .filter(Boolean)
      .flatMap(v=>normalize(v).replace(/[@._-]/g," ").split(/\s+/))
      .filter(Boolean)
  );
  ["masked","email","phone","address","contact","result","results"].forEach(term=>excluded.add(term));

  const sourceCounts = new Map();
  for (const item of items) {
    const text = normalize([item.title,item.snippet].filter(Boolean).join(" ")).replace(/[@._-]/g," ");
    const seenInThisSource = new Set();

    for (const rawToken of text.split(/\s+/)) {
      const token=rawToken.replace(/[^a-z0-9]/g,"");
      if (!token || token.length < 4 || token.length > 24) continue;
      if (/^\d+$/.test(token) || /xxx|masked/.test(token) || PRESENTATION_STOP_WORDS.has(token) || excluded.has(token)) continue;
      seenInThisSource.add(token);
    }

    for (const token of seenInThisSource) {
      sourceCounts.set(token,(sourceCounts.get(token)||0)+1);
    }
  }

  return [...sourceCounts.entries()]
    .filter(([,count])=>count >= 2)
    .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
    .slice(0,10)
    .map(([term,count])=>({term,count}));
}

function braveThumbnail(result = {}) {
  const candidates = [result.thumbnail?.src,result.thumbnail,result.profile?.img,result.meta_url?.favicon];
  return candidates.find(url=>typeof url==="string" && /^https:\/\//i.test(url)) || "";
}

async function serpApiJson(apiKey, params, maxRetries = 1) {
  const url = new URL(SERPAPI_ENDPOINT);
  for (const [key,value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key,String(value));
  }
  url.searchParams.set("api_key",apiKey);

  for (let attempt=0; attempt<=maxRetries; attempt++) {
    const response = await fetch(url,{
      method:"GET",
      headers:{"accept":"application/json"},
      signal:AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(()=>({}));
    if (response.ok && !data?.error) return data;

    const detail = data?.error || ("SerpApi returned HTTP " + response.status);
    if (response.status === 429 && attempt < maxRetries) {
      await providerWait(900);
      continue;
    }
    const error = new Error(detail);
    error.status = response.status;
    error.code = "SERPAPI";
    throw error;
  }
  throw new Error("SerpApi retry limit reached");
}

function normalizeSerpOrganic(result = {}) {
  return {
    url:result.link || "",
    title:result.title || "",
    description:result.snippet || result.snippet_highlighted_words?.join(" ") || "",
    age:result.date || "",
    page_age:result.date || "",
    thumbnail:result.thumbnail || ""
  };
}

function normalizeSerpImage(result = {}) {
  return {
    url:result.link || result.original || "",
    title:result.title || "",
    source:result.source || "",
    thumbnail:result.thumbnail || result.original || ""
  };
}

async function searchImages(providerState, q, location = "") {
  if (providerState.braveKey && !providerState.braveDisabled) {
    try {
      const data = await braveJson(providerState.braveKey, BRAVE_IMAGE_ENDPOINT, {
        q,
        country:"CA",
        search_lang:"en",
        count:16,
        safesearch:"strict"
      });
      providerState.used.add("Brave Search API");
      return Array.isArray(data?.results) ? data.results : [];
    } catch (error) {
      providerState.errors.push("Brave images: " + (error?.message || "failed"));
      if ([401,402,403].includes(Number(error?.status))) providerState.braveDisabled = true;
    }
  }

  if (providerState.serpKey) {
    const data = await serpApiJson(providerState.serpKey,{
      engine:"google_images",
      q,
      location:location || undefined,
      hl:"en",
      safe:"active"
    });
    providerState.used.add("SerpApi Google");
    return (data?.images_results || []).slice(0,20).map(normalizeSerpImage);
  }

  return [];
}

function imageMatchesPerson(result, person) {
  const raw=[result?.title,result?.url,result?.source].filter(Boolean).join(" ");
  const hay = normalize(raw);
  if (!hay) return false;

  const full = normalize(person.fullName);
  const handle = normalize(String(person.username || "").replace(/^@/,""));
  const nameParts = full.split(/\s+/).filter(Boolean);
  const fullNameMatch = full && hay.includes(full);
  const partsMatch = nameParts.length >= 2 && nameParts.every(part=>hay.includes(part));
  const handleMatch = handle && hay.includes(handle);
  const city = cityIdentitySupport(raw, person.city);
  const clueMatches = (person.searchClues || []).filter(clue =>
    clueVariants(clue).some(variant => variantMatches(hay,variant))
  );

  if (handleMatch) return true;
  if (!(fullNameMatch || partsMatch)) return false;

  if ((person.searchClues || []).length) {
    if (!clueMatches.length) return false;
    return clueMatches.length >= 2 || city.anchored;
  }

  if (normalize(person.city)) return city.anchored;
  return true;
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

async function searchWebPage(providerState, q, offset = 0, location = "") {
  if (providerState.braveKey && !providerState.braveDisabled) {
    try {
      const data = await braveJson(providerState.braveKey, BRAVE_ENDPOINT, {
        q,
        country:"CA",
        search_lang:"en",
        count:20,
        offset
      });
      providerState.used.add("Brave Search API");
      return {
        results:data?.web?.results || [],
        moreResultsAvailable:!!data?.query?.more_results_available,
        provider:"Brave Search API"
      };
    } catch (error) {
      providerState.errors.push("Brave: " + (error?.message || "failed"));
      if ([401,402,403].includes(Number(error?.status))) providerState.braveDisabled = true;
    }
  }

  if (providerState.serpKey) {
    const start=Math.max(0,Number(offset)||0) * 10;
    const data=await serpApiJson(providerState.serpKey,{
      engine:"google",
      q,
      location:location || undefined,
      hl:"en",
      num:10,
      start
    });
    providerState.used.add("SerpApi Google");
    const results=(data?.organic_results || []).map(normalizeSerpOrganic);
    return {
      results,
      moreResultsAvailable:!!data?.serpapi_pagination?.next || results.length >= 10,
      provider:"SerpApi Google"
    };
  }

  const error = new Error("No usable public search provider is available.");
  error.status = 503;
  throw error;
}

async function searchWeb(providerState, q, offset = 0, location = "") {
  return (await searchWebPage(providerState,q,offset,location)).results;
}

export default async (req) => {
  const braveApiKey = getBraveApiKey();
  const serpApiKey = getSerpApiKey();

  if (req.method !== "POST") return respond({ error:"POST required" }, 405);

  if (!braveApiKey && !serpApiKey) {
    return respond({
      error:"Live public search is not configured.",
      detail:"Add SERPAPI_API_KEY or BRAVE_SEARCH_API_KEY to the Netlify site's environment variables."
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
  const expandedClues=[...new Set(searchClues.flatMap(clue=>clueVariants(clue)))].slice(0,10);
  const clueExpression=expandedClues.length
    ? "(" + expandedClues.map(clue=>'"'+clue.replaceAll('"',"")+'"').join(" OR ") + ")"
    : "";
  const supportTerms=[
    quotedCity,
    ...expandedClues.slice(0,6).map(clue=>'"'+clue.replaceAll('"',"")+'"')
  ].filter(Boolean);
  const supportExpression=supportTerms.length ? "(" + supportTerms.join(" OR ") + ")" : "";
  const strictIdentityQuery=[nameWithCity,clueExpression].filter(Boolean).join(" ");
  const supportIdentityQuery=[quotedName,supportExpression].filter(Boolean).join(" ");

  const queries = [
    { group:"Open web · broad", q:nameWithCity || quotedName },
    { group:"Open web · identity", q:supportIdentityQuery || strictIdentityQuery || nameWithCity },
    { group:"LinkedIn · profiles", q:(nameWithCity || quotedName) + " site:linkedin.com/in", deep:true },
    { group:"LinkedIn · activity", q:(supportIdentityQuery || quotedName) + " site:linkedin.com/posts", deep:true },
    { group:"Facebook · profiles & posts", q:(supportIdentityQuery || quotedName) + " site:facebook.com", deep:true },
    { group:"Social", q:(supportIdentityQuery || quotedName) + " (site:instagram.com OR site:tiktok.com OR site:threads.net)" },
    { group:"Discussion", q:(supportIdentityQuery || quotedName) + " (site:reddit.com OR site:x.com OR site:twitter.com)" },
    { group:"Video", q:(supportIdentityQuery || quotedName) + " site:youtube.com" },
    { group:"Professional directories", q:(supportIdentityQuery || quotedName) + " (profile OR bio OR practice OR clinic OR directory OR association)" },
    { group:"News & organizations", q:(supportIdentityQuery || quotedName) + " (news OR event OR conference OR organization OR interview)" }
  ];
  if (username) queries.push({ group:"Username", q:'"' + username.replaceAll('"',"") + '"' });

  const person = { fullName, city, username, ageContext, searchClues };
  const providerState = {
    braveKey:braveApiKey,
    serpKey:serpApiKey,
    braveDisabled:false,
    used:new Set(),
    errors:[]
  };
  const byUrl = new Map();
  let geographyRejected = 0;
  let identityRejected = 0;
  const contactClues = { emails:[], phones:[], addresses:[] };

  const queryBatches = [];
  for (const query of queries) {
    try {
      const firstPage = await searchWebPage(providerState, query.q, 0, city);
      queryBatches.push({ query, results:firstPage.results, error:null, offset:0, provider:firstPage.provider });

      if (query.deep && firstPage.moreResultsAvailable) {
        await providerWait(180);
        try {
          const secondPage=await searchWebPage(providerState,query.q,1,city);
          queryBatches.push({
            query:{...query,group:query.group+" · page 2"},
            results:secondPage.results,
            error:null,
            offset:1,
            provider:secondPage.provider
          });
        } catch (error) {
          console.error("live-search page 2 failed", query.group, error);
          queryBatches.push({
            query:{...query,group:query.group+" · page 2"},
            results:[],
            error:error?.message || "Second search page failed",
            status:Number(error?.status) || null,
            code:error?.code || "",
            offset:1
          });
        }
      }
    } catch (error) {
      console.error("live-search pass failed", query.group, error);
      queryBatches.push({
        query,
        results:[],
        error:error?.message || "Search pass failed",
        status:Number(error?.status) || null,
        code:error?.code || "",
        offset:0
      });
    }

    if (query !== queries[queries.length - 1]) await providerWait(220);
  }

  const completedPasses = queryBatches.filter(batch => !batch.error);
  const failedPasses = queryBatches.filter(batch => batch.error);

  if (!completedPasses.length) {
    return respond({
      error:"The public search provider did not complete any search passes.",
      detail:"Try again in a moment. Synthetic Demo remains available as a presentation fallback.",
      providerErrors:[...new Set([
        ...providerState.errors,
        ...failedPasses.map(batch=>{
          const status=batch.status ? ("HTTP "+batch.status+" ") : "";
          const code=batch.code ? (batch.code+" ") : "";
          return (status+code+(batch.error||"Search pass failed")).trim();
        })
      ])].slice(0,6)
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
        if (match.identityRejected) identityRejected += 1;
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
        provider:batch.provider || "",
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

  let accountExpansionPasses=0;
  const accountPriority={"LinkedIn":0,"Facebook":1,"Instagram":2,"X / Twitter":3,"TikTok":4,"Threads":5,"YouTube":6,"Reddit":7};
  const seedKeys=new Set();
  const accountSeeds=[...byUrl.values()]
    .filter(source=>source.confidence==="strong" && accountExpansionQuery(source,person))
    .sort((a,b)=>(accountPriority[a.platform]??99)-(accountPriority[b.platform]??99))
    .filter(source=>{
      const key=source.platform+"|"+(accountTokenFor(source.url,source.platform)||source.url);
      if(seedKeys.has(key)) return false;
      seedKeys.add(key);
      return true;
    })
    .slice(0,4);

  for (const seed of accountSeeds) {
    const q=accountExpansionQuery(seed,person);
    if (!q) continue;
    try {
      const expanded=await searchWeb(providerState,q,0,city);
      accountExpansionPasses += 1;
      for (const raw of expanded) {
        if (!raw?.url || byUrl.has(raw.url) || !accountExpansionMatches(raw,seed,person)) continue;
        const title=redact(raw.title||"");
        const snippet=redact(raw.description||"");
        const platform=platformFor(raw.url);
        byUrl.set(raw.url,{
          url:raw.url,
          domain:(()=>{ try { return new URL(raw.url).hostname.replace(/^www\./,""); } catch { return ""; } })(),
          platform,
          confidence:"strong",
          reasons:[...(seed.reasons||[]),"verified account expansion"],
          queryGroup:"Verified account expansion: "+platform,
          handleMasked:maskedHandle(raw.url,platform),
          title:safeExcerpt(title.text,120),
          snippet:safeExcerpt(snippet.text,150),
          published:clean(raw.page_age || raw.age || "",50),
          thumbnail:braveThumbnail(raw)
        });
      }
    } catch (error) {
      console.error("verified account expansion failed",seed.platform,error);
    }
    await providerWait(220);
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
  const narrativeSources = sources.filter(source=>narrativeEligibleSource(source));

  const quoteSnippets = narrativeSources
    .filter(source=>source.snippet && safeForPresentation(source.snippet))
    .slice(0,8)
    .map(source=>({
      platform:source.platform,
      domain:source.domain,
      text:safeExcerpt(source.snippet,118),
      confidence:source.confidence
    }));

  const webThumbnails = narrativeSources
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
      expandedClues.slice(0,5).map(clue=>'"'+clue.replaceAll('"',"")+'"').join(" "),
      username && '"' + username.replaceAll('"',"") + '"'
    ].filter(Boolean).join(" ");
    const imageResults = await searchImages(providerState,imageQuery,city);
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

  const themeTerms = presentationThemes(
    narrativeSources.filter(source=>safeForPresentation([source.title,source.snippet].join(" "))),
    person
  );
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
    searched:completedPasses.length + accountExpansionPasses,
    attempted:queryBatches.length + accountSeeds.length,
    failed:failedPasses.length,
    matched:new Set(sources.map(s=>s.queryGroup)).size,
    sources:coverageNames.map(name=>({name,matched:platforms.has(name)}))
  };

  const intelligence = await synthesizePublicProfile({
    subject:fullName,
    city,
    sources:narrativeSources,
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
      attempted:queryBatches.length,
      completed:completedPasses.length,
      failed:failedPasses.length,
      rawResults:queryBatches.reduce((sum,batch)=>sum+(batch.results?.length||0),0),
      acceptedSources:sources.length,
      strongSources:strong,
      possibleSources:possible,
      identityRejected,
      deepPages:queryBatches.filter(batch=>batch.offset===1 && !batch.error).length,
      accountExpansionPasses,
      geographicFilterActive:!!city,
      geographicAnchor:city || null,
      geographyRejected,
      imageSearchCompleted:imageSearch.completed,
      imageSearchError:imageSearch.error
    },
    provider:[...providerState.used].join(" + ") || "Unavailable",
    providersUsed:[...providerState.used],
    providerErrors:[...new Set(providerState.errors)].slice(0,6)
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

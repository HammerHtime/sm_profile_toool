const VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

const clean = (value, max = 240) =>
  String(value ?? "").trim().replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").slice(0, max);

function normalizeVisionKey(value = "") {
  let candidate = String(value || "").trim();
  if (!candidate) return "";
  const assignment = candidate.match(/^GOOGLE_VISION_API_KEY\s*=\s*(.+)$/i);
  if (assignment) candidate = assignment[1].trim();
  const quoted = (candidate.startsWith('"') && candidate.endsWith('"')) ||
    (candidate.startsWith("'") && candidate.endsWith("'"));
  if (quoted && candidate.length >= 2) candidate = candidate.slice(1, -1).trim();
  return candidate;
}

export function googleVisionConfigured() {
  return !!normalizeVisionKey(process.env.GOOGLE_VISION_API_KEY || "");
}

function safeHttpUrl(value = "") {
  try {
    const url=new URL(value);
    if(!["http:","https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function domainFor(value = "") {
  try { return new URL(value).hostname.replace(/^www\./,"").toLowerCase(); }
  catch { return ""; }
}

export async function detectWebImage(base64Image = "") {
  const apiKey=normalizeVisionKey(process.env.GOOGLE_VISION_API_KEY || "");
  if(!apiKey || !base64Image){
    return {
      attempted:false,
      configured:!!apiKey,
      fullMatches:0,
      partialMatches:0,
      matchingPages:0,
      similarImages:0,
      pageMatches:[],
      entities:[],
      basis:apiKey ? "No image bytes were available for web detection." : "Google Cloud Vision Web Detection is not configured."
    };
  }

  try {
    const response=await fetch(VISION_ENDPOINT + "?key=" + encodeURIComponent(apiKey),{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        requests:[{
          image:{content:base64Image},
          features:[{type:"WEB_DETECTION",maxResults:12}]
        }]
      }),
      signal:AbortSignal.timeout(20000)
    });

    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const detail=data?.error?.message || ("Google Vision returned HTTP " + response.status);
      throw new Error(detail);
    }

    const first=Array.isArray(data?.responses) ? data.responses[0] : null;
    if(first?.error?.message) throw new Error(first.error.message);
    const web=first?.webDetection || {};

    const pages=(Array.isArray(web.pagesWithMatchingImages)?web.pagesWithMatchingImages:[])
      .map(page=>({
        url:safeHttpUrl(page.url || ""),
        domain:domainFor(page.url || ""),
        title:clean(page.pageTitle || "",120),
        fullMatches:Array.isArray(page.fullMatchingImages)?page.fullMatchingImages.length:0,
        partialMatches:Array.isArray(page.partialMatchingImages)?page.partialMatchingImages.length:0
      }))
      .filter(page=>page.url && page.domain)
      .slice(0,8);

    const entities=(Array.isArray(web.webEntities)?web.webEntities:[])
      .filter(entity=>clean(entity.description || "",80))
      .map(entity=>({
        label:clean(entity.description || "",80),
        score:Number.isFinite(Number(entity.score)) ? Number(Number(entity.score).toFixed(3)) : null
      }))
      .slice(0,8);

    return {
      attempted:true,
      configured:true,
      fullMatches:Array.isArray(web.fullMatchingImages)?web.fullMatchingImages.length:0,
      partialMatches:Array.isArray(web.partialMatchingImages)?web.partialMatchingImages.length:0,
      matchingPages:Array.isArray(web.pagesWithMatchingImages)?web.pagesWithMatchingImages.length:0,
      similarImages:Array.isArray(web.visuallySimilarImages)?web.visuallySimilarImages.length:0,
      pageMatches:pages,
      entities,
      basis:"Google Cloud Vision WEB_DETECTION compared the consented image against public web image signals. No facial identification was used."
    };
  } catch(error) {
    console.error("Google Vision web detection failed",error);
    return {
      attempted:true,
      configured:true,
      fullMatches:0,
      partialMatches:0,
      matchingPages:0,
      similarImages:0,
      pageMatches:[],
      entities:[],
      basis:"Google Cloud Vision Web Detection was unavailable for this request.",
      error:clean(error?.message || "Unknown Vision error",180)
    };
  }
}

const GEOCODING_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

const clean = (value, max = 180) =>
  String(value ?? "").trim().replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").slice(0, max);

function normalizeGeocodingKey(value = "") {
  let candidate = String(value || "").trim();
  if (!candidate) return "";
  const assignment = candidate.match(/^GOOGLE_GEOCODING_API_KEY\s*=\s*(.+)$/i);
  if (assignment) candidate = assignment[1].trim();
  const quoted = (candidate.startsWith('"') && candidate.endsWith('"')) ||
    (candidate.startsWith("'") && candidate.endsWith("'"));
  if (quoted && candidate.length >= 2) candidate = candidate.slice(1, -1).trim();
  return candidate;
}

export function googleGeocodingConfigured() {
  return !!normalizeGeocodingKey(process.env.GOOGLE_GEOCODING_API_KEY || "");
}

function component(result, types) {
  const wanted=Array.isArray(types)?types:[types];
  const components=Array.isArray(result?.address_components)?result.address_components:[];
  const hit=components.find(item=>wanted.some(type=>Array.isArray(item.types)&&item.types.includes(type)));
  return clean(hit?.long_name || "",90);
}

function broadPlace(result) {
  if(!result) return null;
  const locality=component(result,["locality","postal_town","administrative_area_level_3"]);
  const district=component(result,["administrative_area_level_2"]);
  const region=component(result,["administrative_area_level_1"]);
  const country=component(result,["country"]);
  const primary=locality || district || region || country;
  if(!primary) return null;

  const parts=[];
  [primary,region,country].forEach(part=>{
    if(part && !parts.includes(part)) parts.push(part);
  });

  const lat=Number(result?.geometry?.location?.lat);
  const lng=Number(result?.geometry?.location?.lng);

  return {
    label:parts.join(", "),
    locality:locality || null,
    district:district || null,
    region:region || null,
    country:country || null,
    mapCenter:Number.isFinite(lat)&&Number.isFinite(lng)
      ? {lat:Number(lat.toFixed(2)),lon:Number(lng.toFixed(2)),radiusKm:50}
      : null
  };
}

async function geocode(params) {
  const apiKey=normalizeGeocodingKey(process.env.GOOGLE_GEOCODING_API_KEY || "");
  if(!apiKey) return {configured:false,attempted:false,place:null,error:null};

  const url=new URL(GEOCODING_ENDPOINT);
  for(const [key,value] of Object.entries(params)){
    if(value!==undefined && value!==null && String(value)!=="") url.searchParams.set(key,String(value));
  }
  url.searchParams.set("key",apiKey);

  try{
    const response=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(12000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error("Geocoding HTTP "+response.status);
    if(data.status && !["OK","ZERO_RESULTS"].includes(data.status)){
      throw new Error(clean(data.error_message || data.status,160));
    }
    const first=Array.isArray(data.results)?data.results[0]:null;
    return {
      configured:true,
      attempted:true,
      place:broadPlace(first),
      error:null
    };
  }catch(error){
    console.error("Google geocoding failed",error);
    return {
      configured:true,
      attempted:true,
      place:null,
      error:clean(error?.message || "Unknown geocoding error",180)
    };
  }
}

export async function normalizeBroadPlace(query = "") {
  const value=clean(query,140);
  if(!value) return {configured:googleGeocodingConfigured(),attempted:false,place:null,error:null};
  return geocode({address:value});
}

export async function reverseGeocodeBroadZone(zone) {
  const lat=Number(zone?.lat);
  const lon=Number(zone?.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)){
    return {configured:googleGeocodingConfigured(),attempted:false,place:null,error:null};
  }
  // The photo pipeline passes only the already-coarsened 0.5-degree zone centre here.
  return geocode({latlng:lat+","+lon});
}

export async function normalizeStoryLocations(locations = [], limit = 4) {
  const rows=Array.isArray(locations)?locations:[];
  const selected=rows
    .filter(item=>clean(item?.label || "",120))
    .slice(0,Math.max(0,Math.min(6,Number(limit)||4)));

  const out=[];
  for(const item of selected){
    const result=await normalizeBroadPlace(item.label);
    if(!result.place) continue;
    out.push({
      requestedLabel:clean(item.label,120),
      context:clean(item.context || "",180),
      confidence:["strongly supported","supported","possible"].includes(item.confidence)?item.confidence:"possible",
      evidenceIds:Array.isArray(item.evidenceIds)?item.evidenceIds.slice(0,6):[],
      ...result.place
    });
  }
  return out;
}

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-6-luna";

const clean = (value, max = 320) =>
  String(value ?? "").trim().replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").slice(0, max);

function normalizeOpenAIKey(value = "") {
  let candidate = String(value || "").trim();
  if (!candidate) return "";
  const assignment = candidate.match(/^OPENAI_API_KEY\s*=\s*(.+)$/i);
  if (assignment) candidate = assignment[1].trim();
  const quoted = (candidate.startsWith('"') && candidate.endsWith('"')) ||
    (candidate.startsWith("'") && candidate.endsWith("'"));
  if (quoted && candidate.length >= 2) candidate = candidate.slice(1, -1).trim();
  return candidate.replace(/^Bearer\s+/i, "").trim();
}

export function openAIConfigured() {
  return !!normalizeOpenAIKey(process.env.OPENAI_API_KEY || "");
}

export function openAIModel() {
  return clean(process.env.OPENAI_MODEL || DEFAULT_MODEL, 80) || DEFAULT_MODEL;
}

function sourceRows(sources = []) {
  return (Array.isArray(sources) ? sources : [])
    .filter(source => source && (source.title || source.snippet))
    .slice(0, 40)
    .map((source, index) => ({
      id:"S" + (index + 1),
      platform:clean(source.platform || source.domain || "Public web", 60),
      domain:clean(source.domain || "", 90),
      confidence:source.confidence === "strong" ? "strong" : "possible",
      published:clean(source.published || source.pageAge || source.date || "", 50),
      title:clean(source.title || "", 180),
      excerpt:clean(source.snippet || source.text || source.description || "", 260)
    }));
}

function deterministicFallback(subject, rows, recurringThemes = []) {
  const platforms=[...new Set(rows.map(s=>s.platform).filter(Boolean))];
  const strong=rows.filter(s=>s.confidence==="strong").length;
  const themeLabels=(Array.isArray(recurringThemes)?recurringThemes:[])
    .map(item=>clean(typeof item==="string"?item:item?.term,60))
    .filter(Boolean)
    .slice(0,5);
  const headline=rows.length
    ? "Public fragments begin to form a connected picture"
    : "Not enough public evidence to build a reliable story";
  const overview=rows.length
    ? `${subject || "The subject"} has public results across ${platforms.length || 1} source type${platforms.length===1?"":"s"}. The strongest lesson is not any single post, but how repeated public fragments can combine into a broader picture of activities, places and relationships.`
    : "The search did not return enough sourced material for a reliable synthesis.";
  const storyPoints=[];
  if(platforms.length) storyPoints.push({
    title:"Cross-platform footprint",
    summary:`Matching public material appeared across ${platforms.slice(0,4).join(", ")}${platforms.length>4?" and other sources":""}.`,
    confidence:strong>1?"supported":"possible",
    evidenceIds:rows.slice(0,Math.min(4,rows.length)).map(s=>s.id)
  });
  if(themeLabels.length) storyPoints.push({
    title:"Recurring themes",
    summary:`Repeated non-sensitive terms included ${themeLabels.join(", ")}.`,
    confidence:"possible",
    evidenceIds:rows.slice(0,Math.min(3,rows.length)).map(s=>s.id)
  });
  return {
    aiUsed:false,
    model:null,
    mode:"deterministic",
    headline,
    overview,
    storyPoints,
    timeline:[],
    themes:themeLabels.map(label=>({
      label,
      summary:"Recurring term in the supplied public-search material.",
      confidence:"possible",
      evidenceIds:[]
    })),
    connections:[],
    caveat:"This synthesis is limited to the supplied public/indexed excerpts. It does not establish identity or prove an inference."
  };
}

function extractOutputText(data) {
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
}

const storySchema = {
  type:"object",
  additionalProperties:false,
  required:["headline","overview","storyPoints","timeline","themes","connections","caveat"],
  properties:{
    headline:{type:"string"},
    overview:{type:"string"},
    storyPoints:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        required:["title","summary","confidence","evidenceIds"],
        properties:{
          title:{type:"string"},
          summary:{type:"string"},
          confidence:{type:"string",enum:["strongly supported","supported","possible"]},
          evidenceIds:{type:"array",items:{type:"string"}}
        }
      }
    },
    timeline:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        required:["period","summary","confidence","evidenceIds"],
        properties:{
          period:{type:"string"},
          summary:{type:"string"},
          confidence:{type:"string",enum:["strongly supported","supported","possible"]},
          evidenceIds:{type:"array",items:{type:"string"}}
        }
      }
    },
    themes:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        required:["label","summary","confidence","evidenceIds"],
        properties:{
          label:{type:"string"},
          summary:{type:"string"},
          confidence:{type:"string",enum:["strongly supported","supported","possible"]},
          evidenceIds:{type:"array",items:{type:"string"}}
        }
      }
    },
    connections:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        required:["label","summary","confidence","evidenceIds"],
        properties:{
          label:{type:"string"},
          summary:{type:"string"},
          confidence:{type:"string",enum:["strongly supported","supported","possible"]},
          evidenceIds:{type:"array",items:{type:"string"}}
        }
      }
    },
    caveat:{type:"string"}
  }
};

export async function synthesizePublicProfile({subject="", city="", sources=[], recurringThemes=[]} = {}) {
  const rows=sourceRows(sources);
  const fallback=deterministicFallback(clean(subject,120),rows,recurringThemes);
  const apiKey=normalizeOpenAIKey(process.env.OPENAI_API_KEY || "");
  if (!apiKey || rows.length < 2) {
    return {...fallback, mode:apiKey ? "insufficient-evidence" : "openai-unconfigured"};
  }

  const model=openAIModel();
  const instructions=`You are the synthesis layer for a consent-based digital-footprint privacy-awareness application.
You receive only masked public-search excerpts already gathered by the application. Do not browse and do not invent missing facts.
Turn many ordinary fragments into a concise, human-readable story rather than an inventory of links.

Hard rules:
- Every factual statement or inference must be supported by one or more supplied evidence IDs.
- Distinguish strongly supported, supported and possible conclusions.
- If evidence is ambiguous, say so plainly.
- Do not infer sensitive traits such as health, religion, ethnicity, sexuality, political beliefs, finances, criminality or immigration status.
- Do not expose exact home addresses, exact cottage/property addresses, precise routines or precise geolocation.
- City or broad regional location is acceptable when supported. For example, "appears to have a cottage in the Halifax area" is acceptable only if multiple supplied excerpts support both the cottage and Halifax connection.
- Do not name or profile minors or non-consenting third parties. You may say high-level phrases such as "a child", "children", "spouse" or "family member" only when public material makes that relationship relevant to the privacy lesson. Do not provide their school, employer, address or schedule.
- Timeline entries may use only dates or broad periods present in the supplied evidence. Never invent a date.
- Keep the overview to 2 or 3 sentences.
- Return at most 5 story points, 5 timeline items, 6 themes and 5 connections.
- Focus on the combined picture: family context, work/professional context, travel, recreation, community involvement, broad locations, recurring activities and life milestones when those are actually supported.
- This is a privacy-awareness summary, not an identity-verification or surveillance report.`;

  const payload={
    subject:clean(subject,120),
    enteredCity:clean(city,100),
    recurringTerms:(Array.isArray(recurringThemes)?recurringThemes:[])
      .map(item=>clean(typeof item==="string"?item:item?.term,60))
      .filter(Boolean)
      .slice(0,12),
    evidence:rows
  };

  try {
    const response=await fetch(OPENAI_ENDPOINT,{
      method:"POST",
      headers:{
        "authorization":"Bearer " + apiKey,
        "content-type":"application/json"
      },
      body:JSON.stringify({
        model,
        store:false,
        instructions,
        input:JSON.stringify(payload),
        max_output_tokens:1800,
        text:{
          format:{
            type:"json_schema",
            name:"public_footprint_story",
            strict:true,
            schema:storySchema
          }
        }
      }),
      signal:AbortSignal.timeout(25000)
    });

    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const detail=data?.error?.message || data?.error?.code || ("OpenAI returned HTTP " + response.status);
      throw new Error(detail);
    }

    const outputText=extractOutputText(data);
    if(!outputText) throw new Error("OpenAI response did not include output text");
    const parsed=JSON.parse(outputText);

    return {
      aiUsed:true,
      model:data.model || model,
      mode:"openai",
      headline:clean(parsed.headline,160),
      overview:clean(parsed.overview,700),
      storyPoints:(parsed.storyPoints||[]).slice(0,5),
      timeline:(parsed.timeline||[]).slice(0,5),
      themes:(parsed.themes||[]).slice(0,6),
      connections:(parsed.connections||[]).slice(0,5),
      caveat:clean(parsed.caveat,320)
    };
  } catch (error) {
    console.error("profile intelligence synthesis failed",error);
    return {...fallback, mode:"openai-fallback", error:"AI synthesis unavailable for this request"};
  }
}

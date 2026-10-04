import { cleanText, expired, getSession, jsonResponse, safeEqual } from "./photo-session-lib.mjs";

const OPENAI_SPEECH_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const MODEL = "gpt-4o-mini-tts";
const VOICE = "marin";
const LINES = [
  "Hello there. I enjoy travelling and discovering new places.",
  "Today is a great day to learn something new.",
  "I like good food, live sports, and spending time with friends."
];

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

function naturalDeliveryInstructions(rate = 1) {
  const pace = rate < 0.93
    ? "slightly slower than average"
    : rate > 1.07
      ? "slightly faster than average"
      : "at a relaxed, normal pace";

  return [
    "Speak in natural conversational North American English.",
    "Sound warm, relaxed and human, as if casually speaking to one person nearby.",
    "Use subtle pauses, varied intonation and natural sentence rhythm.",
    "Avoid an announcer voice, exaggerated enthusiasm, robotic timing, or overly crisp synthetic emphasis.",
    "Speak " + pace + ".",
    "Do not imitate or reproduce any specific person's voice."
  ].join(" ");
}

export default async (req) => {
  if (req.method !== "POST") return jsonResponse({error:"Method not allowed"},405);

  try {
    const body = await req.json();
    const id = cleanText(body.id,80);
    const presenterToken = cleanText(body.presenterToken,120);
    const index = Number(body.index);

    if (!Number.isInteger(index) || index < 0 || index >= LINES.length) {
      return jsonResponse({error:"Invalid generated voice sample"},400);
    }

    const record = await getSession(id);
    if (!record) return jsonResponse({error:"Session not found"},404);
    if (expired(record)) return jsonResponse({error:"Session expired"},410);
    if (!safeEqual(presenterToken,record.presenterTokenHash)) {
      return jsonResponse({error:"Invalid presenter token"},403);
    }
    if (!record.consent || record.status !== "submitted") {
      return jsonResponse({error:"The volunteer submission is not ready"},409);
    }

    const apiKey = normalizeOpenAIKey(process.env.OPENAI_API_KEY || "");
    if (!apiKey) return jsonResponse({error:"Natural AI voice is not configured"},503);

    const speakingRate = Math.min(1.20,Math.max(0.80,Number(record.submission?.voiceDelivery?.speakingRateFactor)||1));
    const response = await fetch(OPENAI_SPEECH_ENDPOINT,{
      method:"POST",
      headers:{
        "authorization":"Bearer " + apiKey,
        "content-type":"application/json"
      },
      body:JSON.stringify({
        model:MODEL,
        voice:VOICE,
        input:LINES[index],
        instructions:naturalDeliveryInstructions(speakingRate),
        response_format:"mp3"
      }),
      signal:AbortSignal.timeout(25000)
    });

    if (!response.ok) {
      const detail = await response.text().catch(()=>"");
      console.error("OpenAI speech failed",response.status,detail.slice(0,400));
      return jsonResponse({error:"Natural AI voice generation failed"},502);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) return jsonResponse({error:"Natural AI voice returned no audio"},502);

    return new Response(bytes,{
      status:200,
      headers:{
        "content-type":"audio/mpeg",
        "content-length":String(bytes.length),
        "cache-control":"no-store, max-age=0",
        "pragma":"no-cache",
        "content-disposition":"inline"
      }
    });
  } catch (error) {
    console.error("photo-generated-voice failed",error);
    return jsonResponse({error:"Could not generate the natural AI voice sample.",detail:error?.message || "Unknown error"},500);
  }
};

export const config = {
  rateLimit:{
    action:"rate_limit",
    aggregateBy:["ip","domain"],
    windowSize:60,
    windowLimit:12
  }
};

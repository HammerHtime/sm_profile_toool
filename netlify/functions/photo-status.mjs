import { cleanText, deleteSession, expired, getSession, json, safeEqual } from './photo-session-lib.mjs';
export async function handler(event){
  if(event.httpMethod!=='GET') return json(405,{error:'Method not allowed'});
  const id=cleanText(event.queryStringParameters?.id,80), presenterToken=cleanText(event.queryStringParameters?.token,120);
  const record=await getSession(id);
  if(!record) return json(404,{error:'Session not found'});
  if(expired(record)){await deleteSession(id);return json(410,{error:'Session expired'})}
  if(!safeEqual(presenterToken,record.presenterTokenHash)) return json(403,{error:'Invalid presenter token'});
  return json(200,{id:record.id,status:record.status,expiresAt:record.expiresAt,consent:record.consent,submittedAt:record.submittedAt||null,participant:record.submission?{firstName:record.submission.firstName,city:record.submission.city,usernameMasked:record.submission.usernameMasked}:null,image:record.submission?.image||null,findings:record.findings||null});
}

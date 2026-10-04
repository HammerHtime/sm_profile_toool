import { cleanText, deleteSession, expired, getSession, json, putSession, safeEqual } from './photo-session-lib.mjs';
export async function handler(event){
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  let body={};try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
  const id=cleanText(body.id,80), joinToken=cleanText(body.joinToken,120);
  const record=await getSession(id);
  if(!record) return json(404,{error:'Session not found'});
  if(expired(record)){await deleteSession(id);return json(410,{error:'Session expired'})}
  if(!safeEqual(joinToken,record.joinTokenHash)) return json(403,{error:'Invalid session link'});
  if(record.status==='waiting'){record.status='joined';record.joinedAt=new Date().toISOString();await putSession(record);}
  return json(200,{ok:true,status:record.status,expiresAt:record.expiresAt});
}

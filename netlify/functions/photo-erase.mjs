import { cleanText, deleteSession, getSession, json, safeEqual } from './photo-session-lib.mjs';
export async function handler(event){
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  let body={};try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
  const id=cleanText(body.id,80), presenterToken=cleanText(body.presenterToken,120);
  const record=await getSession(id);
  if(!record) return json(200,{ok:true,deleted:true});
  if(!safeEqual(presenterToken,record.presenterTokenHash)) return json(403,{error:'Invalid presenter token'});
  await deleteSession(id);
  return json(200,{ok:true,deleted:true});
}

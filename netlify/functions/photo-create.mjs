import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { expiresIso, hash, json, nowIso, putSession, token } from './photo-session-lib.mjs';

export async function handler(event){
  if(event.httpMethod !== 'POST') return json(405,{error:'Method not allowed'});
  const id=randomUUID().replaceAll('-','');
  const joinToken=token();
  const presenterToken=token();
  const record={id,status:'waiting',createdAt:nowIso(),expiresAt:expiresIso(),joinTokenHash:hash(joinToken),presenterTokenHash:hash(presenterToken),consent:false,submission:null,findings:null};
  await putSession(record);
  let origin=event.headers?.origin || '';
  if(!origin && event.rawUrl){try{origin=new URL(event.rawUrl).origin}catch{}}
  if(!origin){const proto=event.headers?.['x-forwarded-proto']||'https';const host=event.headers?.host||event.headers?.['x-forwarded-host'];if(host)origin=proto+'://'+host;}
  if(!origin) return json(500,{error:'Could not determine site URL'});
  const joinUrl=new URL('/volunteer.html',origin);
  joinUrl.searchParams.set('session',id);
  joinUrl.searchParams.set('token',joinToken);
  const qrDataUrl=await QRCode.toDataURL(joinUrl.toString(),{width:720,margin:2,errorCorrectionLevel:'M'});
  return json(200,{id,joinToken,presenterToken,expiresAt:record.expiresAt,joinUrl:joinUrl.toString(),qrDataUrl});
}

import exifr from 'exifr';
import { cleanText, deleteSession, expired, getSession, json, putSession, safeEqual } from './photo-session-lib.mjs';

const MAX_BYTES=4*1024*1024;
const allowed=new Set(['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']);
function maskHandle(v=''){
  const s=cleanText(v,80);if(!s)return '';
  const prefix=s.startsWith('@')?'@':'';const body=prefix?s.slice(1):s;
  if(body.length<=3)return prefix+body[0]+'•'.repeat(Math.max(1,body.length-2))+body.slice(-1);
  const left=Math.max(1,Math.ceil(body.length*.25)),right=Math.max(1,Math.ceil(body.length*.2));
  return prefix+body.slice(0,left)+'•'.repeat(Math.max(3,body.length-left-right))+body.slice(-right);
}
function coarseZone(lat,lon){
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  return {lat:Math.round(lat*2)/2,lon:Math.round(lon*2)/2,radiusKm:50,count:1};
}
function cameraLabel(exif={}){
  const make=cleanText(exif.Make||'',35),model=cleanText(exif.Model||'',50);
  return [make,model].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
}
export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  let body={};try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
  const id=cleanText(body.id,80),joinToken=cleanText(body.joinToken,120),record=await getSession(id);
  if(!record)return json(404,{error:'Session not found'});
  if(expired(record)){await deleteSession(id);return json(410,{error:'Session expired'})}
  if(!safeEqual(joinToken,record.joinTokenHash))return json(403,{error:'Invalid session link'});
  if(body.consent!==true)return json(400,{error:'Consent is required'});
  const firstName=cleanText(body.firstName,40),city=cleanText(body.city,80),username=cleanText(body.username,80),mime=cleanText(body.mime,40).toLowerCase();
  if(!firstName)return json(400,{error:'First name is required'});
  if(!allowed.has(mime))return json(400,{error:'Unsupported image type'});
  if(typeof body.imageData!=='string'||!body.imageData)return json(400,{error:'A photo is required'});
  let bytes;try{bytes=Buffer.from(body.imageData,'base64')}catch{return json(400,{error:'Could not read photo'})}
  if(!bytes.length||bytes.length>MAX_BYTES)return json(413,{error:'Photo must be 4 MB or smaller'});
  let exif={};try{exif=await exifr.parse(bytes,{gps:true,tiff:true,exif:true,ifd0:true,xmp:false,iptc:false})||{}}catch{}
  const lat=Number(exif.latitude),lon=Number(exif.longitude),zone=coarseZone(lat,lon);
  const captured=exif.DateTimeOriginal instanceof Date?exif.DateTimeOriginal:null,camera=cameraLabel(exif);
  const width=Number(body.width)||Number(exif.ExifImageWidth)||Number(exif.ImageWidth)||0;
  const height=Number(body.height)||Number(exif.ExifImageHeight)||Number(exif.ImageHeight)||0;
  record.status='submitted';record.consent=true;record.submittedAt=new Date().toISOString();
  record.submission={firstName,city,usernameMasked:maskHandle(username),image:{mime,bytes:bytes.length,width,height}};
  record.findings={gpsEmbedded:!!zone,locationZone:zone,captureDateEmbedded:!!captured,capturedAtYear:captured?captured.getUTCFullYear():null,cameraMetadataEmbedded:!!camera,cameraSummary:camera||''};
  await putSession(record);
  bytes=null;exif={};
  return json(200,{ok:true,status:'submitted'});
}
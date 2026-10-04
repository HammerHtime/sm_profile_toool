const arr=v=>Array.isArray(v)?v:[];
const clean=(v,max=120)=>typeof v==='string'?v.trim().replace(/[\u0000-\u001f]/g,'').slice(0,max):'';
const json=(statusCode,body)=>({statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0'},body:JSON.stringify(body)});
function maskEmail(v=''){const s=clean(typeof v==='object'?v.value:v,160);const at=s.indexOf('@');if(at<1)return 'email detected';const a=s.slice(0,at),d=s.slice(at+1);return a.slice(0,2)+'•••••@'+(d[0]||'•')+'•••.'+(d.split('.').pop()||'');}
function maskPhone(v=''){const s=clean(typeof v==='object'?v.value:v,80),digits=s.replace(/\D/g,'');if(digits.length<7)return 'phone detected';return digits.slice(0,3)+'-xxx-xx'+digits.slice(-2);}
function maskAddress(v=''){const s=clean(typeof v==='object'?v.value:v,180),m=s.match(/\b(\d{1,6}[A-Za-z]?)\b/);return m?m[1]+' xxxxx St':'address detected (masked)';}
function maskHandle(v=''){const s=clean(v,100);if(!s)return '';const pre=s.startsWith('@')?'@':'';const b=pre?s.slice(1):s;if(b.length<4)return pre+b[0]+'••'+b.slice(-1);const l=Math.max(2,Math.ceil(b.length*.25)),r=Math.max(1,Math.ceil(b.length*.2));return pre+b.slice(0,l)+'•'.repeat(Math.max(3,b.length-l-r))+b.slice(-r);}
export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{error:'POST required'});
  let input={};try{input=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid JSON'})}
  const f=input.findings||{},addresses=arr(f.addresses),education=arr(f.education),employment=arr(f.employment),social=arr(f.socialProfiles),contacts=arr(f.contacts),images=arr(f.images),content=arr(f.publicContent),locations=arr(f.locationSignals),timeline=arr(f.timeline);
  const emails=contacts.filter(x=>x?.type==='email'),phones=contacts.filter(x=>x?.type==='phone');
  const platforms=[...new Set(social.map(x=>x?.platform).filter(Boolean))];
  const years=timeline.map(x=>Number(x?.year)).filter(Number.isFinite),span=years.length>1?Math.max(...years)-Math.min(...years):0;
  const score=Math.min(100,addresses.length*7+education.length*4+employment.length*2+social.length*4+(emails.length+phones.length)*3+Math.ceil(images.length/40)*2+locations.length*2+Math.ceil(content.length/100)*2);
  const stats=[{n:platforms.length,k:'social platforms'},{n:images.length,k:'public images'},{n:content.length,k:'posts / comments'},{n:span||'—',k:'years of history'}];
  const findings=[];
  if(addresses.length)findings.push(['Previous addresses',addresses.length+' historical address references. Example: '+maskAddress(addresses[0])+'.','MASKED']);
  if(emails.length)findings.push(['Email exposure',emails.length+' public email references. Example: '+maskEmail(emails[0])+'.','MASKED']);
  if(phones.length)findings.push(['Phone exposure',phones.length+' public phone references. Example: '+maskPhone(phones[0])+'.','MASKED']);
  if(education.length)findings.push(['Education',education.length+' education records identified. Institution names hidden.','HIDDEN']);
  if(employment.length)findings.push(['Employment',employment.length+' employment or organizational associations identified.','SUMMARY']);
  if(social.length)findings.push(['Social accounts',social.length+' public account matches across '+platforms.length+' platforms.','MASKED']);
  if(images.length)findings.push(['Images',images.length+' publicly indexed images classified by what they reveal.','SUMMARY']);
  if(content.length)findings.push(['Public activity',content.length+' posts, comments, replies, shares or public mentions catalogued.','SUMMARY']);
  const accounts=social.slice(0,12).map(x=>[x.platform||'Public account',maskHandle(x.handle||x.username||x.value||'account')]);
  return json(200,{subject:input.subject?.displayName||'Consenting Participant',score,level:score>=75?'HIGH EXPOSURE':score>=45?'MODERATE':'LOW',stats,findings,accounts,sourceHits:null,imageBreakdown:[],activity:[],themes:[],signals:[]});
}
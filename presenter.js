const $ = (id) => document.getElementById(id);
let session=null,pollTimer=null,revealIndex=0,latestStatus=null;
const startView=$('startView'),sessionView=$('sessionView'),revealDeck=$('revealDeck');

async function request(path,options={}){
  const r=await fetch(path,{...options,headers:{'content-type':'application/json',...(options.headers||{})},cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||('Request failed ('+r.status+')'));
  return data;
}
function setSessionUi(active){startView.classList.toggle('hidden',active);sessionView.classList.toggle('hidden',!active);}
function updateExpiry(){
  if(!session?.expiresAt)return;
  const rem=Math.max(0,Date.parse(session.expiresAt)-Date.now()),m=Math.floor(rem/60000),s=Math.floor((rem%60000)/1000);
  $('expiryText').textContent=rem>0?'Session expires in '+m+':'+String(s).padStart(2,'0'):'Session expired';
}
setInterval(updateExpiry,1000);

async function createSession(){
  $('startSession').disabled=true;
  try{
    const data=await request('/.netlify/functions/photo-create',{method:'POST',body:'{}'});
    session=data;
    sessionStorage.setItem('pfPhotoPresenter',JSON.stringify({id:data.id,presenterToken:data.presenterToken,expiresAt:data.expiresAt}));
    $('qrImage').src=data.qrDataUrl;
    $('joinCode').textContent='Session '+data.id.slice(0,6).toUpperCase();
    $('copyLink').dataset.url=data.joinUrl;
    setSessionUi(true);startPolling();
  }catch(e){alert(e.message)}
  finally{$('startSession').disabled=false;}
}

function setProgress(status){
  const steps=[...document.querySelectorAll('.statusStep')];steps.forEach(x=>x.classList.remove('active','done'));
  const orb=$('statusOrb');orb.className='statusOrb';
  if(status==='waiting'){
    steps[0]?.classList.add('active');orb.classList.add('waiting');$('liveTitle').textContent='Waiting for volunteer…';$('liveMessage').textContent='Ask a volunteer to scan the QR code with their phone.';
  }else if(status==='joined'){
    steps[0]?.classList.add('done');steps[1]?.classList.add('active');orb.classList.add('connected');$('liveTitle').textContent='Volunteer connected';$('liveMessage').textContent='Their phone is showing the consent and photo-upload screen.';
  }else if(status==='submitted'){
    steps.forEach(x=>x.classList.add('done'));orb.classList.add('ready');$('liveTitle').textContent='Privacy findings ready';$('liveMessage').textContent='Use your presentation clicker to reveal the results one screen at a time.';
  }
}
function formatBytes(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(1)+' MB';}
function findingCard(title,value,copy,tone=''){
  const d=document.createElement('article');d.className='photoFindingCard '+tone;
  d.innerHTML='<div class="provenanceMini verified">VERIFIED FROM PHOTO</div><div class="findingLabel">'+title+'</div><strong>'+value+'</strong><p>'+copy+'</p>';return d;
}
function mapUrl(z){
  const lat=Number(z.lat),lon=Number(z.lon),r=Number(z.radiusKm)||50,dlat=Math.max(r*1.25,60)/111.32,cos=Math.max(Math.cos(lat*Math.PI/180),.2),dlon=Math.max(r*1.25,60)/(111.32*cos);
  const bbox=[lon-dlon,lat-dlat,lon+dlon,lat+dlat].map(n=>n.toFixed(4)).join('%2C');
  return 'https://www.openstreetmap.org/export/embed.html?bbox='+bbox+'&layer=mapnik';
}
function addPhotoCore(stage,compact=false){
  const core=document.createElement('div');core.className='photoCore';if(compact)core.style.transform='translate(-50%,-50%) scale(.88)';
  core.innerHTML='<div class="photoCoreGlow"></div><div class="photoCardVisual"><div class="scanBeam"></div><div class="photoGlyph">▧</div><strong>ONE PHOTO</strong><small>consented upload</small></div>';stage.appendChild(core);
}
function addNode(stage,o){
  const n=document.createElement('div');n.className='crumbNode '+(o.tone||'')+(o.dashed?' next':'');n.style.left=o.x+'%';n.style.top=o.y+'%';
  n.innerHTML='<div class="crumbIcon">'+o.icon+'</div><strong>'+o.title+'</strong><span>'+o.detail+'</span>';stage.appendChild(n);
}
function metadataMap(data){
  const st=$('breadcrumbStageMetadata');if(!st)return;st.replaceChildren();addPhotoCore(st);
  const f=data.findings||{},img=data.image||{};
  [
    {title:'GPS metadata',detail:f.gpsEmbedded?'Embedded location signal found':'No embedded GPS found',icon:'◎',x:3,y:8,tone:f.gpsEmbedded?'risk':'safe'},
    {title:'Capture time',detail:f.captureDateEmbedded?('Original date metadata · '+(f.capturedAtYear||'year found')):'No original date detected',icon:'◷',x:76,y:8,tone:f.captureDateEmbedded?'warn':'safe'},
    {title:'Camera / device',detail:f.cameraMetadataEmbedded?(f.cameraSummary||'Device metadata present'):'No readable device metadata',icon:'▣',x:2,y:67,tone:f.cameraMetadataEmbedded?'warn':'safe'},
    {title:'File fingerprint',detail:(img.width||'?')+' × '+(img.height||'?')+' · '+formatBytes(img.bytes),icon:'#',x:77,y:67,tone:'safe'}
  ].forEach(o=>addNode(st,o));
}
function correlationMap(data){
  const st=$('breadcrumbStageCorrelation');if(!st)return;st.replaceChildren();addPhotoCore(st,true);
  const p=data.participant||{};
  [
    {title:'Embedded metadata',detail:'File-level privacy signals',icon:'◇',x:2,y:8,tone:'warn'},
    {title:'Visible text / logos',detail:'Can reveal events, teams or workplaces',icon:'T',x:77,y:8,tone:'warn'},
    {title:'Location clues',detail:data.findings?.gpsEmbedded?'GPS signal was present':'Background can still reveal context',icon:'⌖',x:2,y:67,tone:'risk'},
    {title:'Exact-image search',detail:'Can connect copies on public webpages',icon:'▧',x:77,y:67,dashed:true},
    {title:'Public profiles',detail:p.usernameMasked||'Shown only when verified',icon:'@',x:39,y:2,dashed:true},
    {title:'Masked contact clues',detail:'Displayed only from verified public pages',icon:'☎',x:39,y:77,dashed:true}
  ].forEach(o=>addNode(st,o));
  $('correlationDisclosure').innerHTML='<strong>Breadcrumb logic, not facial identification.</strong> Public correlations appear only when a real source match is returned.';
}
function impact(data){
  const f=data.findings||{},embedded=[f.gpsEmbedded,f.captureDateEmbedded,f.cameraMetadataEmbedded].filter(Boolean).length;
  const vals=[[embedded,'embedded signals'],[f.gpsEmbedded?'50 km':'—','location privacy zone'],[data.image?.bytes?1:0,'image analyzed'],[data.participant?.usernameMasked?1:0,'supplied public handle']];
  $('impactStats').innerHTML=vals.map(v=>'<div class="impactStat"><strong>'+v[0]+'</strong><span>'+v[1]+'</span></div>').join('');
}
function renderSubmitted(data){
  latestStatus=data;$('participantName').textContent=data.participant?.firstName||'Volunteer';
  const grid=$('photoFindingCards');grid.replaceChildren();const img=data.image||{},f=data.findings||{};
  metadataMap(data);correlationMap(data);impact(data);
  grid.append(
    findingCard('Embedded GPS',f.gpsEmbedded?'FOUND':'NOT FOUND',f.gpsEmbedded?'The original file contained GPS coordinates. They were reduced before display.':'No embedded GPS coordinates were detected.',f.gpsEmbedded?'risk':'safe'),
    findingCard('Capture date',f.captureDateEmbedded?('YEAR '+(f.capturedAtYear||'FOUND')):'NOT FOUND',f.captureDateEmbedded?'The file contained original capture-time metadata.':'No readable original capture date was detected.',f.captureDateEmbedded?'warn':'safe'),
    findingCard('Camera metadata',f.cameraMetadataEmbedded?'FOUND':'NOT FOUND',f.cameraMetadataEmbedded?('Reduced summary: '+(f.cameraSummary||'metadata present')):'No readable camera make/model metadata was detected.',f.cameraMetadataEmbedded?'warn':'safe'),
    findingCard('Image file',(img.width||'?')+' × '+(img.height||'?'),(img.mime||'image')+' • '+formatBytes(img.bytes)+'. The raw photo was not persisted.','safe')
  );
  const wrap=$('photoMapWrap');wrap.replaceChildren();
  if(f.locationZone){
    $('locationHeadline').textContent='The photo contained a location signal.';
    $('locationCopy').textContent='The exact GPS coordinate is never returned to the presentation. It is reduced to a broad 50 km privacy zone.';
    const v=document.createElement('div');v.className='mapViewport bigPhotoMap';
    const frame=document.createElement('iframe');frame.src=mapUrl(f.locationZone);frame.loading='lazy';frame.referrerPolicy='no-referrer';frame.title='Approximate privacy zone';
    const c=document.createElement('div');c.className='privacyCircle';v.append(frame,c);wrap.appendChild(v);
  }else{
    $('locationHeadline').textContent='No embedded GPS location was detected.';
    $('locationCopy').textContent='That does not mean the image has no location clues. Signs, landmarks, events, uniforms and background details can still expose context.';
    wrap.innerHTML='<div class="noLocationGraphic"><span>◎</span><strong>NO GPS METADATA</strong><small>Exact location remains hidden</small></div>';
  }
  revealIndex=0;revealDeck.classList.remove('hidden');showReveal(0);
}
function showReveal(i){
  const slides=[...document.querySelectorAll('.revealSlide')];if(!slides.length)return;revealIndex=Math.max(0,Math.min(i,slides.length-1));
  slides.forEach((s,n)=>s.classList.toggle('hidden',n!==revealIndex));
  if(latestStatus&&revealIndex===2)metadataMap(latestStatus);if(latestStatus&&revealIndex===5)correlationMap(latestStatus);
}
async function poll(){
  if(!session)return;
  try{
    const d=await request('/.netlify/functions/photo-status?id='+encodeURIComponent(session.id)+'&token='+encodeURIComponent(session.presenterToken));
    setProgress(d.status);
    if(d.status==='submitted'&&latestStatus?.submittedAt!==d.submittedAt)renderSubmitted(d);
  }catch(e){if(/expired|not found/i.test(e.message)){clearInterval(pollTimer);$('liveTitle').textContent='Session expired';$('liveMessage').textContent='Create a new QR code for another volunteer.';}}
}
function startPolling(){clearInterval(pollTimer);poll();pollTimer=setInterval(poll,1500);}
async function erase(){
  if(!session)return;$('erasePhotoDemo').disabled=true;
  try{
    await request('/.netlify/functions/photo-erase',{method:'POST',body:JSON.stringify({id:session.id,presenterToken:session.presenterToken})});
    clearInterval(pollTimer);sessionStorage.removeItem('pfPhotoPresenter');session=null;latestStatus=null;revealDeck.classList.add('hidden');$('qrImage').removeAttribute('src');
    $('erasePhotoNotice').classList.remove('hidden');$('liveTitle').textContent='Demo data erased';$('liveMessage').textContent='The temporary session record has been deleted. The raw photo was never persisted.';$('erasePhotoDemo').textContent='Deleted ✓';
  }catch(e){alert(e.message);$('erasePhotoDemo').disabled=false;}
}
$('startSession').addEventListener('click',createSession);
$('copyLink').addEventListener('click',async()=>{const u=$('copyLink').dataset.url;if(!u)return;await navigator.clipboard.writeText(u);$('copyLink').textContent='Copied ✓';setTimeout(()=>$('copyLink').textContent='Copy volunteer link',1200);});
$('erasePhotoDemo').addEventListener('click',erase);
document.addEventListener('keydown',(e)=>{if(revealDeck.classList.contains('hidden'))return;if(['ArrowRight','PageDown',' ','Enter'].includes(e.key)){e.preventDefault();showReveal(revealIndex+1)}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();showReveal(revealIndex-1)}});

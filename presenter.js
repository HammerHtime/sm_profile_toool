const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
})[ch]);
let session=null,pollTimer=null,revealIndex=0,latestStatus=null,searchRunning=false,searchComplete=false;
let activeVoiceAudio=null,activeVoiceAudioUrl='',activeVoiceButton=null;
const preloadedVoiceSamples=new Map();
const startView=$('startView'),sessionView=$('sessionView'),revealDeck=$('revealDeck');
const photoRevealNames=['Consent','One photo','Metadata','Photo exposure','Location','Digital breadcrumbs','Impact & voice'];

async function request(path,options={}){
  const r=await fetch(path,{...options,headers:{'content-type':'application/json',...(options.headers||{})},cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    if(r.status===429) throw new Error('Too many QR sessions were created in a short period. Wait about one minute, then try again.');
    throw new Error((data.error||('Request failed ('+r.status+')')) + (data.detail ? ' — ' + data.detail : ''));
  }
  return data;
}
function setSessionUi(active){startView.classList.toggle('hidden',active);sessionView.classList.toggle('hidden',!active);}
function updateExpiry(){
  if(!session?.expiresAt)return;
  const rem=Math.max(0,Date.parse(session.expiresAt)-Date.now()),m=Math.floor(rem/60000),s=Math.floor((rem%60000)/1000);
  $('expiryText').textContent=rem>0?'Session expires in '+m+':'+String(s).padStart(2,'0'):'Session expired';
}
setInterval(updateExpiry,1000);

async function checkPresenterHealth(){
  const health=$('presenterHealth');
  const button=$('startSession');
  if(!health||!button)return;

  try{
    const r=await fetch('/.netlify/functions/health',{cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.blobs?.ok)throw new Error(data.blobs?.error||'Session storage is not ready');

    health.className='presenterHealth ready';
    health.innerHTML='<span></span><strong>QR session system ready</strong><small>' +
      (data.liveSearchConfigured
        ? 'Public-handle correlation is also configured.'
        : 'Photo metadata works. Public-handle correlation needs the live-search API key.') +
      '</small>';
    button.disabled=false;
  }catch(err){
    health.className='presenterHealth failed';
    health.innerHTML='<span></span><strong>QR system not ready</strong><small>'+escapeHtml(err.message||'Health check failed')+'</small>';
    button.disabled=true;
  }
}


async function restorePresenterSession(){
  const raw=sessionStorage.getItem('pfPhotoPresenter');
  if(!raw)return;

  let saved;
  try{saved=JSON.parse(raw)}catch{
    resetVoicePlaybackUi();
    clearPreloadedVoiceSamples();
    sessionStorage.removeItem('pfPhotoPresenter');
    return;
  }

  if(!saved?.id||!saved?.presenterToken||!saved?.expiresAt||Date.parse(saved.expiresAt)<=Date.now()){
    sessionStorage.removeItem('pfPhotoPresenter');
    return;
  }

  session=saved;
  if(saved.qrDataUrl)$('qrImage').src=saved.qrDataUrl;
  if(saved.joinUrl)$('copyLink').dataset.url=saved.joinUrl;
  $('joinCode').textContent='Session '+saved.id.slice(0,6).toUpperCase();
  setSessionUi(true);
  startPolling();
}

async function createSession(){
  $('startSession').disabled=true;
  try{
    const data=await request('/api/photo-create',{method:'POST',body:'{}'});
    session=data;
    sessionStorage.setItem('pfPhotoPresenter',JSON.stringify({
      id:data.id,
      presenterToken:data.presenterToken,
      expiresAt:data.expiresAt,
      joinUrl:data.joinUrl,
      qrDataUrl:data.qrDataUrl
    }));
    $('qrImage').src=data.qrDataUrl;
    $('joinCode').textContent='Session '+data.id.slice(0,6).toUpperCase();
    $('copyLink').dataset.url=data.joinUrl;
    setSessionUi(true);startPolling();
  }catch(e){
    alert(e.message);
    await checkPresenterHealth();
  } finally {
    if (!$('presenterHealth')?.classList.contains('failed')) $('startSession').disabled=false;
  }
}

function setProgress(status){
  const steps=[...document.querySelectorAll('.statusStep')];steps.forEach(x=>x.classList.remove('active','done'));
  const orb=$('statusOrb');orb.className='statusOrb';
  if(status==='waiting'){
    steps[0]?.classList.add('active');orb.classList.add('waiting');$('liveTitle').textContent='Waiting for volunteer…';$('liveMessage').textContent='Ask a volunteer to scan the QR code with their phone.';
  }else if(status==='joined'){
    steps[0]?.classList.add('done');steps[1]?.classList.add('active');orb.classList.add('connected');$('liveTitle').textContent='Volunteer connected';$('liveMessage').textContent='Their phone is showing the consent and photo-upload screen.';
  }else if(status==='submitted'){
    steps.forEach(x=>x.classList.add('done'));orb.classList.add('ready');$('liveTitle').textContent='Photo received — analysis starting';$('liveMessage').textContent='No click needed. The search visualization will run automatically.';
  }
}
function formatBytes(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(1)+' MB';}
function findingCard(title,value,copy,tone=''){
  const d=document.createElement('article');d.className='photoFindingCard '+tone;
  d.innerHTML='<div class="provenanceMini verified">VERIFIED FROM PHOTO</div><div class="findingLabel">'+escapeHtml(title)+'</div><strong>'+escapeHtml(value)+'</strong><p>'+escapeHtml(copy)+'</p>';return d;
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
  n.innerHTML='<div class="crumbIcon">'+escapeHtml(o.icon)+'</div><strong>'+escapeHtml(o.title)+'</strong><span>'+escapeHtml(o.detail)+'</span>';stage.appendChild(n);
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
  const c=data.correlation||{};
  const w=data.webDetection||{};
  const publicNodes=normalizePublicNodes(data);
  const positions=[
    {x:3,y:7},{x:78,y:7},{x:3,y:58},{x:78,y:58},{x:40,y:1},{x:40,y:64}
  ];

  const nodes=[
    {title:'Embedded metadata',detail:'File-level privacy signals',icon:'◇',tone:'warn'},
    {title:'Location clues',detail:data.findings?.gpsEmbedded?(data.locationContext?.broadPlace?.label||'GPS signal was present'):'No embedded GPS detected',icon:'⌖',tone:data.findings?.gpsEmbedded?'risk':'safe'}
  ];

  const exactSignals=(Number(w.fullMatches)||0)+(Number(w.partialMatches)||0);
  if(w.attempted){
    nodes.push({
      title:'Reverse-image web match',
      detail:exactSignals
        ? (exactSignals+' full/partial image signal'+(exactSignals===1?'':'s')+' across '+(Number(w.matchingPages)||0)+' matching page'+(Number(w.matchingPages)===1?'':'s'))
        : ((Number(w.matchingPages)||0)+' matching web page'+(Number(w.matchingPages)===1?'':'s')+' returned'),
      icon:'▧',
      tone:exactSignals?'warn':'safe'
    });
  }

  if(publicNodes.length){
    publicNodes.slice(0,4).forEach(n=>{
      nodes.push({
        title:n.name,
        detail:n.count+' verified public match'+(n.count===1?'':'es')+' from the supplied identity clues',
        icon:n.icon,
        tone:'safe'
      });
    });
  }else{
    nodes.push(
      {title:'Exact-image search',detail:'Capability only — no provider match returned',icon:'▧',dashed:true},
      {title:'Public profiles',detail:p.usernameMasked?'Supplied handle: '+p.usernameMasked:'No public handle supplied',icon:'@',dashed:true},
      {title:'Public web',detail:'No verified public correlation returned',icon:'⌘',dashed:true},
      {title:'Other platforms',detail:'Only appears when a real source match is returned',icon:'●',dashed:true}
    );
  }

  nodes.slice(0,6).forEach((o,i)=>addNode(st,{...o,...positions[i]}));

  const domains=(c.sourceDomains||[]).slice(0,3);
  const visionDomains=(w.pageMatches||[]).map(page=>page.domain).filter(Boolean).slice(0,2);
  const sourceCopy=domains.length?' Source examples: '+domains.join(', ')+'.':'';
  const visionCopy=visionDomains.length?' Image-match examples: '+visionDomains.join(', ')+'.':'';
  $('correlationDisclosure').innerHTML=
    '<strong>Breadcrumb logic, not facial identification.</strong>'+
    '<span>'+escapeHtml(c.basis||'Public correlations appear only when a real source match is returned.')+
    escapeHtml(sourceCopy)+escapeHtml(visionCopy)+'</span>';
}
function impact(data){
  const f=data.findings||{},embedded=[f.gpsEmbedded,f.captureDateEmbedded,f.cameraMetadataEmbedded].filter(Boolean).length;
  const publicMatches=Number(data.correlation?.totalMatches)||0;
  const reversePages=Number(data.webDetection?.matchingPages)||0;
  const vals=[[embedded,'embedded signals'],[f.gpsEmbedded?'50 km':'—','location privacy zone'],[publicMatches,'verified public matches'],[reversePages,'reverse-image matching pages']];
  $('impactStats').innerHTML=vals.map(v=>'<div class="impactStat"><strong>'+escapeHtml(v[0])+'</strong><span>'+escapeHtml(v[1])+'</span></div>').join('');
}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
const MIN_PHOTO_SEARCH_MS=14000;

function countValue(value){
  if(typeof value==='number' && Number.isFinite(value)) return Math.max(0,Math.round(value));
  if(value && typeof value==='object'){
    for(const key of ['count','total','matches','items','results']){
      const n=Number(value[key]);
      if(Number.isFinite(n)) return Math.max(0,Math.round(n));
    }
  }
  return 0;
}

function platformIcon(name){
  const icons={
    'LinkedIn':'in','Instagram':'◎','Facebook':'f','TikTok':'♪','Reddit':'●',
    'YouTube':'▶','X / Twitter':'X','X':'X','Twitter':'X','Threads':'@',
    'GitHub':'{}','Strava':'▲','News':'▤','Web':'⌘','Public web':'⌘',
    'Location':'⌖','GPS':'⌖','Capture time':'◷','Camera / device':'▣','File':'#',
    'Exact image':'▧','Public images':'▧','Mentions':'@'
  };
  return icons[name]||'●';
}

function normalizePublicNodes(data){
  const c=data.correlation||data.publicCorrelation||{};
  const found=new Map();

  const add=(name,value,subtitle='verified public matches')=>{
    const count=countValue(value);
    if(count<=0)return;
    const key=name.toLowerCase();
    const prev=found.get(key);
    if(!prev || count>prev.count) found.set(key,{name,count,subtitle,icon:platformIcon(name),kind:'public'});
  };

  if(Array.isArray(c.platforms)){
    c.platforms.forEach(p=>add(p.name||p.platform,p,p.label||'verified public matches'));
  }else if(c.platforms && typeof c.platforms==='object'){
    Object.entries(c.platforms).forEach(([name,value])=>add(name,value));
  }

  const direct=[
    ['LinkedIn',c.linkedin],['Instagram',c.instagram],['Facebook',c.facebook],['TikTok',c.tiktok],
    ['Reddit',c.reddit],['YouTube',c.youtube],['X / Twitter',c.x||c.twitter],
    ['Threads',c.threads],['GitHub',c.github],['Strava',c.strava],
    ['Exact image',c.exactImageMatches||c.exactMatches],
    ['Public web',c.webPages||c.publicPages||c.pages],
    ['News',c.newsArticles||c.news],
    ['Public images',c.publicImages||c.images],
    ['Mentions',c.mentions]
  ];
  direct.forEach(([name,value])=>add(name,value));

  if(Array.isArray(c.accounts)){
    const grouped={};
    c.accounts.forEach(a=>{
      const name=a.platform||a.source||'Public web';
      grouped[name]=(grouped[name]||0)+1;
    });
    Object.entries(grouped).forEach(([name,value])=>add(name,value,'verified public accounts'));
  }

  return [...found.values()].slice(0,10);
}

function verifiedMetadataNodes(data){
  const f=data.findings||{},img=data.image||{},voiceSamples=Array.isArray(data.voiceSamples)?data.voiceSamples:[];
  const nodes=[];
  if(f.gpsEmbedded) nodes.push({name:'GPS',count:1,subtitle:'embedded location signal',icon:'⌖',kind:'metadata'});
  if(f.captureDateEmbedded) nodes.push({name:'Capture time',count:1,subtitle:f.capturedAtYear?('year '+f.capturedAtYear):'original date found',icon:'◷',kind:'metadata'});
  if(f.cameraMetadataEmbedded) nodes.push({name:'Camera / device',count:1,subtitle:f.cameraSummary||'device metadata',icon:'▣',kind:'metadata'});
  if(img.bytes) nodes.push({name:'File',count:1,subtitle:(img.width||'?')+' × '+(img.height||'?')+' · '+formatBytes(img.bytes),icon:'#',kind:'metadata'});
  if(voiceSamples.length) {
    const totalSeconds=Math.max(1,Math.round(voiceSamples.reduce((sum,s)=>sum+(Number(s.durationMs)||0),0)/1000));
    nodes.push({
      name:'Voice samples',
      count:voiceSamples.length,
      subtitle:totalSeconds+' sec of original volunteer audio',
      icon:'🎙',
      kind:'participant'
    });
  }
  return nodes;
}

function nodePosition(index,total){
  const angle=(-90 + (360/Math.max(total,1))*index) * Math.PI/180;
  const rx=36, ry=35;
  return {x:50+Math.cos(angle)*rx,y:50+Math.sin(angle)*ry};
}

function addSearchConnection(x,y,kind='metadata'){
  const svg=$('searchConnections');
  if(!svg)return;
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('x1','500');line.setAttribute('y1','310');
  line.setAttribute('x2',String(x*10));line.setAttribute('y2',String(y*6.2));
  line.classList.add('searchConnectionLine',kind==='public'?'public':kind==='participant'?'participant':'metadata');
  svg.appendChild(line);
}

function addSearchNode(node,index,total){
  const stage=$('searchNetwork');
  if(!stage)return;
  const pos=nodePosition(index,total);
  addSearchConnection(pos.x,pos.y,node.kind);

  const el=document.createElement('div');
  el.className='searchNode '+(node.kind==='public'?'publicNode':node.kind==='participant'?'participantNode':'metadataNode');
  el.style.left=pos.x+'%';
  el.style.top=pos.y+'%';
  el.innerHTML=
    '<div class="searchNodeIcon">'+escapeHtml(node.icon)+'</div>'+
    '<strong class="searchNodeCount">'+escapeHtml(node.count)+'</strong>'+
    '<span class="searchNodeName">'+escapeHtml(node.name)+'</span>'+
    '<small>'+escapeHtml(node.subtitle)+'</small>'+
    '<em>'+(node.kind==='participant'?'SUPPLIED':'VERIFIED')+'</em>';
  stage.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('visible'));
}

function setSearchProgress(value,label){
  const pct=Math.max(0,Math.min(100,Math.round(value)));
  $('searchProgressValue').textContent=pct+'%';
  $('searchProgressRing').style.setProperty('--progress',pct*3.6+'deg');
  $('searchProgressLabel').textContent=label||'Searching';
}

function setChecklist(index,labelOverride=''){
  const items=[...document.querySelectorAll('.searchCheck')];
  items.forEach((item,i)=>{
    item.classList.toggle('done',i<index);
    item.classList.toggle('active',i===index);
  });
  if(labelOverride && items[index]) items[index].querySelector('span').textContent=labelOverride;
}

function setPulse(text){
  $('searchPulseText').textContent=text;
  $('searchPulseText').classList.remove('pulseFlash');
  void $('searchPulseText').offsetWidth;
  $('searchPulseText').classList.add('pulseFlash');
}

function updateSearchMetrics(metaNodes,publicNodes){
  const locationSignals=metaNodes.some(n=>n.name==='GPS')?1:0;
  const verifiedMatches=publicNodes.reduce((sum,n)=>sum+n.count,0);
  $('metricSignals').textContent=metaNodes.length;
  $('metricPlatforms').textContent=publicNodes.length;
  $('metricLocations').textContent=locationSignals;
  $('metricMatches').textContent=verifiedMatches;
}

const photoAmbientPositions=[
  [4,8,-6],[76,5,5],[82,54,-3],[7,58,5],[59,69,-2],[26,5,3],[70,31,6],[16,33,-4]
];
const photoQuotePositions=[
  [5,22,-2],[66,18,2],[62,72,-1],[8,76,1],[36,8,-2],[35,72,2]
];

function clearPhotoAmbient(){
  ['photoAmbientPhotos','photoAmbientQuotes','photoAmbientWords'].forEach(id=>{
    const el=$(id); if(el)el.replaceChildren();
  });
}

function hydratePhotoAmbient(data){
  clearPhotoAmbient();
  const p=data?.correlation?.presentation||{};
  const photos=Array.isArray(p.photos)?p.photos.slice(0,8):[];
  const quotes=Array.isArray(p.quotes)?p.quotes.slice(0,6):[];
  const themes=Array.isArray(p.themes)?p.themes.slice(0,10):[];

  const photoRoot=$('photoAmbientPhotos');
  photos.forEach((photo,index)=>{
    if(!photo?.src||!photoRoot)return;
    const card=document.createElement('figure');
    card.className='photoAmbientCard';
    const [x,y,r]=photoAmbientPositions[index%photoAmbientPositions.length];
    card.style.setProperty('--x',x+'%');
    card.style.setProperty('--y',y+'%');
    card.style.setProperty('--r',r+'deg');
    card.style.setProperty('--delay',(index*.17)+'s');
    const img=document.createElement('img');
    img.src=photo.src;
    img.alt='';
    img.loading='eager';
    img.referrerPolicy='no-referrer';
    img.addEventListener('error',()=>card.remove(),{once:true});
    const cap=document.createElement('figcaption');
    cap.textContent=photo.platform||photo.domain||'Public image';
    card.append(img,cap);
    photoRoot.appendChild(card);
  });

  const quoteRoot=$('photoAmbientQuotes');
  quotes.forEach((quote,index)=>{
    if(!quote?.text||!quoteRoot)return;
    const card=document.createElement('div');
    card.className='photoAmbientQuote';
    const [x,y,r]=photoQuotePositions[index%photoQuotePositions.length];
    card.style.setProperty('--x',x+'%');
    card.style.setProperty('--y',y+'%');
    card.style.setProperty('--r',r+'deg');
    card.style.setProperty('--delay',(index*.2+.25)+'s');
    const strong=document.createElement('strong');
    strong.textContent=quote.platform||'Public source';
    const span=document.createElement('span');
    span.textContent='“'+quote.text+'”';
    card.append(strong,span);
    quoteRoot.appendChild(card);
  });

  const wordRoot=$('photoAmbientWords');
  themes.forEach((item,index)=>{
    if(!wordRoot)return;
    const term=typeof item==='string'?item:item.term;
    const count=typeof item==='object'?Number(item.count)||1:1;
    if(!term)return;
    const span=document.createElement('span');
    span.textContent=term;
    span.style.setProperty('--scale',String(Math.min(1.55,1+count*.1)));
    span.style.setProperty('--delay',(index*.1+.45)+'s');
    wordRoot.appendChild(span);
  });

  // Keep the search visually alive even when no public correlation is verified.
  // These are clearly presented as categories being checked, not as discovered evidence.
  if(!photos.length && photoRoot){
    [
      ['▧','IMAGE CONTEXT'],['◎','METADATA'],['⌖','LOCATION CLUES'],['@','PUBLIC WEB']
    ].forEach((item,index)=>{
      const card=document.createElement('figure');
      card.className='photoAmbientCard photoAmbientPlaceholder';
      const [x,y,r]=photoAmbientPositions[index%photoAmbientPositions.length];
      card.style.setProperty('--x',x+'%');
      card.style.setProperty('--y',y+'%');
      card.style.setProperty('--r',r+'deg');
      card.style.setProperty('--delay',(index*.18)+'s');
      card.innerHTML='<div class="ambientPlaceholderGlyph">'+item[0]+'</div><figcaption>CHECKING • '+item[1]+'</figcaption>';
      photoRoot.appendChild(card);
    });
  }

  if(!quotes.length && quoteRoot){
    [
      ['SEARCHING','Signs, logos, landmarks and event branding can create context.'],
      ['CHECKING','Public pages appear only when a supplied identity clue verifies them.'],
      ['VERIFYING','No result is promoted simply because a name looks similar.']
    ].forEach((item,index)=>{
      const card=document.createElement('div');
      card.className='photoAmbientQuote ambientHint';
      const [x,y,r]=photoQuotePositions[index%photoQuotePositions.length];
      card.style.setProperty('--x',x+'%');
      card.style.setProperty('--y',y+'%');
      card.style.setProperty('--r',r+'deg');
      card.style.setProperty('--delay',(index*.2+.25)+'s');
      card.innerHTML='<strong>'+item[0]+'</strong><span>'+item[1]+'</span>';
      quoteRoot.appendChild(card);
    });
  }

  if(!themes.length && wordRoot){
    ['metadata','capture time','device','GPS','visual context','signs','landmarks','logos','public profiles','source verification']
      .forEach((term,index)=>{
        const span=document.createElement('span');
        span.textContent=term;
        span.style.setProperty('--scale',String(1+(index%3)*.08));
        span.style.setProperty('--delay',(index*.08+.35)+'s');
        wordRoot.appendChild(span);
      });
  }
}

function setEraseSequenceStep(index,state){
  document.querySelectorAll('[data-erase-step]').forEach((step,i)=>{
    step.classList.toggle('active',i===index&&state==='active');
    step.classList.toggle('done',i<index||(i===index&&state==='done'));
    const em=step.querySelector('em');
    if(em){
      if(i<index||(i===index&&state==='done'))em.textContent='deleted';
      else if(i===index&&state==='active')em.textContent='deleting…';
      else em.textContent='waiting';
    }
  });
  const bar=$('eraseSequenceBar');
  if(bar){
    const value=state==='done'?((index+1)/4)*100:(index/4)*100+8;
    bar.style.width=Math.min(100,value)+'%';
  }
}

async function runEraseSequence(){
  const overlay=$('eraseSequenceOverlay');
  if(!overlay)return;
  overlay.classList.remove('hidden');
  $('eraseSequenceIcon').textContent='⌫';
  $('eraseSequenceTitle').textContent='Deleting temporary demo data…';
  $('eraseSequenceCopy').textContent='Please keep this screen open while the temporary session is cleared.';
  $('eraseSequenceBar').style.width='0%';
  document.querySelectorAll('[data-erase-step]').forEach(step=>{
    step.classList.remove('active','done');
    const em=step.querySelector('em'); if(em)em.textContent='waiting';
  });
  setEraseSequenceStep(0,'active');
  await sleep(220);
}

async function finishEraseSequence(){
  for(let i=0;i<4;i++){
    setEraseSequenceStep(i,'done');
    await sleep(i===3?250:180);
  }
  $('eraseSequenceIcon').textContent='✓';
  $('eraseSequenceTitle').textContent='ALL DEMO DATA DELETED';
  $('eraseSequenceCopy').textContent='Temporary session data, audio, search-state and presenter cache have been cleared.';
  $('eraseSequenceBar').style.width='100%';
  await sleep(1500);
  $('eraseSequenceOverlay').classList.add('hidden');
}

async function startAutoSearch(data){
  if(searchRunning)return;
  const searchStartedAt=Date.now();
  searchRunning=true;
  searchComplete=false;
  latestStatus=data;
  document.body.classList.add('photoPresentationMode');

  renderSubmitted(data);
  hydratePhotoAmbient(data);
  preloadVoiceSamples(data);

  const presenterGrid=document.querySelector('.presenterGrid');
  if(presenterGrid)presenterGrid.classList.add('hidden');
  $('liveSearchStage').classList.remove('hidden');
  revealDeck.classList.add('hidden');
  $('searchCompleteBanner').classList.add('hidden');
  $('searchNetwork').querySelectorAll('.searchNode').forEach(n=>n.remove());
  $('searchConnections').replaceChildren();

  const img=data.image||{};
  $('searchCoreMeta').textContent=(img.width&&img.height)?(img.width+' × '+img.height):'verified upload';
  $('searchStageTitle').textContent='Searching privacy signals…';
  $('searchStageSubtitle').textContent='Verified findings and participant-supplied signals appear as they are confirmed.';
  setSearchProgress(4,'Starting');
  setChecklist(0);
  setPulse('Photo received. Initializing analysis…');

  const metaNodes=verifiedMetadataNodes(data);
  const publicNodes=normalizePublicNodes(data);
  const allNodes=[...metaNodes,...publicNodes];
  updateSearchMetrics(metaNodes,publicNodes);

  await sleep(650);
  setChecklist(1);setSearchProgress(18,'Reading metadata');setPulse('Reading EXIF and file-level metadata…');
  await sleep(550);

  const fileNodes=metaNodes.filter(n=>n.name!=='GPS');
  let shown=0;
  for(const node of fileNodes){
    addSearchNode(node,shown,Math.max(allNodes.length,4));shown++;
    setSearchProgress(22+shown*6,'Reading metadata');
    setPulse(node.name+' verified');
    await sleep(520);
  }

  setChecklist(2);setSearchProgress(43,'Checking location');setPulse('Checking embedded location signals…');
  await sleep(650);
  const gps=metaNodes.find(n=>n.name==='GPS');
  if(gps){
    addSearchNode(gps,shown,Math.max(allNodes.length,4));shown++;
    setPulse('Embedded GPS signal verified');
  }else{
    setChecklist(2,'No embedded GPS detected');
    setPulse('No embedded GPS coordinates found');
  }

  await sleep(650);
  setChecklist(3);setSearchProgress(56,'Checking public sources');setPulse('Checking for verified public correlations…');

  if(publicNodes.length){
    for(const node of publicNodes){
      await sleep(520);
      addSearchNode(node,shown,Math.max(allNodes.length,4));shown++;
      setSearchProgress(Math.min(88,58+Math.round((shown/Math.max(allNodes.length,1))*28)),'Public correlation');
      setPulse(node.name+': '+node.count+' verified match'+(node.count===1?'':'es'));
      $('metricMatches').textContent=publicNodes.slice(0,shown-metaNodes.length).reduce((sum,n)=>sum+n.count,0);
    }
  }else{
    await sleep(900);
    setChecklist(3,'No verified public correlations returned');
    setPulse('No verified public platform matches were returned');
  }

  await sleep(600);
  setChecklist(4);setSearchProgress(91,'Grouping findings');setPulse('Grouping verified findings…');
  await sleep(800);
  setChecklist(5);setSearchProgress(97,'Compiling results');setPulse('Compiling the final privacy picture…');
  await sleep(850);

  const remainingSearchTime=MIN_PHOTO_SEARCH_MS-(Date.now()-searchStartedAt);
  if(remainingSearchTime>0){
    setSearchProgress(98,'Finalizing');
    setPulse('Finalizing verified results…');
    await sleep(remainingSearchTime);
  }

  setSearchProgress(100,'Complete');
  document.querySelectorAll('.searchCheck').forEach(x=>{x.classList.remove('active');x.classList.add('done');});
  $('searchStageTitle').textContent='Search complete';
  const publicCount=publicNodes.reduce((sum,n)=>sum+n.count,0);
  $('searchStageSubtitle').textContent=publicNodes.length
    ? ('Verified photo signals, participant-supplied signals and '+publicCount+' public match'+(publicCount===1?'':'es')+' are displayed.')
    : 'Verified photo metadata is displayed. No public-platform matches were verified.';
  $('searchCompleteText').textContent=publicNodes.length
    ? 'Every glowing node represents a verified backend finding or a participant-supplied signal.'
    : 'Only verified photo findings are shown. No fake platform matches were added.';
  $('searchCompleteBanner').classList.remove('hidden');
  setPulse('Search complete — verified and supplied results only');
  searchComplete=true;
  searchRunning=false;

  // Move directly into the useful findings. The presenter no longer needs an
  // extra arrow press just to leave the completed search screen.
  await sleep(1300);
  if(searchComplete && session){
    $('liveSearchStage').classList.add('hidden');
    revealDeck.classList.remove('hidden');
    showReveal(3);
  }
}


function resetVoicePlaybackUi(){
  if(activeVoiceAudio){
    try{activeVoiceAudio.pause();}catch{}
    activeVoiceAudio=null;
  }
  if(activeVoiceAudioUrl){
    URL.revokeObjectURL(activeVoiceAudioUrl);
    activeVoiceAudioUrl='';
  }
  if(activeVoiceButton){
    const index=Number(activeVoiceButton.dataset.index);
    activeVoiceButton.classList.remove('playing');
    activeVoiceButton.querySelector('.voicePlayGlyph').textContent='▶';
    const strong=activeVoiceButton.querySelector('strong');
    if(strong){
      if(activeVoiceButton.id==='playOriginalConsent') strong.textContent='Play Original Consent';
      else if(activeVoiceButton.id.startsWith('playGeneratedVoice')) strong.textContent='Generated Sample '+(index+1);
      else strong.textContent='Play Sample '+(Number.isFinite(index)?index+1:'');
    }
    activeVoiceButton=null;
  }
}

async function preloadVoiceSamples(data){
  if(!session)return;
  const samples=Array.isArray(data.voiceSamples)?data.voiceSamples:[];
  const jobs=samples.filter(s=>s.available).map(async sample=>{
    const index=Number(sample.index);
    if(preloadedVoiceSamples.has(index))return;
    try{
      const response=await fetch('/.netlify/functions/photo-audio',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          id:session.id,
          presenterToken:session.presenterToken,
          index
        }),
        cache:'no-store'
      });
      if(!response.ok)return;
      const blob=await response.blob();
      const url=URL.createObjectURL(blob);
      preloadedVoiceSamples.set(index,{blob,url});
      if(index===0){
        const button=$('playOriginalConsent');
        if(button){
          button.disabled=false;
          button.classList.add('available');
        }
      }
    }catch{}
  });
  await Promise.allSettled(jobs);
}

function clearPreloadedVoiceSamples(){
  for(const item of preloadedVoiceSamples.values()){
    if(item?.url) URL.revokeObjectURL(item.url);
  }
  preloadedVoiceSamples.clear();
}

function renderVoiceRisk(data){
  const samples=Array.isArray(data.voiceSamples)?data.voiceSamples:[];
  const delivery=data.voiceDelivery||{};
  const status=$('voiceSampleStatus');
  const copy=$('voiceSampleCopy');
  if(!status||!copy)return;

  const original=samples.find(sample=>Number(sample.index)===0&&sample.available);
  if(original){
    const seconds=Math.max(1,Math.round((Number(original.durationMs)||0)/1000));
    status.textContent='Attendee supplied a '+seconds+'-second verbal-consent sample.';
    copy.textContent='The original clip can be compared against three new harmless sentences generated with a generic AI voice adjusted only to the attendee’s approximate speaking pace.';
  }else{
    status.textContent='No volunteer voice sample was recorded.';
    copy.textContent='Generated voice examples remain disabled because no verbal-consent sample was supplied.';
  }

  const originalButton=$('playOriginalConsent');
  if(originalButton){
    const ready=!!original&&preloadedVoiceSamples.has(0);
    originalButton.disabled=!ready;
    originalButton.classList.toggle('available',ready);
  }

  const generatedReady=!!original;
  for(let index=0;index<3;index++){
    const button=$('playGeneratedVoice'+index);
    if(!button)continue;
    button.disabled=!generatedReady;
    button.classList.toggle('available',generatedReady);
  }
}

async function playOriginalVoiceSample(index){
  if(!session)return;
  const button=index===0 ? $('playOriginalConsent') : $('playVoiceSample'+index);
  if(!button||button.disabled)return;

  resetVoicePlaybackUi();

  try{
    button.classList.add('playing');
    button.querySelector('.voicePlayGlyph').textContent='■';
    const strong=button.querySelector('strong');
    if(strong) strong.textContent=index===0?'Loading Original Consent…':('Loading Sample '+(index+1)+'…');
    activeVoiceButton=button;

    const cached=preloadedVoiceSamples.get(index);
    let blobUrl=cached?.url||'';

    if(!blobUrl){
      const response=await fetch('/.netlify/functions/photo-audio',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          id:session.id,
          presenterToken:session.presenterToken,
          index
        }),
        cache:'no-store'
      });

      if(!response.ok){
        const data=await response.json().catch(()=>({}));
        throw new Error(data.error||'Could not load the voice sample.');
      }

      const blob=await response.blob();
      blobUrl=URL.createObjectURL(blob);
      preloadedVoiceSamples.set(index,{blob,url:blobUrl});
    }

    activeVoiceAudioUrl='';
    activeVoiceAudio=new Audio(blobUrl);

    if(strong) strong.textContent=index===0?'Playing Original Consent':('Playing Sample '+(index+1));
    activeVoiceAudio.onended=resetVoicePlaybackUi;
    activeVoiceAudio.onerror=()=>{
      resetVoicePlaybackUi();
      alert('The voice sample could not be played.');
    };
    await activeVoiceAudio.play();
  }catch(err){
    resetVoicePlaybackUi();
    alert(err.message||'Could not play the voice sample.');
  }
}

const GENERATED_VOICE_LINES=[
  "Hello there. I enjoy travelling and discovering new places.",
  "Today is a great day to learn something new.",
  "I like good food, live sports, and spending time with friends."
];

function playGeneratedVoiceSample(index){
  const line=GENERATED_VOICE_LINES[index];
  if(!line||!latestStatus)return;
  if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined'){
    alert('This browser does not provide speech synthesis for the AI voice demonstration.');
    return;
  }

  speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(line);
  const rate=Number(latestStatus.voiceDelivery?.speakingRateFactor)||1;
  utterance.rate=Math.min(1.20,Math.max(0.80,rate));
  utterance.pitch=1;
  utterance.volume=1;

  const voices=speechSynthesis.getVoices();
  const generic=voices.find(v=>/^en(-|_)/i.test(v.lang||''))||voices[0];
  if(generic)utterance.voice=generic;

  const button=$('playGeneratedVoice'+index);
  if(button){
    button.classList.add('playing');
    button.querySelector('.voicePlayGlyph').textContent='■';
    const strong=button.querySelector('strong');
    if(strong)strong.textContent='Playing Generated Sample '+(index+1);
  }

  const reset=()=>{
    if(button){
      button.classList.remove('playing');
      button.querySelector('.voicePlayGlyph').textContent='▶';
      const strong=button.querySelector('strong');
      if(strong)strong.textContent='Generated Sample '+(index+1);
    }
  };
  utterance.onend=reset;
  utterance.onerror=reset;
  speechSynthesis.speak(utterance);
}

function renderSubmitted(data){
  latestStatus=data;$('participantName').textContent=data.participant?.firstName||'Volunteer';
  const grid=$('photoFindingCards');grid.replaceChildren();const img=data.image||{},f=data.findings||{};
  metadataMap(data);correlationMap(data);impact(data);renderVoiceRisk(data);
  const w=data.webDetection||{};
  const reverseSignals=(Number(w.fullMatches)||0)+(Number(w.partialMatches)||0);
  grid.append(
    findingCard('Embedded GPS',f.gpsEmbedded?'FOUND':'NOT FOUND',f.gpsEmbedded?'The original file contained GPS coordinates. They were reduced before display.':'No embedded GPS coordinates were detected.',f.gpsEmbedded?'risk':'safe'),
    findingCard('Capture date',f.captureDateEmbedded?('YEAR '+(f.capturedAtYear||'FOUND')):'NOT FOUND',f.captureDateEmbedded?'The file contained original capture-time metadata.':'No readable original capture date was detected.',f.captureDateEmbedded?'warn':'safe'),
    findingCard('Camera metadata',f.cameraMetadataEmbedded?'FOUND':'NOT FOUND',f.cameraMetadataEmbedded?('Reduced summary: '+(f.cameraSummary||'metadata present')):'No readable camera make/model metadata was detected.',f.cameraMetadataEmbedded?'warn':'safe'),
    findingCard('Reverse-image web match',w.attempted?(reverseSignals+' MATCH SIGNAL'+(reverseSignals===1?'':'S')):'NOT RUN',w.attempted?((Number(w.matchingPages)||0)+' matching web page'+(Number(w.matchingPages)===1?'':'s')+' and '+(Number(w.similarImages)||0)+' visually similar image signal'+(Number(w.similarImages)===1?'':'s')+' returned by Google Vision Web Detection.'):'Google Vision Web Detection was not configured for this submission.',reverseSignals||Number(w.matchingPages)?'warn':'safe'),
    findingCard('Image file',(img.width||'?')+' × '+(img.height||'?'),(img.mime||'image')+' • '+formatBytes(img.bytes)+'. The raw photo was not persisted.','safe')
  );
  const wrap=$('photoMapWrap');wrap.replaceChildren();
  if(f.locationZone){
    const broadLabel=data.locationContext?.broadPlace?.label||'';
    $('locationHeadline').textContent=broadLabel
      ? ('The photo points broadly to '+broadLabel+'.')
      : 'The photo contained a location signal.';
    $('locationCopy').textContent=broadLabel
      ? ('The exact GPS coordinate is never returned. The image was first reduced to a 50 km privacy zone, then that broad zone was normalized to '+broadLabel+'.')
      : 'The exact GPS coordinate is never returned to the presentation. It is reduced to a broad 50 km privacy zone.';
    const v=document.createElement('div');v.className='mapViewport bigPhotoMap';
    const frame=document.createElement('iframe');frame.src=mapUrl(f.locationZone);frame.loading='lazy';frame.referrerPolicy='no-referrer';frame.title='Approximate privacy zone';
    const c=document.createElement('div');c.className='privacyCircle';v.append(frame,c);wrap.appendChild(v);
  }else{
    $('locationHeadline').textContent='No embedded GPS location was detected.';
    $('locationCopy').textContent='That does not mean the image has no location clues. Signs, landmarks, events, uniforms and background details can still expose context.';
    wrap.innerHTML='<div class="noLocationGraphic"><span>◎</span><strong>NO GPS METADATA</strong><small>Exact location remains hidden</small></div>';
  }
  revealIndex=0;revealDeck.classList.add('hidden');
}
function showReveal(i){
  const slides=[...document.querySelectorAll('.revealSlide')];
  if(!slides.length)return;
  revealIndex=Math.max(0,Math.min(i,slides.length-1));
  slides.forEach((s,n)=>s.classList.toggle('hidden',n!==revealIndex));
  if(latestStatus&&revealIndex===2)metadataMap(latestStatus);
  if(latestStatus&&revealIndex===5)correlationMap(latestStatus);

  if($('photoRevealCounter'))$('photoRevealCounter').textContent=(revealIndex+1)+' / '+slides.length;
  if($('photoRevealName'))$('photoRevealName').textContent=photoRevealNames[revealIndex]||'Findings';
  if($('photoPrev'))$('photoPrev').disabled=revealIndex===0;
  if($('photoNext'))$('photoNext').textContent=revealIndex===slides.length-1?'Done':'Next →';

  const active=slides[revealIndex];
  requestAnimationFrame(()=>{
    if(active) active.scrollTop=0;
  });
}
async function poll(){
  if(!session)return;
  try{
    const d=await request('/.netlify/functions/photo-status',{
      method:'POST',
      body:JSON.stringify({id:session.id,presenterToken:session.presenterToken})
    });
    setProgress(d.status);
    if(d.status==='submitted'&&latestStatus?.submittedAt!==d.submittedAt)startAutoSearch(d);
  }catch(e){if(/expired|not found/i.test(e.message)){clearInterval(pollTimer);$('liveTitle').textContent='Session expired';$('liveMessage').textContent='Create a new QR code for another volunteer.';}}
}
function startPolling(){clearInterval(pollTimer);poll();pollTimer=setInterval(poll,650);}
async function erase(){
  if(!session)return;
  $('erasePhotoDemo').disabled=true;
  await runEraseSequence();

  try{
    setEraseSequenceStep(0,'done');
    setEraseSequenceStep(1,'active');

    await request('/.netlify/functions/photo-erase',{
      method:'POST',
      body:JSON.stringify({id:session.id,presenterToken:session.presenterToken})
    });

    setEraseSequenceStep(1,'done');
    setEraseSequenceStep(2,'active');
    clearInterval(pollTimer);
    await sleep(180);
    setEraseSequenceStep(2,'done');
    setEraseSequenceStep(3,'active');

    resetVoicePlaybackUi();
    clearPreloadedVoiceSamples();
    clearPhotoAmbient();
    sessionStorage.removeItem('pfPhotoPresenter');
    session=null;
    latestStatus=null;
    searchRunning=false;
    searchComplete=false;
    document.body.classList.remove('photoPresentationMode');
    revealDeck.classList.add('hidden');
    $('liveSearchStage').classList.add('hidden');
    $('qrImage').removeAttribute('src');
    $('copyLink').dataset.url='';

    setEraseSequenceStep(3,'done');
    await finishEraseSequence();

    $('erasePhotoNotice').classList.remove('hidden');
    setTimeout(()=>$('erasePhotoNotice').classList.add('hidden'),5000);
    $('erasePhotoDemo').disabled=false;
    $('erasePhotoDemo').textContent='Erase Demo Data';
    setSessionUi(false);
    await checkPresenterHealth();
  }catch(e){
    $('eraseSequenceOverlay').classList.add('hidden');
    alert(e.message);
    $('erasePhotoDemo').disabled=false;
  }
}
$('startSession').addEventListener('click',createSession);
$('copyLink').addEventListener('click',async()=>{const u=$('copyLink').dataset.url;if(!u)return;await navigator.clipboard.writeText(u);$('copyLink').textContent='Copied ✓';setTimeout(()=>$('copyLink').textContent='Copy volunteer link',1200);});
$('erasePhotoDemo').addEventListener('click',erase);
$('photoPrev')?.addEventListener('click',()=>showReveal(revealIndex-1));
$('photoNext')?.addEventListener('click',()=>{
  const slides=[...document.querySelectorAll('.revealSlide')];
  if(revealIndex>=slides.length-1)return;
  showReveal(revealIndex+1);
});
$('playOriginalConsent')?.addEventListener('click',()=>playOriginalVoiceSample(0));
for(let index=0;index<3;index++){
  $('playGeneratedVoice'+index)?.addEventListener('click',()=>playGeneratedVoiceSample(index));
}
document.addEventListener('keydown',(e)=>{
  const nextKeys=['ArrowRight','PageDown',' ','Enter'];
  const backKeys=['ArrowLeft','PageUp'];

  if(!revealDeck.classList.contains('hidden')){
    if(nextKeys.includes(e.key)){e.preventDefault();showReveal(revealIndex+1)}
    if(backKeys.includes(e.key)){e.preventDefault();showReveal(revealIndex-1)}
    return;
  }

  if(!$('liveSearchStage').classList.contains('hidden') && searchComplete && nextKeys.includes(e.key)){
    e.preventDefault();
    $('liveSearchStage').classList.add('hidden');
    revealDeck.classList.remove('hidden');
    showReveal(3);
  }
});

checkPresenterHealth();
restorePresenterSession();

window.addEventListener('pagehide',()=>{
  document.body.classList.remove('photoPresentationMode');
  resetVoicePlaybackUi();
  clearPreloadedVoiceSamples();
  clearPhotoAmbient();
});

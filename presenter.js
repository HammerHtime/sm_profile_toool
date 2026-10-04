const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
})[ch]);
let session=null,pollTimer=null,revealIndex=0,latestStatus=null,searchRunning=false,searchComplete=false;
const startView=$('startView'),sessionView=$('sessionView'),revealDeck=$('revealDeck');

async function request(path,options={}){
  const r=await fetch(path,{...options,headers:{'content-type':'application/json',...(options.headers||{})},cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error((data.error||('Request failed ('+r.status+')')) + (data.detail ? ' — ' + data.detail : ''));
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
  const publicNodes=normalizePublicNodes(data);
  const positions=[
    {x:2,y:8},{x:77,y:8},{x:2,y:67},{x:77,y:67},{x:39,y:2},{x:39,y:77}
  ];

  const nodes=[
    {title:'Embedded metadata',detail:'File-level privacy signals',icon:'◇',tone:'warn'},
    {title:'Location clues',detail:data.findings?.gpsEmbedded?'GPS signal was present':'No embedded GPS detected',icon:'⌖',tone:data.findings?.gpsEmbedded?'risk':'safe'}
  ];

  if(publicNodes.length){
    publicNodes.slice(0,4).forEach(n=>{
      nodes.push({
        title:n.name,
        detail:n.count+' verified public match'+(n.count===1?'':'es')+' from the supplied handle',
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

  const domains=(c.sourceDomains||[]).slice(0,5);
  const domainCopy=domains.length?' Sources included: '+domains.join(', ')+'.':'';
  $('correlationDisclosure').innerHTML=
    '<strong>Breadcrumb logic, not facial identification.</strong> '+
    escapeHtml(c.basis||'Public correlations appear only when a real source match is returned.')+
    escapeHtml(domainCopy);
}
function impact(data){
  const f=data.findings||{},embedded=[f.gpsEmbedded,f.captureDateEmbedded,f.cameraMetadataEmbedded].filter(Boolean).length;
  const publicMatches=Number(data.correlation?.totalMatches)||0;
  const vals=[[embedded,'embedded signals'],[f.gpsEmbedded?'50 km':'—','location privacy zone'],[publicMatches,'verified public matches'],[data.participant?.usernameMasked?1:0,'supplied public handle']];
  $('impactStats').innerHTML=vals.map(v=>'<div class="impactStat"><strong>'+escapeHtml(v[0])+'</strong><span>'+escapeHtml(v[1])+'</span></div>').join('');
}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

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
  const f=data.findings||{},img=data.image||{};
  const nodes=[];
  if(f.gpsEmbedded) nodes.push({name:'GPS',count:1,subtitle:'embedded location signal',icon:'⌖',kind:'metadata'});
  if(f.captureDateEmbedded) nodes.push({name:'Capture time',count:1,subtitle:f.capturedAtYear?('year '+f.capturedAtYear):'original date found',icon:'◷',kind:'metadata'});
  if(f.cameraMetadataEmbedded) nodes.push({name:'Camera / device',count:1,subtitle:f.cameraSummary||'device metadata',icon:'▣',kind:'metadata'});
  if(img.bytes) nodes.push({name:'File',count:1,subtitle:(img.width||'?')+' × '+(img.height||'?')+' · '+formatBytes(img.bytes),icon:'#',kind:'metadata'});
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
  line.classList.add('searchConnectionLine',kind==='public'?'public':'metadata');
  svg.appendChild(line);
}

function addSearchNode(node,index,total){
  const stage=$('searchNetwork');
  if(!stage)return;
  const pos=nodePosition(index,total);
  addSearchConnection(pos.x,pos.y,node.kind);

  const el=document.createElement('div');
  el.className='searchNode '+(node.kind==='public'?'publicNode':'metadataNode');
  el.style.left=pos.x+'%';
  el.style.top=pos.y+'%';
  el.innerHTML=
    '<div class="searchNodeIcon">'+escapeHtml(node.icon)+'</div>'+
    '<strong class="searchNodeCount">'+escapeHtml(node.count)+'</strong>'+
    '<span class="searchNodeName">'+escapeHtml(node.name)+'</span>'+
    '<small>'+escapeHtml(node.subtitle)+'</small>'+
    '<em>VERIFIED</em>';
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

async function startAutoSearch(data){
  if(searchRunning)return;
  searchRunning=true;
  searchComplete=false;
  latestStatus=data;

  renderSubmitted(data);

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
  $('searchStageSubtitle').textContent='Verified findings appear around the photo as they are confirmed.';
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

  setSearchProgress(100,'Complete');
  document.querySelectorAll('.searchCheck').forEach(x=>{x.classList.remove('active');x.classList.add('done');});
  $('searchStageTitle').textContent='Search complete';
  const publicCount=publicNodes.reduce((sum,n)=>sum+n.count,0);
  $('searchStageSubtitle').textContent=publicNodes.length
    ? ('Verified photo signals plus '+publicCount+' public match'+(publicCount===1?'':'es')+' are displayed.')
    : 'Verified photo metadata is displayed. No public-platform matches were verified.';
  $('searchCompleteText').textContent=publicNodes.length
    ? 'Every glowing node represents a verified finding returned by the backend.'
    : 'Only verified photo findings are shown. No fake platform matches were added.';
  $('searchCompleteBanner').classList.remove('hidden');
  setPulse('Search complete — verified results only');
  searchComplete=true;
  searchRunning=false;
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
  revealIndex=0;revealDeck.classList.add('hidden');
}
function showReveal(i){
  const slides=[...document.querySelectorAll('.revealSlide')];if(!slides.length)return;revealIndex=Math.max(0,Math.min(i,slides.length-1));
  slides.forEach((s,n)=>s.classList.toggle('hidden',n!==revealIndex));
  if(latestStatus&&revealIndex===2)metadataMap(latestStatus);if(latestStatus&&revealIndex===5)correlationMap(latestStatus);
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
  if(!session)return;$('erasePhotoDemo').disabled=true;
  try{
    await request('/.netlify/functions/photo-erase',{method:'POST',body:JSON.stringify({id:session.id,presenterToken:session.presenterToken})});
    clearInterval(pollTimer);
    sessionStorage.removeItem('pfPhotoPresenter');
    session=null;latestStatus=null;searchRunning=false;searchComplete=false;
    revealDeck.classList.add('hidden');
    $('liveSearchStage').classList.add('hidden');
    $('qrImage').removeAttribute('src');
    $('copyLink').dataset.url='';
    $('erasePhotoDemo').disabled=false;
    $('erasePhotoDemo').textContent='Erase session';
    setSessionUi(false);
    await checkPresenterHealth();
  }catch(e){alert(e.message);$('erasePhotoDemo').disabled=false;}
}
$('startSession').addEventListener('click',createSession);
$('copyLink').addEventListener('click',async()=>{const u=$('copyLink').dataset.url;if(!u)return;await navigator.clipboard.writeText(u);$('copyLink').textContent='Copied ✓';setTimeout(()=>$('copyLink').textContent='Copy volunteer link',1200);});
$('erasePhotoDemo').addEventListener('click',erase);
document.addEventListener('keydown',(e)=>{
  const nextKeys=['ArrowRight','PageDown',' ','Enter'];
  const backKeys=['ArrowLeft','PageUp'];

  if(!revealDeck.classList.contains('hidden')){
    if(nextKeys.includes(e.key)){e.preventDefault();showReveal(revealIndex+1)}
    if(backKeys.includes(e.key)){
      e.preventDefault();
      if(revealIndex<=3){
        revealDeck.classList.add('hidden');
        $('liveSearchStage').classList.remove('hidden');
      }else showReveal(revealIndex-1);
    }
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

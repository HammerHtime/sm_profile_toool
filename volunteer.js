const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const sessionId = params.get('session') || '';
const joinToken = params.get('token') || '';
let selectedFile = null;
let selectedDimensions = { width:0, height:0 };
let previewUrl = '';

function error(message) { $('volunteerError').textContent=message; $('volunteerError').classList.remove('hidden'); }
function clearError(){ $('volunteerError').classList.add('hidden'); $('volunteerError').textContent=''; }
async function api(path, payload) {
  const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error || 'Request failed (' + r.status + ')');
  return data;
}

async function markJoined(){
  if(!sessionId || !joinToken){ error('This QR link is incomplete. Ask the presenter to create a new session.'); return; }
  try { await api('/.netlify/functions/photo-join',{id:sessionId,joinToken}); }
  catch(err){ error(err.message); $('submitVolunteer').disabled=true; }
}

function syncGate(){
  const ok=$('vConsent').checked && $('vFirstName').value.trim() && selectedFile;
  $('submitVolunteer').disabled=!ok;
}

async function readDimensions(file, url){
  if(!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) return {width:0,height:0};
  return await new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve({width:img.naturalWidth||0,height:img.naturalHeight||0});
    img.onerror=()=>resolve({width:0,height:0}); img.src=url;
  });
}

$('vPhoto').addEventListener('change', async () => {
  clearError();
  const file=$('vPhoto').files?.[0] || null;
  if(!file){selectedFile=null;syncGate();return;}
  if(file.size > 4*1024*1024){ error('Please choose a photo that is 4 MB or smaller.'); $('vPhoto').value=''; selectedFile=null; syncGate(); return; }
  selectedFile=file;
  if(previewUrl) URL.revokeObjectURL(previewUrl);
  const url=URL.createObjectURL(file); previewUrl=url;
  $('photoPreview').src=url;
  $('photoPreviewWrap').classList.remove('hidden');
  selectedDimensions=await readDimensions(file,url);
  let meta=(file.type || 'image') + ' • ' + (file.size/(1024*1024)).toFixed(1) + ' MB';
  if(selectedDimensions.width) meta += ' • ' + selectedDimensions.width + ' × ' + selectedDimensions.height;
  $('photoMeta').textContent=meta;
  syncGate();
});
['vConsent','vFirstName'].forEach(id=>$(id).addEventListener('input',syncGate));

function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>{const s=String(r.result||''); resolve(s.includes(',')?s.split(',')[1]:s);};
    r.onerror=()=>reject(new Error('Could not read the selected photo.'));
    r.readAsDataURL(file);
  });
}

$('volunteerForm').addEventListener('submit', async (e)=>{
  e.preventDefault(); clearError();
  if(!$('vConsent').checked) return error('Consent is required.');
  if(!selectedFile) return error('Choose or take a photo first.');
  const button=$('submitVolunteer'); button.disabled=true; button.textContent='Sending securely…';
  try{
    const imageData=await fileToBase64(selectedFile);
    await api('/.netlify/functions/photo-submit',{
      id:sessionId,joinToken,consent:true,
      firstName:$('vFirstName').value.trim(), city:$('vCity').value.trim(), username:$('vUsername').value.trim(),
      mime:selectedFile.type || 'image/jpeg', imageData,
      width:selectedDimensions.width,height:selectedDimensions.height
    });
    $('photoPreview').removeAttribute('src'); if(previewUrl){URL.revokeObjectURL(previewUrl); previewUrl='';} $('vPhoto').value=''; selectedFile=null;
    $('volunteerForm').classList.add('hidden'); $('volunteerDone').classList.remove('hidden');
    history.replaceState({},document.title,'volunteer.html');
  }catch(err){error(err.message);button.disabled=false;button.textContent='Send to live demo';}
});

markJoined();
syncGate();
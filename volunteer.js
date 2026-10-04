const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.hash ? location.hash.slice(1) : location.search);
const sessionId = params.get('session') || '';
const joinToken = params.get('token') || '';

let sessionReady = false;
let selectedFile = null;
let selectedSource = '';
let selectedDimensions = { width:0, height:0 };
let previewUrl = '';

function error(message) {
  $('volunteerError').textContent = message;
  $('volunteerError').classList.remove('hidden');
}

function clearError() {
  $('volunteerError').classList.add('hidden');
  $('volunteerError').textContent = '';
}

async function api(path, payload) {
  const r = await fetch(path, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload),
    cache:'no-store'
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((data.error || 'Request failed (' + r.status + ')') + (data.detail ? ' — ' + data.detail : ''));
  }
  return data;
}

async function markJoined() {
  if (!sessionId || !joinToken) {
    error('This QR link is incomplete. Ask the presenter to create a new session.');
    return;
  }
  try {
    await api('/.netlify/functions/photo-join', { id:sessionId, joinToken });
    sessionReady = true;
    syncGate();
  } catch (err) {
    sessionReady = false;
    error(err.message);
    $('submitVolunteer').disabled = true;
  }
}

function syncGate() {
  const ok = sessionReady && $('vConsent').checked && $('vFirstName').value.trim() && selectedFile;
  $('submitVolunteer').disabled = !ok;
}

async function readDimensions(file, url) {
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) return { width:0, height:0 };
  return await new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width:img.naturalWidth || 0, height:img.naturalHeight || 0 });
    img.onerror = () => resolve({ width:0, height:0 });
    img.src = url;
  });
}

function clearFileInputs() {
  $('vPhotoCamera').value = '';
  $('vPhotoLibrary').value = '';
}

function resetPhoto() {
  selectedFile = null;
  selectedSource = '';
  selectedDimensions = { width:0, height:0 };
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  }
  $('photoPreview').removeAttribute('src');
  $('photoPreviewWrap').classList.add('hidden');
  clearFileInputs();
  syncGate();
}

async function useSelectedPhoto(file, source) {
  clearError();
  if (!file) return;

  if (file.size > 4 * 1024 * 1024) {
    error('That photo is larger than 4 MB. Please choose another image.');
    clearFileInputs();
    return;
  }

  selectedFile = file;
  selectedSource = source;

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  $('photoPreview').onerror = () => {
    $('photoPreview').classList.add('previewUnavailable');
    $('photoMeta').textContent = 'Photo selected. Preview is not available for this image format on this browser.';
  };
  $('photoPreview').onload = () => $('photoPreview').classList.remove('previewUnavailable');
  $('photoPreview').src = previewUrl;
  $('photoPreviewWrap').classList.remove('hidden');
  $('photoSourceBadge').textContent = source === 'camera' ? 'NEW PHOTO' : 'PHOTO LIBRARY';

  selectedDimensions = await readDimensions(file, previewUrl);

  let meta = (file.type || 'image') + ' • ' + (file.size / (1024 * 1024)).toFixed(1) + ' MB';
  if (selectedDimensions.width) meta += ' • ' + selectedDimensions.width + ' × ' + selectedDimensions.height;
  $('photoMeta').textContent = meta;

  syncGate();
}

$('takePhotoBtn').addEventListener('click', () => {
  clearError();
  $('vPhotoCamera').click();
});

$('choosePhotoBtn').addEventListener('click', () => {
  clearError();
  $('vPhotoLibrary').click();
});

$('changePhotoBtn').addEventListener('click', () => {
  resetPhoto();
  $('choosePhotoBtn').focus();
});

$('vPhotoCamera').addEventListener('change', async () => {
  const file = $('vPhotoCamera').files?.[0] || null;
  await useSelectedPhoto(file, 'camera');
});

$('vPhotoLibrary').addEventListener('change', async () => {
  const file = $('vPhotoLibrary').files?.[0] || null;
  await useSelectedPhoto(file, 'library');
});

['vConsent','vFirstName'].forEach(id => $(id).addEventListener('input', syncGate));

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      resolve(s.includes(',') ? s.split(',')[1] : s);
    };
    r.onerror = () => reject(new Error('Could not read the selected photo.'));
    r.readAsDataURL(file);
  });
}

$('volunteerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  if (!$('vConsent').checked) return error('Consent is required.');
  if (!selectedFile) return error('Take or choose a photo first.');

  const button = $('submitVolunteer');
  button.disabled = true;
  button.textContent = 'Submitting & starting search…';
  document.body.classList.add('volunteerSubmitting');

  try {
    const imageData = await fileToBase64(selectedFile);

    await api('/.netlify/functions/photo-submit', {
      id:sessionId,
      joinToken,
      consent:true,
      firstName:$('vFirstName').value.trim(),
      city:$('vCity').value.trim(),
      username:$('vUsername').value.trim(),
      mime:selectedFile.type || 'image/jpeg',
      imageData,
      width:selectedDimensions.width,
      height:selectedDimensions.height,
      source:selectedSource
    });

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = '';
    }
    clearFileInputs();
    selectedFile = null;

    $('volunteerForm').classList.add('hidden');
    $('volunteerDone').classList.remove('hidden');
    history.replaceState({}, document.title, 'volunteer.html');
  } catch (err) {
    document.body.classList.remove('volunteerSubmitting');
    error(err.message);
    button.disabled = false;
    button.textContent = 'Consent & Start Analysis';
  }
});

markJoined();
syncGate();

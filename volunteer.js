const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.hash ? location.hash.slice(1) : location.search);
const sessionId = params.get('session') || '';
const joinToken = params.get('token') || '';

let sessionReady = false;
let selectedFile = null;
let selectedSource = '';
let selectedDimensions = { width:0, height:0 };
let previewUrl = '';
let voiceRecorder = null;
let voiceStream = null;
let voiceChunks = [];
let voiceBlob = null;
let voiceUrl = '';
let voiceStartedAt = 0;
let voiceDurationMs = 0;
let voiceTimerId = null;

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


function formatVoiceTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2,'0');
  return minutes + ':' + seconds;
}

function stopVoiceTimer() {
  clearInterval(voiceTimerId);
  voiceTimerId = null;
}

function updateVoiceTimer() {
  const elapsed = voiceStartedAt ? Date.now() - voiceStartedAt : voiceDurationMs;
  $('voiceTimer').textContent = formatVoiceTime(elapsed);
}

function clearVoiceRecording() {
  stopVoiceTimer();
  if (voiceRecorder && voiceRecorder.state !== 'inactive') {
    try { voiceRecorder.stop(); } catch {}
  }
  if (voiceStream) {
    voiceStream.getTracks().forEach(track => track.stop());
    voiceStream = null;
  }
  voiceRecorder = null;
  voiceChunks = [];
  voiceBlob = null;
  voiceDurationMs = 0;
  voiceStartedAt = 0;

  if (voiceUrl) {
    URL.revokeObjectURL(voiceUrl);
    voiceUrl = '';
  }

  $('voicePreview').removeAttribute('src');
  $('voicePreviewWrap').classList.add('hidden');
  $('voiceTimer').textContent = '0:00';
  $('voiceRecordBtn').classList.remove('recording');
  $('voiceRecordBtn').innerHTML = '<span>●</span> Record';
}

async function startVoiceRecording() {
  clearError();

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    error('Voice recording is not supported by this browser. You can continue without it.');
    return;
  }

  if (voiceRecorder?.state === 'recording') {
    voiceRecorder.stop();
    return;
  }

  clearVoiceRecording();

  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio:true });
    voiceChunks = [];

    let options = {};
    const preferred = ['audio/webm;codecs=opus','audio/webm','audio/mp4'];
    const supported = preferred.find(type => MediaRecorder.isTypeSupported?.(type));
    if (supported) options.mimeType = supported;

    voiceRecorder = new MediaRecorder(voiceStream, options);
    voiceRecorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) voiceChunks.push(event.data);
    });

    voiceRecorder.addEventListener('stop', () => {
      stopVoiceTimer();
      voiceDurationMs = voiceStartedAt ? Math.max(0, Date.now() - voiceStartedAt) : voiceDurationMs;
      voiceStartedAt = 0;
      updateVoiceTimer();

      const type = voiceRecorder?.mimeType || voiceChunks[0]?.type || 'audio/webm';
      voiceBlob = new Blob(voiceChunks, { type });

      if (voiceUrl) URL.revokeObjectURL(voiceUrl);
      voiceUrl = URL.createObjectURL(voiceBlob);
      $('voicePreview').src = voiceUrl;
      $('voicePreviewWrap').classList.remove('hidden');

      if (voiceStream) {
        voiceStream.getTracks().forEach(track => track.stop());
        voiceStream = null;
      }

      $('voiceRecordBtn').classList.remove('recording');
      $('voiceRecordBtn').innerHTML = '<span>●</span> Record again';
    });

    voiceRecorder.start();
    voiceStartedAt = Date.now();
    voiceDurationMs = 0;
    updateVoiceTimer();
    voiceTimerId = setInterval(updateVoiceTimer, 250);

    $('voiceRecordBtn').classList.add('recording');
    $('voiceRecordBtn').innerHTML = '<span>■</span> Stop';
  } catch (err) {
    clearVoiceRecording();
    if (err?.name === 'NotAllowedError') {
      error('Microphone access was not allowed. You can continue without a voice sample.');
    } else {
      error('Could not start the microphone. You can continue without a voice sample.');
    }
  }
}

$('voiceRecordBtn').addEventListener('click', startVoiceRecording);
$('deleteVoiceBtn').addEventListener('click', clearVoiceRecording);

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
      source:selectedSource,
      voiceSample:{
        recorded:!!voiceBlob,
        durationMs:voiceBlob ? Math.min(30000, Math.max(0, Math.round(voiceDurationMs))) : 0,
        localOnly:true
      }
    });

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = '';
    }
    clearFileInputs();
    selectedFile = null;
    clearVoiceRecording();

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

window.addEventListener('pagehide', () => {
  if (voiceStream) voiceStream.getTracks().forEach(track => track.stop());
  if (voiceUrl) URL.revokeObjectURL(voiceUrl);
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.hash ? location.hash.slice(1) : location.search);
const sessionId = params.get('session') || '';
const joinToken = params.get('token') || '';

let sessionReady = false;
let selectedFile = null;
let selectedSource = '';
let selectedDimensions = { width:0, height:0 };
let previewUrl = '';
const VOICE_SAMPLE_COUNT = 1;
const VOICE_MAX_MS = 10000;
let voiceRecorder = null;
let voiceStream = null;
let activeVoiceIndex = -1;
let voiceChunks = [];
let voiceStartedAt = 0;
let voiceTimerId = null;
let discardVoiceOnStop = false;
const voiceSamples = Array.from({length:VOICE_SAMPLE_COUNT}, () => ({
  blob:null,
  url:'',
  durationMs:0,
  mime:''
}));

function normalizeVoiceMime(value = '') {
  const base = String(value || '').toLowerCase().trim().split(';')[0].trim();
  if (base === 'audio/x-m4a') return 'audio/mp4';
  return base || 'audio/webm';
}

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
  const voiceIdle = !voiceRecorder || voiceRecorder.state !== 'recording';
  const ok = sessionReady && $('vConsent').checked && $('vFirstName').value.trim() && selectedFile && voiceIdle;
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

function updateVoiceTimer(index) {
  const sample = voiceSamples[index];
  if (!sample) return;
  const elapsed = activeVoiceIndex === index && voiceStartedAt
    ? Math.min(VOICE_MAX_MS, Date.now() - voiceStartedAt)
    : sample.durationMs;
  $('voiceTimer' + index).textContent = formatVoiceTime(elapsed);
}

function stopVoiceStream() {
  if (voiceStream) {
    voiceStream.getTracks().forEach(track => track.stop());
    voiceStream = null;
  }
}

function clearVoiceSample(index) {
  const sample = voiceSamples[index];
  if (!sample) return;

  if (activeVoiceIndex === index && voiceRecorder?.state === 'recording') {
    discardVoiceOnStop = true;
    try { voiceRecorder.stop(); } catch {}
  }

  if (sample.url) {
    URL.revokeObjectURL(sample.url);
    sample.url = '';
  }

  sample.blob = null;
  sample.durationMs = 0;
  sample.mime = '';

  $('voicePreview' + index).removeAttribute('src');
  $('voicePreviewWrap' + index).classList.add('hidden');
  $('voiceTimer' + index).textContent = '0:00';
  $('voiceRecordBtn' + index).classList.remove('recording');
  $('voiceRecordBtn' + index).innerHTML = '<span>●</span> Record consent phrase';
  syncGate();
}

function resetAllVoiceSamples() {
  stopVoiceTimer();
  if (voiceRecorder?.state === 'recording') {
    try { voiceRecorder.stop(); } catch {}
  }
  voiceRecorder = null;
  activeVoiceIndex = -1;
  voiceChunks = [];
  voiceStartedAt = 0;
  stopVoiceStream();
  voiceSamples.forEach((_, index) => clearVoiceSample(index));
}

async function startVoiceRecording(index) {
  clearError();

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    error('Voice recording is not supported by this browser. You can continue without it.');
    return;
  }

  if (voiceRecorder?.state === 'recording') {
    if (activeVoiceIndex === index) {
      voiceRecorder.stop();
      return;
    }
    voiceRecorder.stop();
    await new Promise(resolve => setTimeout(resolve, 120));
  }

  clearVoiceSample(index);

  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio:true });
    voiceChunks = [];
    discardVoiceOnStop = false;
    activeVoiceIndex = index;

    const preferred = ['audio/webm;codecs=opus','audio/webm','audio/mp4;codecs=mp4a.40.2','audio/mp4'];
    const supported = preferred.find(type => MediaRecorder.isTypeSupported?.(type));
    const options = {
      ...(supported ? {mimeType:supported} : {}),
      audioBitsPerSecond:48000
    };

    voiceRecorder = new MediaRecorder(voiceStream, options);

    voiceRecorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) voiceChunks.push(event.data);
    });

    voiceRecorder.addEventListener('stop', () => {
      const completedIndex = activeVoiceIndex;
      stopVoiceTimer();

      const durationMs = voiceStartedAt
        ? Math.min(VOICE_MAX_MS, Math.max(0, Date.now() - voiceStartedAt))
        : 0;

      voiceStartedAt = 0;
      activeVoiceIndex = -1;

      if (discardVoiceOnStop) {
        discardVoiceOnStop = false;
        stopVoiceStream();
        voiceChunks = [];
        voiceRecorder = null;
        syncGate();
        return;
      }

      const type = voiceRecorder?.mimeType || voiceChunks[0]?.type || 'audio/webm';
      const blob = new Blob(voiceChunks, { type });
      const sample = voiceSamples[completedIndex];

      if (sample) {
        if (sample.url) URL.revokeObjectURL(sample.url);
        sample.blob = blob;
        sample.durationMs = durationMs;
        sample.mime = type;
        sample.url = URL.createObjectURL(blob);

        $('voicePreview' + completedIndex).src = sample.url;
        $('voicePreviewWrap' + completedIndex).classList.remove('hidden');
        $('voiceTimer' + completedIndex).textContent = formatVoiceTime(durationMs);
        $('voiceRecordBtn' + completedIndex).classList.remove('recording');
        $('voiceRecordBtn' + completedIndex).innerHTML = '<span>●</span> Record again';
      }

      stopVoiceStream();
      voiceChunks = [];
      voiceRecorder = null;
      syncGate();
    });

    voiceRecorder.start();
    voiceStartedAt = Date.now();
    updateVoiceTimer(index);
    voiceTimerId = setInterval(() => {
      updateVoiceTimer(index);
      if (Date.now() - voiceStartedAt >= VOICE_MAX_MS && voiceRecorder?.state === 'recording') {
        voiceRecorder.stop();
      }
    }, 200);

    $('voiceRecordBtn' + index).classList.add('recording');
    $('voiceRecordBtn' + index).innerHTML = '<span>■</span> Stop';
    syncGate();
  } catch (err) {
    stopVoiceTimer();
    stopVoiceStream();
    voiceRecorder = null;
    activeVoiceIndex = -1;
    voiceStartedAt = 0;
    clearVoiceSample(index);

    if (err?.name === 'NotAllowedError') {
      error('Microphone access was not allowed. You can continue without voice samples.');
    } else {
      error('Could not start the microphone. You can continue without voice samples.');
    }
  }
}

for (let index = 0; index < VOICE_SAMPLE_COUNT; index++) {
  $('voiceRecordBtn' + index).addEventListener('click', () => startVoiceRecording(index));
  $('deleteVoiceBtn' + index).addEventListener('click', () => clearVoiceSample(index));
}

async function blobToBase64(blob) {
  if (!blob) return '';
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    };
    reader.onerror = () => reject(new Error('Could not read the voice sample.'));
    reader.readAsDataURL(blob);
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
    const voicePayload = [];
    for (let index = 0; index < VOICE_SAMPLE_COUNT; index++) {
      const sample = voiceSamples[index];
      if (!sample.blob) continue;
      voicePayload.push({
        index,
        durationMs:Math.min(VOICE_MAX_MS, Math.max(0, Math.round(sample.durationMs))),
        mime:normalizeVoiceMime(sample.mime || sample.blob.type || 'audio/webm'),
        audioData:await blobToBase64(sample.blob)
      });
    }

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
      voiceSamples:voicePayload,
      voiceDelivery:{
        consentPhraseWords:14,
        speakingRateFactor:voicePayload[0]?.durationMs
          ? Math.min(1.20,Math.max(0.80,5500/voicePayload[0].durationMs))
          : 1
      }
    });

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = '';
    }
    clearFileInputs();
    selectedFile = null;
    resetAllVoiceSamples();

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
  stopVoiceTimer();
  stopVoiceStream();
  voiceSamples.forEach(sample => {
    if (sample.url) URL.revokeObjectURL(sample.url);
  });
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});

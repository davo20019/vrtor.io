import manifest from './audio-manifest.json' with { type: 'json' };

const assets = import.meta.glob('./audio/*.mp3', { eager: true, query: '?url', import: 'default' });

export function createAudio(onChange) {
  let reference = null, playback = null, recorder = null, stream = null;
  let meterContext = null, analyser = null, samples = null;
  function stopMeter() {
    analyser = samples = null;
    meterContext?.close().catch(() => {}); meterContext = null;
  }
  function startMeter(input) {
    try {
      meterContext = new AudioContext();
      analyser = meterContext.createAnalyser(); analyser.fftSize = 512;
      samples = new Float32Array(analyser.fftSize);
      meterContext.createMediaStreamSource(input).connect(analyser);
      meterContext.resume().catch(() => {});
    } catch { stopMeter(); } // Recording still works if audio metering is unavailable.
  }
  function level() {
    if (!analyser || !state.recording) return 0;
    analyser.getFloatTimeDomainData(samples);
    return Math.min(1, Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length) * 5);
  }
  let blobUrl = null, timer = null, generation = 0, disposed = false;
  const state = { playing: false, recording: false, requesting: false, hasRecording: false, message: '' };
  const update = () => { if (!disposed) onChange(state); };
  const stopPlayback = () => {
    reference?.pause(); playback?.pause();
    reference = playback = null;
    state.playing = false;
  };
  const clearRecording = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = null;
    state.hasRecording = false;
  };
  function cancel() {
    generation++; stopMeter();
    clearTimeout(timer);
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    stream = recorder = null;
    state.recording = state.requesting = false;
    stopPlayback(); clearRecording();
    state.message = '';
  }
  async function play(text, accent = 'American English', slow = false) {
    if (state.recording || state.requesting) return false;
    stopPlayback();
    const source = assets[manifest[`${accent}:${text}`]];
    if (!source) {
      state.message = 'No audio example for this item. Open its Learn English Sounds guide.';
      update(); return false;
    }
    const current = new Audio(source);
    const token = generation;
    reference = current;
    current.playbackRate = slow ? 0.8 : 1;
    current.preservesPitch = true;
    state.playing = true;
    state.message = 'Listening…'; update();
    current.onended = () => {
      if (reference !== current) return;
      reference = null; state.playing = false; state.message = ''; update();
    };
    try { await current.play(); return token === generation && reference === current; }
    catch {
      if (reference !== current) return false;
      reference = null; state.playing = false;
      state.message = 'Audio could not play. Press Listen to try again.'; update(); return false;
    }
  }
  async function record(onSaved) {
    if (state.recording) { recorder?.stop(); return; }
    if (state.requesting) return;
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      state.message = 'Recording is unavailable here. Say the word aloud, or try a browser with microphone support.';
      update(); return;
    }
    stopPlayback(); clearRecording();
    const token = ++generation;
    state.requesting = true; state.message = 'Allow microphone access to record.'; update();
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (token !== generation || disposed) { input.getTracks().forEach((t) => t.stop()); return; }
      stream = input; startMeter(input);
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
      const current = new MediaRecorder(input, mimeType ? { mimeType } : undefined);
      recorder = current;
      const chunks = [];
      current.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      current.onstop = () => {
        clearTimeout(timer);
        input.getTracks().forEach((track) => track.stop());
        if (token !== generation || disposed) return;
        stopMeter(); recorder = stream = null;
        state.recording = false;
        if (chunks.length) {
          blobUrl = URL.createObjectURL(new Blob(chunks, { type: current.mimeType }));
          state.hasRecording = true;
          state.message = 'Saved for this exercise. Compare your recording with the example.';
          onSaved();
        } else state.message = 'No audio captured. Try recording again.';
        update();
      };
      current.onerror = () => {
        cancel(); state.message = 'Recording failed. Try again.'; update();
      };
      current.start();
      state.requesting = false; state.recording = true;
      state.message = 'Recording… Speak now. Stops after 8 seconds.'; update();
      timer = setTimeout(() => { if (current.state === 'recording') current.stop(); }, 8000);
    } catch (error) {
      if (token !== generation) return;
      stream?.getTracks().forEach((track) => track.stop());
      stopMeter(); stream = recorder = null;
      state.requesting = state.recording = false;
      state.message = error.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow it in browser settings; in a headset, try recording once before entering VR.'
        : 'Could not start the microphone. Check your input device and try again.';
      update();
    }
  }
  async function playRecording() {
    if (!blobUrl || state.recording || state.requesting) return;
    stopPlayback();
    const current = new Audio(blobUrl);
    playback = current; state.playing = true; state.message = 'Your recording…'; update();
    current.onended = () => {
      if (playback !== current) return;
      playback = null; state.playing = false; state.message = ''; update();
    };
    try { await current.play(); }
    catch {
      if (playback !== current) return;
      playback = null; state.playing = false; state.message = 'Playback failed. Try recording again.'; update();
    }
  }
  return { state, play, record, playRecording, cancel, level, dispose() { cancel(); disposed = true; } };
}

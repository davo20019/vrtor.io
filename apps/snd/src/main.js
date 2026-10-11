import { Engine, ArcRotateCamera, Viewport } from '@babylonjs/core';
import {
  createCard, createXr, xrSupported, createMenuControls, continueInVr,
  createPresence, mountPresenceControls, presenceCard, orbitPose, xrPose, roomsCard,
} from '@vrtor/xr-shell';
import { buildWorld, V } from './world.js';
import { GUIDES, GUIDE_BY_ID, LESSONS, guideUrl, makeRound, initialSelection } from './lessons.js';
import { readProgress, saveProgress, completeRound, addRecording, reviewLesson } from './progress.js';
import { createAudio } from './audio.js';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const ui = {
  canvas: $('#scene'), loading: $('.loading'), card: $('.card'), kicker: $('.card-kicker'),
  title: $('.card-title'), body: $('.card-body'), fact: $('.card-fact'),
  choices: $('.card-choices'), actions: $('.card-actions'), status: $('.audio-status'), vr: $('[data-enter-vr]'),
};
const engine = new Engine(ui.canvas, true, { xrCompatible: true, stencil: true }, true);
let world, camera, panel, rig, presence;
let view = 'home', previousView = 'home', lesson = LESSONS[0], selectedGuide = GUIDES[0];
let round = [], question = 0, correct = 0, response = null, heard = false;
let mouthSide = 0, speakIndex = 0, libraryPage = 0, libraryCategory = 'All', cardOpen = true;
let progress;
try { progress = readProgress(localStorage); } catch { progress = {}; }
let storageAvailable = true;
const audio = createAudio(() => { if (panel) render(false); });
const inXr = () => !!rig?.inXr();
const button = (label, onClick, primary = false) => ({ label, onClick, primary });
const mappedMouth = { 'short-i': 'ih', 'long-e': 'ee', 'short-a': 'ae', 'short-u': 'uh', 'th-voiceless': 'th', s: 's', v: 'v', b: 'b' };
const categories = ['All', 'Vowels', 'Consonants', 'Diphthongs'];

function persist() {
  try { storageAvailable = saveProgress(localStorage, progress); } catch { storageAvailable = false; }
}
function setQuery(values = {}) {
  const params = new URLSearchParams(location.search);
  params.delete('lesson'); params.delete('sound');
  for (const [key, value] of Object.entries(values)) params.set(key, value);
  history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
}
function navigate(next) {
  audio.cancel(); view = next; cardOpen = true; render();
}
function home() { setQuery(); navigate('home'); }
function begin(id) {
  lesson = LESSONS.find((l) => l.id === id) ?? LESSONS[0];
  round = []; question = correct = speakIndex = mouthSide = 0; response = null; heard = false;
  setQuery({ lesson: lesson.id }); navigate('preview');
}
function openGuide(id) {
  selectedGuide = GUIDE_BY_ID[id] ?? GUIDES[0];
  setQuery({ sound: selectedGuide.id }); navigate('guide');
}
function startRound() {
  round = makeRound(lesson); question = correct = 0; response = null; heard = false;
  navigate('listen');
}
async function listen(slow = false) {
  const current = round[question];
  if (!current || view !== 'listen') return;
  const played = await audio.play(current.word, 'American English', slow);
  if (played && view === 'listen' && current === round[question]) { heard = true; render(false); }
}
function choose(side) {
  if (!cardOpen) cardOpen = true;
  if (view === 'preview') { mouthSide = side; audio.play(lesson.words[side]); render(false); return; }
  if (view === 'mouth') { mouthSide = side; render(false); return; }
  if (view !== 'listen' || response !== null) return;
  if (!heard) { audio.state.message = 'Press Listen before choosing.'; render(false); return; }
  const q = round[question];
  response = side;
  if (side === q.answer) correct++;
  audio.cancel(); view = 'feedback'; render(false);
}
function nextQuestion() {
  if (question + 1 >= round.length) {
    progress = completeRound(progress, lesson.id, correct); persist(); mouthSide = 0; navigate('mouth');
  } else { question++; response = null; heard = false; navigate('listen'); }
}
function speakingText() { return speakIndex < 2 ? lesson.words[speakIndex] : lesson.sentences[speakIndex - 2]; }
function record(id) {
  // Practice never broadcasts a recording to other visitors. Talking stays muted afterward.
  if (presence?.state.micOn) presence.setMic(false);
  audio.record(() => { progress = addRecording(progress, id); persist(); });
}
function recordLabel() {
  return audio.state.recording ? 'Stop recording' : audio.state.requesting ? 'Waiting for mic…' : 'Record myself';
}
async function visitGuide(id) {
  audio.cancel();
  try { await rig?.exit(); } catch { /* Navigation also ends the XR session. */ }
  location.assign(guideUrl(id));
}
function libraryItems() {
  return GUIDES.filter((g) => libraryCategory === 'All' ||
    (libraryCategory === 'Vowels' && g.category.startsWith('Vowel')) ||
    (libraryCategory === 'Consonants' && g.category === 'Consonant') ||
    (libraryCategory === 'Diphthongs' && g.category.includes('Diphthong')));
}
function showLibrary() { setQuery(); libraryPage = 0; navigate('library'); }
function people() { previousView = view; navigate('people'); }
function content() {
  const p = progress[lesson.id];
  const recordingActions = (text, accent, id) => [
    button('Listen to example', () => audio.play(text, accent)),
    button(recordLabel(), () => record(id), true),
    ...(audio.state.hasRecording ? [button('Play my recording', () => audio.playRecording())] : []),
  ];
  if (view === 'rooms') return roomsCard('snd', rig, button, () => navigate(previousView));
  if (view === 'people') return presenceCard(presence, button, () => navigate(previousView));
  if (view === 'home') return {
    kicker: 'English sounds · A hands-on lab', title: 'Hear the difference. Find your voice.',
    body: 'Start with two sounds that are easy to confuse. Listen, choose, see the mouth position, then record yourself. Five minutes. One small discovery.',
    fact: 'American English lessons · No sign-in needed',
    choices: LESSONS.map((l, i) => button(`${String(i + 1).padStart(2, '0')}  ${l.title}`, () => begin(l.id))),
    actions: [button('Start with ship / sheep', () => begin('ship-sheep'), true), button('All 44 guides', showLibrary)],
  };
  if (view === 'preview') return {
    kicker: 'Step 1 / Listen together', title: lesson.title,
    body: `These words differ by one sound: /${lesson.symbols[0]}/ and /${lesson.symbols[1]}/. Listen to each example, or tap the two pedestals. Then try six listening questions.`,
    fact: lesson.id === 'thin-sin' ? 'The thin book and abstract ring are memory cues. This lesson also uses think / sink and thumb / sum.' : 'Listen for the sound, rather than the spelling.',
    choices: lesson.words.map((word, i) => button(`/${lesson.symbols[i]}/ · ${word}`, () => choose(i))),
    actions: [button('Back', home), button('Start listening game', startRound, true)],
  };
  if (view === 'listen') {
    const q = round[question], words = lesson.pairs[q.pairIndex];
    return {
      kicker: `Step 2 / Listening · ${question + 1} of ${round.length}`, title: 'What did you hear?',
      body: 'Press Listen, then choose the word you heard. You can replay the example as often as you need.',
      fact: 'Choose with a button or point at the matching pedestal.',
      choices: words.map((word, i) => button(word, () => choose(i))),
      actions: [button('Listen', () => listen(), true), button('Listen slower', () => listen(true))],
    };
  }
  if (view === 'feedback') {
    const q = round[question], right = response === q.answer;
    return {
      kicker: `Listening · ${question + 1} of ${round.length}`, title: right ? 'You heard it!' : 'Listen to the contrast.',
      body: `The word was “${q.word}” — /${lesson.symbols[q.answer]}/. ${right ? 'Notice the sound that made the difference.' : lesson.tip}`,
      fact: `${correct} correct so far. ${right ? 'Keep going.' : 'Mistakes help you find what to practice.'}`,
      choices: lesson.pairs[q.pairIndex].map((word) => button(`Hear ${word}`, () => audio.play(word))),
      actions: [button(question === round.length - 1 ? 'See the mouth position' : 'Next question', nextQuestion, true)],
    };
  }
  if (view === 'mouth') return {
    kicker: 'Step 3 / See the sound', title: `/${lesson.symbols[mouthSide]}/ as in ${lesson.words[mouthSide]}`,
    body: lesson.tip,
    fact: 'The side view shows tongue, teeth and lips. Mint dots illustrate airflow. This is a simplified demonstration.',
    choices: lesson.words.map((word, i) => button(`Show /${lesson.symbols[i]}/ · ${word}`, () => { mouthSide = i; render(false); })),
    actions: [button('Hear this sound', () => audio.play(lesson.words[mouthSide])), button('Practice speaking', () => { speakIndex = 0; navigate('speak'); }, true)],
  };
  if (view === 'speak') return {
    kicker: `Step 4 / Speak & compare · ${speakIndex + 1} of 4`, title: speakingText(),
    body: 'Listen, say it aloud, then record yourself. Play your recording and the example one after the other. What would you change on your next attempt?',
    fact: 'Only you hear this practice. Recordings stay in this tab. Speaking practice is self-review.',
    actions: [...recordingActions(speakingText(), 'American English', lesson.id), button(speakIndex === 3 ? 'Finish lesson' : 'Next practice', () => {
      if (speakIndex < 3) { speakIndex++; navigate('speak'); } else navigate('complete');
    })],
  };
  if (view === 'complete') return {
    kicker: 'Lesson complete', title: `${correct} / 6 sounds recognized`,
    body: `You practiced /${lesson.symbols[0]}/ and /${lesson.symbols[1]}/ in words and sentences. ${correct < 5 ? 'Try this contrast again in your next session.' : 'Try another contrast, then come back for a quick review.'}`,
    fact: `Listening best: ${p?.best ?? 0}/6 · Speaking: ${p?.recordings ?? 0} recordings made. ${storageAvailable ? 'Progress saved in this browser.' : 'Browser storage is unavailable; progress lasts for this visit.'}`,
    actions: [button('Try again', () => begin(lesson.id)), button('Next recommended', () => begin(reviewLesson(progress, LESSONS).id), true)],
    choices: lesson.sounds.map((id) => button(`Guide: /${GUIDE_BY_ID[id].ipa}/`, () => visitGuide(id))),
  };
  if (view === 'library') {
    const list = libraryItems(), pages = Math.ceil(list.length / 6);
    libraryPage = Math.max(0, Math.min(libraryPage, pages - 1));
    return {
      kicker: `Sound library / ${libraryCategory} · ${libraryPage + 1} of ${pages}`, title: 'Explore every sound.',
      body: 'Choose a guide to hear an example, read the mouth instructions, and record yourself. Regional entries are labeled in their guide.',
      choices: list.slice(libraryPage * 6, (libraryPage + 1) * 6).map((g) => button(`/${g.ipa}/ · ${g.example}`, () => openGuide(g.id))),
      actions: [button('Category', () => { libraryCategory = categories[(categories.indexOf(libraryCategory) + 1) % categories.length]; libraryPage = 0; render(false); }),
        ...(libraryPage > 0 ? [button('Previous', () => { libraryPage--; render(false); })] : []),
        ...(libraryPage < pages - 1 ? [button('Next page', () => { libraryPage++; render(false); }, true)] : [])],
    };
  }
  if (view === 'guide') {
    const g = selectedGuide, contrast = LESSONS.find((l) => l.sounds.includes(g.id));
    return {
      kicker: `${g.category} / ${g.accent}`, title: `/${g.ipa}/ as in ${g.example}`,
      body: g.mouth,
      fact: `Examples: ${g.words.join(', ')}. ${g.id === 'long-u' ? '/ju/ combines a consonant glide and a vowel.' : ''}`,
      actions: [...recordingActions(g.example, g.accent, `guide-${g.id}`), button('Full guide ↗', () => visitGuide(g.id))],
      choices: contrast ? [button('Practice this contrast', () => begin(contrast.id))] : [],
    };
  }
  if (view === 'progress') return {
    kicker: 'Your practice / Saved on this device', title: 'One sound at a time.',
    body: 'Listening shows your best score out of six. Speaking shows how many recordings you made; it is not a pronunciation score.',
    fact: storageAvailable ? 'Pick a contrast to practice again.' : 'Browser storage is unavailable. Progress lasts for this visit.',
    choices: LESSONS.map((l) => {
      const p = progress[l.id];
      return button(`${l.words.join(' / ')} · ${p?.best ?? 0}/6 · ${p?.recordings ?? 0} recordings`, () => begin(l.id));
    }),
    actions: [button('Lessons', home), button('Review a contrast', () => begin(reviewLesson(progress, LESSONS).id), true)],
  };
  return {};
}

let sceneKey = '';
function updateWorld() {
  const q = round[question];
  const pair = ['listen', 'feedback'].includes(view) && q ? lesson.pairs[q.pairIndex] : lesson.words;
  const key = `${view}:${lesson.id}:${pair.join('-')}:${mouthSide}:${selectedGuide.id}`;
  if (key === sceneKey) return;
  sceneKey = key;
  const useObjects = pair[0] === lesson.words[0];
  world.setChoices(useObjects ? lesson.objects : ['symbol', 'symbol'], pair);
  const show = ['home', 'preview', 'mouth', 'speak', 'complete'].includes(view) || (view === 'guide' && mappedMouth[selectedGuide.id]);
  world.showMouth(!!show);
  if (view === 'guide' && mappedMouth[selectedGuide.id]) world.setMouth(mappedMouth[selectedGuide.id], selectedGuide.ipa);
  else world.setMouth(lesson.mouth[mouthSide], lesson.symbols[mouthSide]);
}

function render(place = true) {
  if (!panel) return;
  updateWorld();
  const data = content();
  if (inXr()) {
    ui.card.hidden = true;
    if (!cardOpen) { panel.hide(); return; }
    const busy = audio.state.recording || audio.state.requesting;
    const tools = busy ? [] : [button('Lessons', home), button('Library', showLibrary), button('Progress', () => navigate('progress')), button('People', people), button('Rooms', () => { previousView = view; navigate('rooms'); })];
    panel.setContent({ ...data, fact: audio.state.message || data.fact, tools, onClose: () => {
      if (busy) return;
      cardOpen = false; render(false);
    } });
    if (place || !panel.visible) {
      const f = rig.headForward(), a = -0.55;
      panel.place(rig.headPosition(), V(f.x * Math.cos(a) + f.z * Math.sin(a), 0, -f.x * Math.sin(a) + f.z * Math.cos(a)), null, { distance: 1.35 });
    }
    return;
  }
  panel.hide(); ui.card.hidden = false;
  ui.kicker.textContent = data.kicker;
  ui.title.textContent = data.title;
  ui.body.textContent = data.body;
  ui.fact.textContent = data.fact || '';
  ui.fact.hidden = !data.fact;
  ui.status.textContent = audio.state.message;
  const createButton = (a) => {
    const element = document.createElement('button'); element.type = 'button';
    element.textContent = a.label; element.className = a.primary ? 'primary' : '';
    element.disabled = audio.state.requesting || (audio.state.recording && a.label !== 'Stop recording');
    element.addEventListener('click', a.onClick); return element;
  };
  ui.choices.replaceChildren(...(data.choices ?? []).map(createButton));
  ui.actions.replaceChildren(...(data.actions ?? []).map(createButton));
  $('[data-home]').disabled = $('[data-library]').disabled = $('[data-progress]').disabled = audio.state.recording || audio.state.requesting;
}

async function start() {
  world = buildWorld(engine, choose);
  camera = new ArcRotateCamera('lab camera', -Math.PI / 2, 1.38, 8.4, V(0, 1.6, 1.1), world.scene);
  camera.lowerRadiusLimit = 4; camera.upperRadiusLimit = 11;
  camera.lowerBetaLimit = 0.55; camera.upperBetaLimit = 1.65;
  camera.lowerAlphaLimit = -Math.PI * 0.8; camera.upperAlphaLimit = -Math.PI * 0.2;
  camera.panningSensibility = 0; camera.wheelDeltaPercentage = 0.01;
  camera.minZ = 0.05; camera.attachControl(ui.canvas, true);
  const layout = () => {
    engine.resize();
    camera.viewport = innerWidth > 800 ? new Viewport(0.25, 0, 0.75, 1) : innerWidth > 520 ? new Viewport(0.3, 0, 0.7, 1) : new Viewport(0, 0, 1, 1);
  };
  addEventListener('resize', layout); layout();
  world.animateMouth(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  panel = createCard(world.scene, { name: 'sound-lab-menu', width: 0.86, height: 1.0 });
  let refreshPresence = () => {};
  presence = createPresence(world.scene, {
    subject: 'snd', getPose: () => inXr() ? xrPose(rig) : orbitPose(camera, [world.floor]),
    onChange(state) {
      // Even if B/Y turns on visitor voice, a practice recording stays private.
      if ((audio.state.recording || audio.state.requesting) && state.micOn) presence?.setMic(false);
      refreshPresence(state);
      if (view === 'people') render(false);
    },
  });
  refreshPresence = mountPresenceControls(presence, $('.presence-controls'));
  refreshPresence(presence.state);
  try {
    if (await xrSupported()) rig = await createXr(world.scene, {
      floorMeshes: [world.floor], start: { position: V(0, 0, -2.8), lookAt: V(0, 1.5, 1.1) }, walk: false,
    });
  } catch (error) { console.warn('[snd] VR unavailable', error); }
  if (rig) {
    ui.vr.hidden = false;
    for (const p of panel.panels) rig.mirrorPanel(p, { interactive: true });
    rig.onChange((entered) => {
      document.body.classList.toggle('in-xr', entered);
      if (!entered) { audio.cancel(); render(); }
    });
    let enteredFrames = 0;
    rig.xr.baseExperience.sessionManager.onXRFrameObservable.add(() => {
      if (!inXr()) { enteredFrames = 0; return; }
      if (++enteredFrames === 6) { cardOpen = true; render(); }
    });
    createMenuControls(world.scene, rig, panel, { open: () => { cardOpen = true; render(); }, close: () => {
      if (audio.state.recording || audio.state.requesting) return;
      cardOpen = false; render(false);
    } });
    presence.attachXr(rig.xr);
  }
  const selection = initialSelection(location.search);
  if (selection.lesson) begin(selection.lesson);
  else if (selection.sound) openGuide(selection.sound);
  else render();
  continueInVr(rig, ui.vr);
  ui.loading.hidden = true;
  $('[data-home]').disabled = $('[data-library]').disabled = $('[data-progress]').disabled = false;
  engine.runRenderLoop(() => world.scene.render());
  // Read-only inspection makes rendering and state smoke checks possible without a headset.
  window.__snd = { scene: world.scene, panel, get state() {
    return { view, lesson: lesson.id, question, correct, heard, response, speakIndex, mouthSide, progress, audio: { ...audio.state } };
  } };
}

$('[data-home]').addEventListener('click', home);
$('[data-library]').addEventListener('click', showLibrary);
$('[data-progress]').addEventListener('click', () => navigate('progress'));
ui.vr.addEventListener('click', async () => {
  ui.vr.disabled = true;
  try { audio.cancel(); await rig.enter(); }
  catch (error) { console.warn('[snd] Enter VR failed', error); audio.state.message = 'VR could not start. Try Enter VR again, or keep practicing here.'; render(false); }
  finally { ui.vr.disabled = false; }
});
// Keep the audio controller usable when this page returns from the back/forward cache.
addEventListener('pagehide', () => audio.cancel());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { audio.cancel(); render(false); }
});
$('[data-retry]').addEventListener('click', () => location.reload());
start().catch((error) => {
  console.error('[snd] Sound Lab failed to start', error);
  $('.loading p').textContent = 'The Sound Lab could not load. Try again, or open the sound guides on Learn English Sounds.';
  $('[data-retry]').hidden = false;
});

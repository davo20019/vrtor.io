export const PROGRESS_KEY = 'vrtor:snd:progress:v1';

function count(value) { return Number.isSafeInteger(value) && value >= 0 ? value : 0; }

export function readProgress(storage) {
  try {
    const value = JSON.parse(storage.getItem(PROGRESS_KEY));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id]) => /^[a-z-]+$/.test(id)).map(([id, p]) => [id, {
      sessions: count(p?.sessions), best: Math.min(6, count(p?.best)),
      latest: Math.min(6, count(p?.latest)), recordings: count(p?.recordings),
    }]));
  } catch { return {}; }
}

export function saveProgress(storage, progress) {
  try { storage.setItem(PROGRESS_KEY, JSON.stringify(progress)); return true; }
  catch { return false; }
}

export function completeRound(progress, id, correct) {
  const old = progress[id] ?? {};
  const score = Math.min(6, count(correct));
  return { ...progress, [id]: {
    sessions: count(old.sessions) + 1, best: Math.max(count(old.best), score),
    latest: score, recordings: count(old.recordings),
  } };
}

export function addRecording(progress, id) {
  const old = progress[id] ?? { sessions: 0, best: 0, latest: 0 };
  return { ...progress, [id]: { ...old, recordings: count(old.recordings) + 1 } };
}

export function reviewLesson(progress, lessons) {
  return [...lessons].sort((a, b) => {
    const pa = progress[a.id], pb = progress[b.id];
    // Untried lessons come first; otherwise review the weakest most recent result.
    return (pa?.sessions ? pa.latest : -1) - (pb?.sessions ? pb.latest : -1);
  })[0];
}

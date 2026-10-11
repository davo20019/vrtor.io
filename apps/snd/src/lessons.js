import guides from './guides.json' with { type: 'json' };

export const GUIDES = guides;
export const GUIDE_BY_ID = Object.fromEntries(guides.map((g) => [g.id, g]));
export const LESSONS = [
  {
    id: 'ship-sheep', title: 'Ship or sheep?', sounds: ['short-i', 'long-e'],
    symbols: ['ɪ', 'iː'], words: ['ship', 'sheep'], objects: ['ship', 'sheep'],
    pairs: [['ship', 'sheep'], ['sit', 'seat'], ['bit', 'beat']],
    sentences: ['The ship is big.', 'The sheep is eating.'],
    tip: 'For /ɪ/, relax your tongue a little lower. For /iː/, bring it higher and farther forward. Listen to the vowel quality as well as its length.',
    mouth: ['ih', 'ee'],
  },
  {
    id: 'cat-cut', title: 'Cat or cut?', sounds: ['short-a', 'short-u'],
    symbols: ['æ', 'ʌ'], words: ['cat', 'cut'], objects: ['cat', 'scissors'],
    pairs: [['cat', 'cut'], ['cap', 'cup'], ['hat', 'hut']],
    sentences: ['The cat is on the mat.', 'Cut the paper.'],
    tip: 'For /æ/, open your jaw and keep your tongue forward. For /ʌ/, relax the tongue toward the center. Keep both vowels voiced.',
    mouth: ['ae', 'uh'],
  },
  {
    id: 'thin-sin', title: 'Thin or sin?', sounds: ['th-voiceless', 's'],
    symbols: ['θ', 's'], words: ['thin', 'sin'], objects: ['thin', 'symbol'],
    pairs: [['thin', 'sin'], ['think', 'sink'], ['thumb', 'sum']],
    sentences: ['The book is thin.', 'Think before you speak.'],
    tip: 'For /θ/, put your tongue tip lightly between your front teeth and let air pass. For /s/, keep the tongue behind the teeth. Neither sound uses vocal-fold vibration.',
    mouth: ['th', 's'],
  },
  {
    id: 'vest-best', title: 'Vest or best?', sounds: ['v', 'b'],
    symbols: ['v', 'b'], words: ['vest', 'best'], objects: ['vest', 'trophy'],
    pairs: [['vest', 'best'], ['very', 'berry'], ['vote', 'boat']],
    sentences: ['The vest is blue.', 'Do your best.'],
    tip: 'For /v/, touch your upper teeth to your lower lip and keep the air flowing. For /b/, close both lips, then release. Both sounds are voiced.',
    mouth: ['v', 'b'],
  },
];

export function guideUrl(id) {
  if (!GUIDE_BY_ID[id]) return 'https://www.learnenglishsounds.com/en';
  const url = new URL(`https://www.learnenglishsounds.com/en/sounds/${id}`);
  url.searchParams.set('ref', 'vrtor');
  url.searchParams.set('utm_source', 'vrtor.io');
  url.searchParams.set('utm_medium', 'sound-lab');
  return url.href;
}

// Balance both sounds across three pairs, then shuffle; answers never depend on spelling cues.
export function makeRound(lesson, random = Math.random) {
  const questions = lesson.pairs.flatMap((pair, pairIndex) => pair.map((word, answer) => ({ pairIndex, word, answer })));
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  return questions;
}

export function initialSelection(search) {
  const params = new URLSearchParams(search);
  const sound = params.get('sound');
  const lesson = params.get('lesson');
  if (lesson && LESSONS.some((l) => l.id === lesson)) return { lesson, sound: null };
  if (sound && GUIDE_BY_ID[sound]) return { sound, lesson: null };
  return { lesson: null, sound: null };
}

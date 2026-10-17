// What a learner needs on a part's card, and finding parts by name.
//
// models/learn.json (assets-src/body/learn_*.py, ship.py): for each plain name (a part's name without its side or
// numbering: "masseter", "femur"), its Latin name and its name in Spanish, French, Portuguese and Italian from
// Terminologia Anatomica 2 (Z-Anatomy's TA2, CC BY-SA 4.0), and the lead of its Wikipedia article (CC BY-SA 4.0,
// linked on every card). A part with neither shares what it is part of: "Part of the right coronary artery: ...".
const BASE = import.meta.env.BASE_URL;

/** The plain name a part shares with its twin on the other side: 'Superficial part of left masseter, 2 of 3' -> 'superficial part of masseter'. */
export function plainName(name) {
  return name
    .replace(/, (\d+ of \d+|main part)$/, '')
    .replace(/\b(left|right)\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** How the last-resort article is introduced, by tissue. */
const KIND_LABEL = {
  node: 'lymph nodes', artery: 'arteries', vein: 'veins', nerve: 'nerves', muscle: 'skeletal muscle', ligament: 'ligaments', bone: 'bone',
  cartilage: 'cartilage', fascia: 'fascia', bursa: 'bursae', capsule: 'joint capsules', bronchus: 'the bronchi', lung: 'the lungs',
  valve: 'heart valves', brain: 'the cerebral cortex', whitematter: 'white matter', gut: 'the gut', liver: 'the liver', tooth: 'teeth',
  gland: 'glands',
};

const LANGS = { es: 'Español', fr: 'Français', pt: 'Português', it: 'Italiano' };
/** The visitor's language among TA2's, if not English. */
const lang = (navigator.languages ?? [navigator.language]).map((l) => l.slice(0, 2)).find((l) => LANGS[l] || l === 'en');

/** The first sentences of an article's lead, up to about `max` characters. */
function lead(text, max = 330) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  let out = '';
  for (const s of sentences) {
    if (out && out.length + s.length > max) break;
    out += s;
  }
  return out.trim();
}

export async function loadLearning(body, version) {
  let data = { names: {}, wiki: {} };
  try {
    data = await (await fetch(`${BASE}models/learn.json?v=${version}`)).json();
  } catch (err) {
    console.warn('[bdy] no learning data', err);
  }
  const { nodes } = body;

  /** What the card says about node `id`: names, a description, its source. */
  function about(id) {
    const own = plainName(nodes[id].name);
    const names = data.names[own] ?? null;
    let wiki = data.wiki[own] ?? null;
    let from = null;
    // An article on something related, not this very part (a rib's is the rib cage's): said so, by its title.
    let article = wiki?.about ? wiki.title.replace(/ \((anatomy|vertebrate anatomy)\)$/, '') : null;
    // No article of its own: what it is part of, nearest first (a coronary branch: the coronary artery).
    if (!wiki) {
      for (let i = body.parentOf(id); i !== null && i > 0; i = body.parentOf(i)) {
        if (nodes[i].system && body.parentOf(i) === 0) break;          // not the whole system
        const w = data.wiki[plainName(nodes[i].name)];
        if (w) {
          wiki = w;
          from = nodes[i].name;
          break;
        }
      }
    }
    // Nothing of its own or above it: what kind of thing it is ("About lymph nodes: ...").
    let kind = null;
    if (!wiki && nodes[id].tissue && data.wiki['#' + nodes[id].tissue]) {
      wiki = data.wiki['#' + nodes[id].tissue];
      kind = KIND_LABEL[nodes[id].tissue] ?? wiki.title.toLowerCase();
    }
    return {
      article,
      kind,
      latin: names?.la ?? null,
      local: lang && LANGS[lang] && names?.[lang] ? { label: LANGS[lang], name: names[lang] } : null,
      text: wiki ? lead(wiki.text, from ? 220 : 330) : null,
      from,
      source: wiki ? { title: wiki.title, url: wiki.url } : null,
    };
  }

  // ---- search: every part and group by its name, its Latin, and its name in the visitor's language
  const index = nodes.map((n) => {
    const p = plainName(n.name);
    const nm = data.names[p];
    return { id: n.id, key: [n.name, nm?.la, lang && nm?.[lang]].filter(Boolean).join(' | ').toLowerCase(), group: !n.el };
  });
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const e of index) e.key = fold(e.key);

  /** Up to `limit` node ids matching `query`: names that start with it first, then words that do, then the rest; groups before their parts. */
  function search(query, limit = 8) {
    const q = fold(query.trim());
    if (q.length < 2) return [];
    const scored = [];
    for (const e of index) {
      const at = e.key.indexOf(q);
      if (at < 0) continue;
      const score = (at === 0 ? 0 : /[\s|(-]/.test(e.key[at - 1]) ? 1 : 2) * 10 + (e.group ? 0 : 1) + Math.min(e.key.length / 100, 0.9);
      scored.push([score, e.id]);
    }
    scored.sort((a, b) => a[0] - b[0]);
    return scored.slice(0, limit).map((s) => s[1]);
  }

  return { about, search };
}

/** Says a part's name aloud, in English, with the browser's own voice. */
export function speak(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

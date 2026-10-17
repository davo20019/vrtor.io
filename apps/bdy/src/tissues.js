// What each tissue looks like. The model's materials are stand-ins named t_<tissue> (assets-src/body/build.py);
// here each becomes a PBR material with the colour, gloss and wetness of the real thing, as it looks in a
// dissection or a surgical photo rather than an atlas's flat colours: bone ivory and matt, muscle a deep
// red-brown with a wet sheen, arteries a paler red than the purple-blue veins, the liver dark and glossy,
// nerves a dull cream, cartilage bluish and glassy. Colours are sRGB hex.
import { Color3, PBRMaterial } from '@babylonjs/core';

/** albedo, roughness, clearcoat (the wet film over living tissue, 0..1), alpha */
export const TISSUES = {
  bone:        { color: '#d8ccb0', rough: 0.72, coat: 0.0 },
  // Hyaline cartilage (the nose, the larynx, the ribs' ends): pearly white with a faint blue, glassy.
  cartilage:   { color: '#e2e6df', rough: 0.3, coat: 0.7 },
  ligament:    { color: '#e2dacb', rough: 0.4, coat: 0.5 },
  muscle:      { color: '#8a2b22', rough: 0.5, coat: 0.55 },
  heart:       { color: '#7e2a22', rough: 0.45, coat: 0.7 },
  valve:       { color: '#e4cfb2', rough: 0.4, coat: 0.6 },
  // The heart's chambers are casts of the blood in them: seen through, so the valves between them show.
  blood:       { color: '#5a0d10', rough: 0.25, coat: 0.8, alpha: 0.45 },
  artery:      { color: '#b8382c', rough: 0.38, coat: 0.7 },
  vein:        { color: '#4b2f5e', rough: 0.38, coat: 0.7 },
  nerve:       { color: '#e6d6a4', rough: 0.55, coat: 0.3 },
  brain:       { color: '#d3a49b', rough: 0.45, coat: 0.6 },
  whitematter: { color: '#eee2d2', rough: 0.45, coat: 0.5 },
  ventricle:   { color: '#9fc4d8', rough: 0.2, coat: 0.8, alpha: 0.55 },
  bronchus:    { color: '#e9cbbd', rough: 0.42, coat: 0.5 },
  // Seen through a little, so the airways and vessels inside each lobe show.
  lung:        { color: '#d9958e', rough: 0.6, coat: 0.5, alpha: 0.62 },
  liver:       { color: '#6a2117', rough: 0.3, coat: 0.9 },
  bile:        { color: '#5d7a33', rough: 0.3, coat: 0.8 },
  spleen:      { color: '#5c2235', rough: 0.35, coat: 0.8 },
  kidney:      { color: '#7c2d1f', rough: 0.35, coat: 0.8 },
  pancreas:    { color: '#e2b98a', rough: 0.5, coat: 0.6 },
  gland:       { color: '#9e4c36', rough: 0.4, coat: 0.7 },
  tongue:      { color: '#c46f6c', rough: 0.55, coat: 0.6 },
  stomach:     { color: '#d39a8a', rough: 0.4, coat: 0.7 },
  gut:         { color: '#dba596', rough: 0.4, coat: 0.7 },
  bladder:     { color: '#e1b7a2', rough: 0.4, coat: 0.7 },
  repro:       { color: '#cd8f84', rough: 0.45, coat: 0.6 },
  skin:        { color: '#c99877', rough: 0.55, coat: 0.15, sheen: 0.25 },
  hair:        { color: '#2c1e15', rough: 0.6, coat: 0.0, sheen: 0.4 },
  tooth:       { color: '#efe8d6', rough: 0.25, coat: 0.6 },
  lens:        { color: '#f4f2ea', rough: 0.05, coat: 1.0, alpha: 0.25 },
  // Lymph nodes: small, firm, a dull pinkish tan.
  node:        { color: '#cfa58c', rough: 0.5, coat: 0.5 },
  // Joint capsules, fascia and bursae are thin silvery sheets over what they hold: seen through.
  capsule:     { color: '#e6e0d2', rough: 0.35, coat: 0.6, alpha: 0.5 },
  fascia:      { color: '#ebe5d8', rough: 0.4, coat: 0.5, alpha: 0.4 },
  bursa:       { color: '#dce6ea', rough: 0.2, coat: 0.8, alpha: 0.45 },
  sclera:      { color: '#f0ebe0', rough: 0.25, coat: 0.9 },
  eyedark:     { color: '#2b1913', rough: 0.4, coat: 0.6 },
};

/** Shared PBR materials, one per tissue: { tissue: material }. `lite` drops the clear coat (the headset). */
export function createTissues(scene, { lite = false } = {}) {
  const mats = {};
  for (const [name, t] of Object.entries(TISSUES)) {
    const m = new PBRMaterial(`tissue-${name}`, scene);
    m.albedoColor = Color3.FromHexString(t.color).toLinearSpace();
    m.metallic = 0;
    m.roughness = t.rough;
    // Tissue reflects little light at a glance and a lot at a slant, like water: F0 of about 0.02-0.03.
    m.indexOfRefraction = 1.4;
    if (!lite && t.coat > 0) {
      m.clearCoat.isEnabled = true;
      m.clearCoat.intensity = t.coat;
      m.clearCoat.roughness = 0.18;
    }
    if (!lite && t.sheen) {
      m.sheen.isEnabled = true;
      m.sheen.intensity = t.sheen;
      m.sheen.color = Color3.FromHexString(t.color);
    }
    if (t.alpha !== undefined) {
      m.alpha = t.alpha;
      m.transparencyMode = PBRMaterial.MATERIAL_ALPHABLEND;
      m.backFaceCulling = true;
    }
    mats[name] = m;
  }
  return mats;
}

/** Turns the clear coat and sheen off (the headset) or back on, on every tissue material. */
export function setLite(scene, lite) {
  for (const m of scene.materials) {
    const t = m.name.startsWith('tissue-') ? TISSUES[m.name.slice(7)] : null;
    if (!t) continue;
    m.unfreeze();
    m.clearCoat.isEnabled = !lite && t.coat > 0;
    m.sheen.isEnabled = !lite && !!t.sheen;
    m.freeze();
  }
}

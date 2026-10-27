// How the heart's tissue reflects light. The colours are in the model (per vertex: muscle, fat, vessel walls,
// valves); this adds what a fresh heart shows up close: a wet, glossy surface (a clear coat over everything),
// fine relief and speckle in the tissue (3D noise on each vertex's rest position, so it stays on the tissue
// while it beats instead of sliding over it), and thin valve leaflets that let some light through.
import { Color3, MaterialDefines, MaterialPluginBase, PBRMaterial } from '@babylonjs/core';

const NOISE = /* glsl */ `
float tHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float tNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tHash(i), tHash(i + vec3(1,0,0)), f.x), mix(tHash(i + vec3(0,1,0)), tHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(tHash(i + vec3(0,0,1)), tHash(i + vec3(1,0,1)), f.x), mix(tHash(i + vec3(0,1,1)), tHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float tFbm(vec3 p) { return 0.55 * tNoise(p) + 0.3 * tNoise(p * 2.13) + 0.15 * tNoise(p * 4.37); }
`;

class TissueDefines extends MaterialDefines {
  TISSUE = false;
}

/** Relief (mm of noise scale, strength) and speckle per tissue: muscle fine-grained, fat in lobules. */
const LOOK = {
  ventricle: [0.9, 0.22, 0.12], atrium: [0.9, 0.2, 0.12], heart: [0.8, 0.22, 0.12],
  artery_wall: [1.4, 0.12, 0.06], vein_wall: [1.2, 0.1, 0.06], valve: [0.7, 0.08, 0.05],
  chordae: [0.5, 0.05, 0.04], artery: [0.8, 0.1, 0.06], vein: [0.8, 0.1, 0.06],
};

class TissuePlugin extends MaterialPluginBase {
  constructor(material, look) {
    super(material, 'Tissue', 200, new TissueDefines());
    this.look = look;
    this._enable(true);
  }
  prepareDefines(defines) { defines.TISSUE = true; }
  getClassName() { return 'TissuePlugin'; }
  getUniforms() {
    return { ubo: [{ name: 'tissueLook', size: 3, type: 'vec3' }], fragment: 'uniform vec3 tissueLook;' };
  }
  bindForSubMesh(ubo) { ubo.updateFloat3('tissueLook', this.look[0], this.look[1], this.look[2]); }
  getCustomCode(type) {
    if (type === 'vertex') {
      return {
        CUSTOM_VERTEX_DEFINITIONS: 'varying vec3 vRestPos; varying vec3 vWX; varying vec3 vWY; varying vec3 vWZ;',
        CUSTOM_VERTEX_MAIN_END: 'vRestPos = position; mat3 tw = mat3(finalWorld); vWX = normalize(tw[0]); vWY = normalize(tw[1]); vWZ = normalize(tw[2]);',
      };
    }
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `varying vec3 vRestPos; varying vec3 vWX; varying vec3 vWY; varying vec3 vWZ;\n${NOISE}`,
      // Relief: the noise's gradient tilts the normal (finite differences, in mm, turned into the world frame).
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
        {
          vec3 q = vRestPos / tissueLook.x; float e = 0.35;
          float n0 = tFbm(q);
          vec3 g = vec3(tFbm(q + vec3(e,0,0)) - n0, tFbm(q + vec3(0,e,0)) - n0, tFbm(q + vec3(0,0,e)) - n0) / e;
          vec3 gw = g.x * vWX + g.y * vWY + g.z * vWZ;
          gw -= dot(gw, normalW) * normalW;
          normalW = normalize(normalW - gw * tissueLook.y);
        }`,
      CUSTOM_FRAGMENT_UPDATE_ALBEDO: 'surfaceAlbedo *= 1.0 + (tFbm(vRestPos / (tissueLook.x * 0.6)) - 0.5) * 2.0 * tissueLook.z;',
    };
  }
}

/** Gives every material of the heart its tissue's look. Materials are named after their tissue (assemble.py). */
export function applyTissue(materials) {
  for (const mat of materials) {
    if (!(mat instanceof PBRMaterial)) continue;
    const t = mat.name;
    const look = LOOK[t] ?? LOOK.heart;
    new TissuePlugin(mat, look);
    // Wet: a thin, sharp clear coat over a softer tissue.
    mat.clearCoat.isEnabled = true;
    mat.clearCoat.intensity = t === 'valve' || t === 'chordae' ? 0.5 : 0.85;
    mat.clearCoat.roughness = 0.12;
    mat.metallic = 0;
    mat.environmentIntensity = 0.9;
    if (t === 'valve' || t === 'chordae') {
      // Thin leaflets and cords let light through, warmed by the tissue.
      mat.subSurface.isTranslucencyEnabled = true;
      mat.subSurface.translucencyIntensity = t === 'valve' ? 0.55 : 0.3;
      mat.subSurface.tintColor = Color3.FromHexString('#f2c9a0');
    }
  }
}

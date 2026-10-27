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

/** The activation wave's clock and strengths, set by main.js every frame. */
export const ELEC = { clock: 0, muscle: 0, conduction: 0.9 };

class TissueDefines extends MaterialDefines {
  TISSUE = false;
}

/** Relief (mm of noise scale, strength) and speckle per tissue: muscle fine-grained, fat in lobules. */
const LOOK = {
  ventricle: [0.9, 0.22, 0.12], atrium: [0.9, 0.2, 0.12], heart: [0.8, 0.22, 0.12],
  artery_wall: [1.4, 0.12, 0.06], vein_wall: [1.2, 0.1, 0.06], valve: [0.7, 0.08, 0.05],
  chordae: [0.5, 0.05, 0.04], artery: [0.8, 0.1, 0.06], vein: [0.8, 0.1, 0.06], conduction: [0.6, 0.05, 0.05],
};

class TissuePlugin extends MaterialPluginBase {
  constructor(material, look) {
    super(material, 'Tissue', 200, new TissueDefines());
    this.look = look;
    this._enable(true);
  }
  prepareDefines(defines) { defines.TISSUE = true; }
  getClassName() { return 'TissuePlugin'; }
  // Each vertex's activation time is in the first UV channel; Babylon only declares UVs for textured materials,
  // so the plugin asks for the attribute itself.
  getAttributes(attributes, scene, mesh) {
    if (mesh.isVerticesDataPresent('uv') && !attributes.includes('uv')) attributes.push('uv');
  }
  getUniforms() {
    return {
      ubo: [{ name: 'tissueLook', size: 3, type: 'vec3' }, { name: 'tissueElec', size: 3, type: 'vec3' }],
      fragment: 'uniform vec3 tissueLook; uniform vec3 tissueElec;',
    };
  }
  bindForSubMesh(ubo) {
    ubo.updateFloat3('tissueLook', this.look[0], this.look[1], this.look[2]);
    // x: the cycle's clock (ms), y: how strongly the activation wave shows on this tissue, z: unused
    ubo.updateFloat3('tissueElec', ELEC.clock, this.conduction ? ELEC.conduction : ELEC.muscle, 0);
  }
  getCustomCode(type) {
    if (type === 'vertex') {
      return {
        CUSTOM_VERTEX_DEFINITIONS: `varying vec3 vRestPos; varying vec3 vWX; varying vec3 vWY; varying vec3 vWZ; varying float vAct;
          #ifndef UV1
            attribute vec2 uv;
          #endif`,
        CUSTOM_VERTEX_MAIN_END: `vRestPos = position; mat3 tw = mat3(finalWorld); vWX = normalize(tw[0]); vWY = normalize(tw[1]); vWZ = normalize(tw[2]);
          vAct = uv.x * 1000.0;`,
      };
    }
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `varying vec3 vRestPos; varying vec3 vWX; varying vec3 vWY; varying vec3 vWZ; varying float vAct;\n${NOISE}`,
      // The activation wave: a vertex lights up as it is activated, then fades over about 60 ms.
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
        if (vAct >= 0.0 && tissueElec.y > 0.0) {
          float since = mod(tissueElec.x - vAct + 800.0, 800.0);
          float glow = exp(-since / 28.0) * smoothstep(0.0, 4.0, since);
          finalColor.rgb += vec3(1.0, 0.82, 0.45) * glow * tissueElec.y;
        }`,
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
    const plugin = new TissuePlugin(mat, look);
    plugin.conduction = t === 'conduction';
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

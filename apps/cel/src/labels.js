// Name tags, like a textbook diagram's: each floats out towards the cut-away opening from the part it names,
// with a thin line back to it, turns to face you, and follows its part when you take it out.
import { Color3, DynamicTexture, MeshBuilder, StandardMaterial, Vector3 } from '@babylonjs/core';
import { faceViewer } from '@vrtor/xr-shell';

const HEIGHT = 0.07;
const TEX_H = 96;

function tag(scene, text, i) {
  const font = `600 48px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  const probe = new DynamicTexture('probe', { width: 8, height: 8 }, scene);
  const ctx0 = probe.getContext();
  ctx0.font = font;
  const w = Math.ceil(ctx0.measureText(text).width) + 56;
  probe.dispose();
  const tex = new DynamicTexture(`label-tex-${i}`, { width: w, height: TEX_H }, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, TEX_H);
  const r = TEX_H / 2 - 6;
  ctx.fillStyle = 'rgba(10, 16, 22, 0.86)';
  ctx.strokeStyle = 'rgba(122, 210, 232, 0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, TEX_H - 8, r);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f4f1ea';
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 28, TEX_H / 2 + 2);
  tex.hasAlpha = true;
  tex.update();
  tex.anisotropicFilteringLevel = 8;
  const plane = MeshBuilder.CreatePlane(`label-${i}`, { width: (HEIGHT * w) / TEX_H, height: HEIGHT }, scene);
  const m = new StandardMaterial(`label-mat-${i}`, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.useAlphaFromDiffuseTexture = true;
  m.disableLighting = true;
  m.backFaceCulling = false;
  plane.material = m;
  plane.renderingGroupId = 1;
  plane.isPickable = false;
  faceViewer(plane);
  return plane;
}

/**
 * `list`: [{ id, text, cell }] where cell is { root, opening (Vector3, the cell's own frame) }.
 * Returns { setVisible(bool), refresh() }.
 */
export function createLabels(scene, parts, list) {
  const lineColor = Color3.FromHexString('#7ad2e8');
  const labels = list.map((l, i) => {
    const n = parts.nodes[l.id];
    // Where the line starts, in the part's own frame.
    let anchor = n.anchor;
    if (!anchor) {
      const c = parts.centreOf(l.id);
      anchor = Vector3.TransformCoordinates(c, n.t.computeWorldMatrix(true).clone().invert());
    }
    const plane = tag(scene, l.text, i);
    // Out from the cell's middle and towards its opening.
    const cellInv = l.cell.root.computeWorldMatrix(true).clone().invert();
    const inCell = Vector3.TransformCoordinates(Vector3.TransformCoordinates(anchor, n.t.computeWorldMatrix(true)), cellInv);
    const out = new Vector3(inCell.x, 0, inCell.z);
    const dir = (out.lengthSquared() > 1e-6 ? out.normalize().scale(0.5) : Vector3.Zero()).add(l.cell.opening.scale(0.9)).normalize();
    const offsetLocal = dir.scale(l.out ?? 0.42).add(new Vector3(0, l.up ?? 0.12, 0));
    const line = MeshBuilder.CreateLines(`label-line-${i}`, { points: [Vector3.Zero(), Vector3.Zero()], updatable: true }, scene);
    line.color = lineColor;
    line.alpha = 0.8;
    line.renderingGroupId = 1;
    line.isPickable = false;
    return { ...l, n, anchor, offsetLocal, plane, line, last: null };
  });
  let visible = true;

  function refresh() {
    const eye = scene.activeCamera?.globalPosition;
    for (const l of labels) {
      const shown = visible && parts.meshesBelow(l.id).some((m) => m.isEnabled());
      l.plane.setEnabled(shown);
      l.line.setEnabled(shown);
      if (!shown) continue;
      const a = Vector3.TransformCoordinates(l.anchor, l.n.t.computeWorldMatrix(true));
      // Taken out, the tag sits just over the part; in place, out in the cell's opening.
      const home = [...parts.path(l.id)].every((i) => parts.isHome(i));
      const off = home ? Vector3.TransformNormal(l.offsetLocal, l.cell.root.computeWorldMatrix(true)) : new Vector3(0, 0.12, 0);
      const p = a.add(off);
      // Readable from across the room and not in the way up close: tags keep about the same size on screen.
      const k = eye ? Math.min(3.2, Math.max(0.45, Vector3.Distance(eye, p) / 2.2)) : 1;
      l.plane.scaling.setAll(k);
      if (l.last && Vector3.DistanceSquared(l.last, p) < 1e-8 && Vector3.DistanceSquared(l.lastA, a) < 1e-8 && l.lastK === k) continue;
      l.lastK = k;
      l.last = p;
      l.lastA = a;
      l.plane.position.copyFrom(p);
      MeshBuilder.CreateLines(l.line.name, { points: [a, p.add(new Vector3(0, (-HEIGHT * k) / 2, 0))], instance: l.line });
    }
  }
  scene.onBeforeRenderObservable.add(refresh);

  return {
    setVisible(v) {
      visible = v;
      refresh();
    },
    get visible() {
      return visible;
    },
  };
}

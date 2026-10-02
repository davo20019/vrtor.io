import { ArcRotateCamera, Engine, Vector3 } from "@babylonjs/core";
import {
  createCard,
  createPresence,
  createXr,
  mountPresenceControls,
  orbitPose,
  presenceCard,
  roomsCard,
  continueInVr,
  xrPose,
  xrSupported,
} from "@vrtor/xr-shell";
import { buildWorld, VIEWS, V } from "./world.js";
import { LESSONS } from "./lesson.js";
import "./style.css";
const $ = (s) => document.querySelector(s);
const ui = {
  loading: $(".loading"),
  pct: $(".loading-pct"),
  card: $(".card"),
  kicker: $(".card-kicker"),
  title: $(".card-title"),
  body: $(".card-body"),
  fact: $(".card-fact"),
  actions: $(".card-actions"),
  vr: $("[data-enter-vr]"),
  learn: $("[data-lesson]"),
  view: $("[data-view]"),
  light: $("[data-light]"),
  hint: $(".hint"),
};
const engine = new Engine(
  $("#scene"),
  true,
  { xrCompatible: true, stencil: true },
  true,
);
let world, scene, camera, panel, rig, flight, presence;
let lesson = -1,
  phase = "observe",
  feedback = "",
  score = 0,
  answered = new Set(),
  cardOpen = true,
  view = 0,
  study = false,
  people = false,
  // The headset card is showing the other rooms.
  rooms = false;
const inXr = () => !!rig?.inXr();
const action = (label, onClick, primary = false) => ({
  label,
  onClick,
  primary,
});
const controls =
  "Push the stick forward to teleport; left or right to turn. Point and pull the trigger to choose. A or X reopens the lesson; B or Y joins other visitors, then turns your mic on and off.";
function content() {
  if (rooms)
    return roomsCard("taj", rig, action, () => {
      rooms = false;
      render();
    });
  if (people && presence)
    return presenceCard(presence, action, () => {
      people = false;
      render();
    });
  if (lesson < 0)
    return {
      kicker: "World wonders · 01",
      title: "Symmetry in stone",
      body: "Explore the Taj Mahal’s exterior in 3D. Find its mirror line, recognize its arches and towers, and test what you learn.",
      fact: inXr()
        ? controls
        : "A 17th-century Mughal mausoleum in Agra, India. Exterior reconstruction; approximate scale.",
      actions: [
        action("Explore", close),
        action("Start lesson", () => go(0), true),
        ...peopleAction(),
      ],
    };
  if (lesson >= LESSONS.length)
    return {
      kicker: "Lesson complete",
      title: `${score} of 4 first try`,
      body: "You explored the axis of symmetry, the pishtaq, four minarets and the chhatris. Revisit the building from another angle, or repeat the lesson.",
      fact: "Built under Shah Jahan in memory of Mumtaz Mahal. UNESCO World Heritage since 1983.",
      actions: [action("Again", restart), action("Explore", close, true)],
    };
  const l = LESSONS[lesson];
  if (phase === "question")
    return {
      kicker: `Challenge ${lesson + 1} of 4`,
      title: l.question,
      body:
        feedback ||
        "Look at the architecture before choosing. You can try again.",
      fact: "",
      actions: l.choices.map((c, i) => action(c, () => answer(i))),
    };
  if (phase === "answered")
    return {
      kicker: `Challenge ${lesson + 1} of 4 · Correct`,
      title: "You found it",
      body: l.why,
      fact: feedback,
      actions: [
        action("Look around", close),
        action(lesson === 3 ? "Finish" : "Next", () => go(lesson + 1), true),
      ],
    };
  const experiment =
    lesson === 0
      ? action(study ? "Hide axis" : "Show axis", toggleStudy)
      : lesson === 3
        ? action("Change light", changeLight)
        : action("Explore", close);
  return {
    kicker: `Investigate ${lesson + 1} of 4`,
    title: l.title,
    body: l.body,
    fact: l.fact,
    actions: [
      experiment,
      action(
        "Test me",
        () => {
          phase = "question";
          feedback = "";
          render();
        },
        true,
      ),
    ],
  };
}
// In the headset the bar isn't visible: its buttons are a strip under the card.
function tools() {
  if (people || rooms) return [];
  const list = [
    action("Next viewpoint", () => travel((view + 1) % VIEWS.length).then(render)),
  ];
  // The lighting investigation has its own button.
  if (!(lesson === 3 && phase !== "question" && phase !== "answered")) list.push(action("Change light", changeLight));
  list.push(action("Change room", openRooms));
  return list;
}
// In the headset, the card's page of other rooms to go to.
function openRooms() {
  rooms = true;
  people = false;
  cardOpen = true;
  render();
}
// In the headset the bar isn't visible, so visitors are a page of the card.
function peopleAction() {
  if (!inXr() || !presence || presence.state.status !== "online") return [];
  const s = presence.state;
  const open = () => {
    people = true;
    render();
  };
  // One step to join from the welcome card; B or Y does the same anywhere (presence.attachXr).
  if (!s.joined)
    return [
      action(s.online > 1 ? `Join ${s.online - 1} here` : "Join others", () => {
        presence.join();
        open();
      }),
    ];
  return [action(`People · ${s.here}`, open)];
}
function poseNow() {
  if (!world) return null;
  // Terrace and paths first (they're higher), then the garden court, so orbiting anywhere places you.
  return inXr()
    ? xrPose(rig)
    : orbitPose(camera, [...world.floors, world.ground]);
}
function answer(choice) {
  const l = LESSONS[lesson];
  const first = !answered.has(lesson);
  answered.add(lesson);
  if (choice !== l.answer) {
    feedback =
      "Try again. " +
      (lesson === 0
        ? "Look for the line through the center of the building."
        : lesson === 1
          ? "The portal is the tall arched recess, rather than a tower or pavilion."
          : lesson === 2
            ? "There is one tower at each corner of the terrace."
            : "Look for the smaller pavilions with their own domed roofs.");
    render();
    return;
  }
  if (first) score++;
  feedback = first
    ? "Correct on your first try."
    : "Correct after another look.";
  phase = "answered";
  render();
}
async function go(i) {
  lesson = i;
  phase = "observe";
  feedback = "";
  cardOpen = true;
  rooms = false;
  study = false;
  world.study(false);
  if (i < LESSONS.length && i >= 0) await travel(LESSONS[i].view);
  render();
}
function restart() {
  score = 0;
  answered = new Set();
  go(0);
}
function close() {
  cardOpen = false;
  people = false;
  rooms = false;
  render();
}
function toggleStudy() {
  study = !study;
  world.study(study);
  render();
}
function changeLight() {
  ui.light.textContent = world.daylight();
  if (inXr() && lesson === 3) {
    feedback = ui.light.textContent;
  }
  render();
}
async function travel(i) {
  view = i;
  const stop = VIEWS[i];
  if (inXr()) await rig.moveTo(stop.stand, stop.at);
  else {
    const eye = stop.stand.add(V(0, 1.65, 0));
    const off = eye.subtract(stop.at);
    flight = {
      target: stop.at.clone(),
      radius: off.length(),
      alpha: Math.atan2(off.z, off.x),
      beta: Math.acos(off.y / off.length()),
    };
  }
}
function render() {
  const data = content();
  if (inXr()) {
    ui.card.hidden = true;
    if (!cardOpen) {
      panel.hide();
      return;
    }
    if (new URLSearchParams(location.search).has("xrdebug"))
      data.kicker = rig.stats();
    panel.setContent({ ...data, tools: tools() });
    // Keep the card slightly to the left of the monument, so it can be read and inspected together.
    const f = rig.headForward();
    const a = -0.45;
    const direction = V(
      f.x * Math.cos(a) + f.z * Math.sin(a),
      0,
      -f.x * Math.sin(a) + f.z * Math.cos(a),
    );
    panel.place(rig.headPosition(), direction);
    return;
  }
  panel.hide();
  ui.card.hidden = !cardOpen;
  if (!cardOpen) return;
  ui.kicker.textContent = data.kicker;
  ui.title.textContent = data.title;
  ui.body.textContent = data.body;
  ui.fact.textContent = data.fact;
  ui.fact.hidden = !data.fact;
  ui.actions.replaceChildren(
    ...data.actions.map((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = a.primary ? "btn btn-primary" : "btn";
      b.textContent = a.label;
      b.addEventListener("click", a.onClick);
      return b;
    }),
  );
}
async function start() {
  world = await buildWorld(
    engine,
    (p) => (ui.pct.textContent = `${Math.round(p * 100)}%`),
  );
  scene = world.scene;
  camera = new ArcRotateCamera("orbit", 0, 1, 120, V(0, 20, 0), scene);
  camera.setPosition(V(76, 42, -116));
  camera.minZ = 0.15;
  camera.maxZ = 1600;
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 220;
  camera.lowerBetaLimit = 0.12;
  camera.upperBetaLimit = 2.7;
  camera.wheelDeltaPercentage = 0.012;
  camera.pinchDeltaPercentage = 0.004;
  camera.panningSensibility = 0;
  camera.attachControl($("#scene"), true);
  panel = createCard(scene, { name: "taj-lesson", height: 0.68 });
  let refreshBar = () => {};
  presence = createPresence(scene, {
    subject: "taj",
    getPose: poseNow,
    onChange: (state) => {
      refreshBar(state);
      // Refresh the open headset card in place (render() would also move it to where you look).
      if (inXr() && cardOpen && (people || lesson < 0))
        panel.setContent({ ...content(), tools: tools() });
    },
  });
  refreshBar = mountPresenceControls(presence, $(".presence-controls"));
  refreshBar(presence.state);
  if (new URLSearchParams(location.search).has("xrdebug"))
    window.vrtorPresence = presence;
  // Headset setup is optional: the same lesson remains usable if WebXR initialization fails.
  try {
    if (await xrSupported())
      rig = await createXr(scene, {
        floorMeshes: world.floors,
        start: { position: V(5.5, 0, -105), lookAt: V(0, 22, 0) },
      });
  } catch (e) {
    console.warn("[taj] VR unavailable", e);
  }
  if (rig) {
    ui.vr.hidden = false;
    document.body.classList.add("xr-ready");
    for (const p of panel.panels) rig.mirrorPanel(p, { interactive: true });
    let frames = -1;
    rig.onChange((entered) => {
      document.body.classList.toggle("in-xr", entered);
      frames = entered ? 0 : -1;
      if (!entered) render();
    });
    rig.xr.baseExperience.sessionManager.onXRFrameObservable.add(() => {
      if (frames < 0 || ++frames < 6) return;
      frames = -1;
      cardOpen = true;
      if (lesson >= 0 && lesson < LESSONS.length) travel(view).then(render);
      else render();
    });
    presence.attachXr(rig.xr);
    rig.xr.input.onControllerAddedObservable.add((source) =>
      source.onMotionControllerInitObservable.add((mc) => {
        for (const id of ["a-button", "x-button"])
          mc.getComponent(id)?.onButtonStateChangedObservable.add((c) => {
            if (c.changes.pressed?.current) {
              cardOpen = true;
              render();
            }
          });
      }),
    );
  }
  scene.onBeforeRenderObservable.add(() => {
    if (!flight || inXr()) return;
    const k = Math.min(1, engine.getDeltaTime() / 180);
    Vector3.LerpToRef(camera.target, flight.target, k, camera.target);
    const da = Math.atan2(
      Math.sin(flight.alpha - camera.alpha),
      Math.cos(flight.alpha - camera.alpha),
    );
    camera.alpha += da * k;
    camera.beta += (flight.beta - camera.beta) * k;
    camera.radius += (flight.radius - camera.radius) * k;
    if (
      Math.abs(da) < 0.001 &&
      Vector3.Distance(camera.target, flight.target) < 0.01 &&
      Math.abs(camera.radius - flight.radius) < 0.02
    )
      flight = null;
  });
  continueInVr(rig, ui.vr);
  ui.loading.hidden = true;
  ui.hint.hidden = false;
  ui.learn.disabled = ui.view.disabled = ui.light.disabled = false;
  render();
  // Expose inspection data for local visual and asset checks.
  window.__taj = {
    scene,
    world,
    panel,
    get state() {
      return { lesson, phase, score, view, study };
    },
  };
}
ui.learn.addEventListener("click", () => {
  cardOpen = true;
  if (lesson < 0) go(0);
  else render();
});
ui.view.addEventListener("click", () => travel((view + 1) % VIEWS.length));
ui.light.addEventListener("click", changeLight);
ui.vr.addEventListener("click", async () => {
  ui.vr.disabled = true;
  try {
    await rig.enter();
  } catch (e) {
    console.warn("[taj] Enter VR failed", e);
    cardOpen = true;
    ui.hint.hidden = false;
    ui.hint.textContent =
      "VR could not start. Try Enter VR again, or explore here.";
  } finally {
    ui.vr.disabled = false;
  }
});
$("[data-retry]").addEventListener("click", () => location.reload());
$("#scene").addEventListener("pointerdown", () => (flight = null));
$("#scene").addEventListener("wheel", () => (flight = null), { passive: true });
window.addEventListener("resize", () => engine.resize());
engine.runRenderLoop(() => scene?.render());
start().catch((e) => {
  console.error("[taj]", e);
  ui.pct.textContent = "The model could not load. Please try again.";
  $("[data-retry]").hidden = false;
});

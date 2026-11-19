# Visitors: seeing and talking to each other

Anyone with a subject open can choose **Join others** to appear to everyone else in it as a stylized avatar (their mouth moves when they talk), and hear people near them. The mic stays off until they choose **Talk**; voices are spatial and fade out by 30m; tapping someone (or pointing and pulling the trigger) mutes them for you only. A chime and a short notice mark arrivals and departures.

- Names: random by default. On a flat screen, **Change name** (kept in the browser for next time); in the headset, **New name** picks another random one. The server refuses names that pose as staff or contain slurs or profanity (`cleanName` in `apps/home/src/presence.js`).
- Headset first: the walk card has a one-step **Join N here**, and **B or Y** joins, then turns the mic on and off, with a notice floating ahead. If the browser can't ask for the mic inside VR, the card says to tap Talk once outside VR.
- Headset budget: an avatar is 6 draw calls plus its name tag, all sharing one material; faces are dropped beyond 20m and avatars beyond 45m; anyone inside your personal space (0.55m) isn't drawn; HRTF spatial audio only within 8 to 10m.

- Server: `apps/home/src/presence.js`, a Durable Object per room at `vrtor.io/api/presence/<code>` (WebSocket). Rooms hold 12 people; more open `<code>:1`, `<code>:2`, ... Names are assigned by the server.
- Client: `packages/xr-shell/src/presence.js` (socket, avatars), `voice.js` (peer-to-peer WebRTC audio, signaled through the room), `presenceUi.js` (bar buttons and the headset card page).
- Kill switches: set `PRESENCE` or `VOICE` to `"off"` in `apps/home/wrangler.jsonc` (or the dashboard) and deploy; connected rooms restart under the new setting.
- Debug: `?xrdebug` exposes `window.vrtorPresence`; `vrtorPresence.stats()` shows each voice connection and its audio level.
- No TURN relay yet, so a few network pairs (strict NATs) won't hear each other; Cloudflare Realtime TURN fixes that if it shows up in testing.

Adding it to a subject (see `apps/taj/src/main.js` for an orbit-camera subject, `apps/mpc/src/main.js` for one with its own walker):

```js
const presence = createPresence(scene, { subject: 'xyz', getPose, onChange });
const updateBar = mountPresenceControls(presence, document.querySelector('.presence-controls'));
// getPose() → { area, head, forward, left?, right? } or null; in the headset, show presenceCard(presence, action, back)
// xrPose(rig) covers the headset; orbitPose(camera, groundMeshes) stands a flat-screen orbit viewer on the ground below the camera
```

# Sound Lab (`vrtor.io/snd/`)

A browser and WebXR pronunciation lab connected to Learn English Sounds. Four guided
American English contrasts (ship/sheep, cat/cut, thin/sin, vest/best) follow the same
sequence: compare examples, answer six shuffled listening questions, inspect a schematic
mouth position, then record and compare words and sentences. Listening, mouth exploration,
and speaking occupy separate stations. Lesson steps move between them with a comfort fade.
In VR, squeeze to grab a word and release it in the gold answer ring, or point and tap a
word, then the ring. HTML answer buttons are also available. The enlarged mouth cutaway
rotates, animates between sounds, and lets you highlight tongue, teeth and lips. Live 3D
volume bars respond to the microphone while recording; they do not assess pronunciation.
Station controls keep the lesson playable with the large panel closed. A/X opens the menu;
teleport and snap turns use the shared XR shell. Visitors and spatial voice are optional;
starting a recording mutes your visitor microphone and does not turn it back on automatically.

The library contains the 44 LES guides, including regional entries and the /ju/ sound
pattern. British centering-diphthong guides are labeled and use British examples; core
lessons use American English. Mouth animations cover the eight guided sounds only and
are simplified demonstrations, not anatomical measurements. Every guide offers its
mouth instructions, example audio, private recording playback, and a link to its full
LES page. Deep links from LES can open `/snd/?sound=short-i` or
`/snd/?lesson=ship-sheep`. The LES site itself is not modified here.

Examples are bundled MP3s made with synthesized macOS voices (Samantha for American,
Daniel for British). They are not in the public repository: Apple's licence for those voices
doesn't allow redistributing their output. Without them each item says it has no audio
example and links to its LES guide; on macOS, `node scripts/build-sound-audio.mjs` makes
your own local copies. Recordings remain in memory in the browser tab, stop after eight
seconds, and are discarded on exercise changes, backgrounding, or leaving. Only listening
results and recording counts persist in localStorage. Speaking is self-review, without
automatic pronunciation scores; there is no shared login or cross-site progress sync.

- Build: `npm run build -w @vrtor/snd`; checks: `npm run test:snd`.
- Development: `npm run dev` includes Sound Lab at `/snd/`.
- Deployment: deploy `vrtor-snd` before the home Worker; the root deploy script does this.
- Refresh LES data: `node scripts/import-sound-guides.mjs /path/to/learnenglishsounds`.
- Rebuild audio on macOS with `say` and `ffmpeg`: `node scripts/build-sound-audio.mjs`.

The catalog, `/sounds`, `/sound-lab`, `/english`, sitemap, and headset room menu all
include Sound Lab. Desktop/mobile browser flows, bundled audio, recording lifecycle,
local routing and caching have been checked. Grip/drop acceptance, input fallback, and controller/session cleanup have automated checks.
Physical headset comfort, reach, controller behavior, menu placement,
and microphone permission behavior still require a headset check.

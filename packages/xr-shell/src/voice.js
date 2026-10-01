// Voices between visible people in a room: peer-to-peer WebRTC audio, signaled
// through the presence socket, played through Web Audio so each voice comes from
// its speaker's head and fades out with distance.
//
// Each connection carries audio one way, opened by the person sending it: when
// your mic turns on you call everyone, and whoever has a mic on calls you. No
// glare to resolve, and listening never needs the mic.
//
// No TURN relay yet: a few network pairs (strict NATs, some corporate Wi-Fi)
// won't connect. Cloudflare Realtime TURN is the fix if testing shows it.

const ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }];
/** Voices are full volume within REF metres and silent beyond MAX. */
const REF_DISTANCE = 2;
const MAX_DISTANCE = 30;
const SPEAKING_LEVEL = 0.025;

export function createVoice({ signal, onActivity }) {
  let ctx = null;
  let mic = null;
  let micAnalyser = null;
  let micMuted = true;
  const peers = new Set();
  const outgoing = new Map();
  const incoming = new Map();
  const silenced = new Set();
  const level = new Uint8Array(256);

  /** Must run inside a user gesture once (browsers keep audio suspended until then). */
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  }

  function rms(analyser) {
    analyser.getByteTimeDomainData(level);
    let sum = 0;
    for (const v of level) sum += ((v - 128) / 128) ** 2;
    return Math.sqrt(sum / level.length);
  }

  function addCandidate(entry, c) {
    if (entry.pc.remoteDescription) entry.pc.addIceCandidate(c).catch(() => {});
    else entry.pending.push(c);
  }
  function flush(entry) {
    for (const c of entry.pending.splice(0)) entry.pc.addIceCandidate(c).catch(() => {});
  }

  async function call(id) {
    if (!mic || outgoing.has(id)) return;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const entry = { pc, pending: [] };
    outgoing.set(id, entry);
    const track = mic.getAudioTracks()[0];
    pc.addTransceiver(track, { direction: 'sendonly', streams: [mic] });
    pc.onicecandidate = (e) => e.candidate && signal(id, { k: 'ice', from: 'tx', c: e.candidate.toJSON() });
    pc.onconnectionstatechange = () => {
      if (pc.connectionState !== 'failed' || outgoing.get(id) !== entry) return;
      // One more try a moment later (a network change, or the other side was mid-reload).
      hangUp(outgoing, id);
      setTimeout(() => peers.has(id) && call(id), 3000);
    };
    try {
      await pc.setLocalDescription(await pc.createOffer());
      signal(id, { k: 'offer', sdp: pc.localDescription.toJSON() });
    } catch (e) {
      console.warn('[voice] offer failed', e);
      hangUp(outgoing, id);
    }
  }

  async function answer(id, sdp) {
    hangUp(incoming, id);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const entry = { pc, pending: [], audible: false, speaking: false };
    incoming.set(id, entry);
    pc.onicecandidate = (e) => e.candidate && signal(id, { k: 'ice', from: 'rx', c: e.candidate.toJSON() });
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      // Chrome only feeds a remote stream into Web Audio while a media element plays it.
      entry.element = new Audio();
      entry.element.muted = true;
      entry.element.srcObject = stream;
      entry.element.play().catch(() => {});
      unlock();
      if (!ctx) return;
      entry.source = ctx.createMediaStreamSource(stream);
      entry.analyser = ctx.createAnalyser();
      entry.analyser.fftSize = 256;
      entry.gain = ctx.createGain();
      entry.gain.gain.value = 0;
      entry.panner = new PannerNode(ctx, {
        panningModel: 'HRTF',
        distanceModel: 'linear',
        refDistance: REF_DISTANCE,
        maxDistance: MAX_DISTANCE,
        rolloffFactor: 1,
      });
      entry.source.connect(entry.analyser);
      entry.source.connect(entry.gain).connect(entry.panner).connect(ctx.destination);
      applyGain(id);
    };
    try {
      await pc.setRemoteDescription(sdp);
      flush(entry);
      await pc.setLocalDescription(await pc.createAnswer());
      signal(id, { k: 'answer', sdp: pc.localDescription.toJSON() });
    } catch (e) {
      console.warn('[voice] answer failed', e);
      hangUp(incoming, id);
    }
  }

  function hangUp(map, id) {
    const entry = map.get(id);
    if (!entry) return;
    map.delete(id);
    entry.pc.onicecandidate = entry.pc.onconnectionstatechange = entry.pc.ontrack = null;
    entry.pc.close();
    entry.element && (entry.element.srcObject = null);
    entry.source?.disconnect();
    entry.panner?.disconnect();
  }

  function applyGain(id) {
    const entry = incoming.get(id);
    if (!entry?.gain || !ctx) return;
    entry.gain.gain.setTargetAtTime(entry.audible && !silenced.has(id) ? 1 : 0, ctx.currentTime, 0.05);
  }

  // Web Audio is right-handed, Babylon left-handed: z flips.
  const setXyz = (node, prefix, v) => {
    const t = ctx.currentTime;
    node[`${prefix}X`].setTargetAtTime(v.x, t, 0.05);
    node[`${prefix}Y`].setTargetAtTime(v.y, t, 0.05);
    node[`${prefix}Z`].setTargetAtTime(-v.z, t, 0.05);
  };

  return {
    unlock,
    get micOn() {
      return !!mic && !micMuted;
    },
    get hasMic() {
      return !!mic;
    },
    /** Asks for the mic (in a user gesture) and calls everyone. Throws if it's denied. */
    async startMic() {
      unlock();
      if (!mic) {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (ctx) {
          micAnalyser = ctx.createAnalyser();
          micAnalyser.fftSize = 256;
          ctx.createMediaStreamSource(mic).connect(micAnalyser);
        }
        for (const id of peers) call(id);
      }
      this.setMicMuted(false);
    },
    setMicMuted(muted) {
      micMuted = muted;
      for (const t of mic?.getAudioTracks() ?? []) t.enabled = !muted;
    },
    addPeer(id) {
      peers.add(id);
      call(id);
    },
    removePeer(id) {
      peers.delete(id);
      silenced.delete(id);
      hangUp(outgoing, id);
      hangUp(incoming, id);
    },
    handle(from, d) {
      if (!d || !peers.has(from)) return;
      if (d.k === 'offer') answer(from, d.sdp);
      else if (d.k === 'answer') {
        const entry = outgoing.get(from);
        entry?.pc.setRemoteDescription(d.sdp).then(() => flush(entry)).catch((e) => console.warn('[voice] answer rejected', e));
      } else if (d.k === 'ice') {
        // Candidates from the sender belong to our incoming call, and the other way round.
        const entry = (d.from === 'tx' ? incoming : outgoing).get(from);
        if (entry) addCandidate(entry, d.c);
      }
    },
    /** Mutes one person for you only. */
    setSilenced(id, on) {
      if (on) silenced.add(id);
      else silenced.delete(id);
      applyGain(id);
    },
    isSilenced: (id) => silenced.has(id),
    /** Where you are: { head: Vector3, forward: Vector3 }. */
    setListener(head, forward) {
      if (!ctx?.listener.positionX) return;
      setXyz(ctx.listener, 'position', head);
      setXyz(ctx.listener, 'forward', forward);
    },
    /** Where someone's voice comes from, and whether you can hear them at all (same area). */
    setSource(id, head, audible) {
      const entry = incoming.get(id);
      if (!entry) return;
      if (entry.audible !== audible) {
        entry.audible = audible;
        applyGain(id);
      }
      if (entry.panner && head) setXyz(entry.panner, 'position', head);
    },
    /** Polls voice levels; call a few times a second. */
    sampleLevels() {
      for (const [id, entry] of incoming) {
        if (!entry.analyser) continue;
        const speaking = entry.audible && !silenced.has(id) && rms(entry.analyser) > SPEAKING_LEVEL;
        if (speaking !== entry.speaking) {
          entry.speaking = speaking;
          onActivity?.(id, speaking);
        }
      }
      return micAnalyser && !micMuted ? rms(micAnalyser) > SPEAKING_LEVEL : false;
    },
    /** Connection states, for debugging: { incoming: [{ id, state, audible, speaking }], outgoing: [...] }. */
    stats() {
      return {
        audio: ctx?.state ?? 'none',
        incoming: [...incoming].map(([id, e]) => ({ id, state: e.pc.connectionState, playing: !!e.gain, audible: e.audible, speaking: e.speaking, level: e.analyser ? +rms(e.analyser).toFixed(3) : null })),
        mic: micAnalyser ? +rms(micAnalyser).toFixed(3) : null,
        outgoing: [...outgoing].map(([id, e]) => ({ id, state: e.pc.connectionState })),
      };
    },
    /** Hangs up everyone and releases the mic. */
    stop() {
      for (const id of [...peers]) this.removePeer(id);
      for (const t of mic?.getTracks() ?? []) t.stop();
      mic = null;
      micAnalyser = null;
      micMuted = true;
    },
  };
}

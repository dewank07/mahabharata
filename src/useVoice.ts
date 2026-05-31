import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

// Free STUN servers (no account, no cost). For players behind strict/symmetric
// NATs you may also need a TURN relay — add one below. STUN-only works for the
// large majority of home networks.
const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    // Optional TURN (uncomment + fill in to maximise connectivity):
    // { urls: "turn:YOUR_TURN_HOST:3478", username: "user", credential: "pass" },
  ],
};

// Keep mesh video light enough to be viable for many peers.
const VIDEO: MediaTrackConstraints = {
  width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 },
};

export type CallPeer = { playerId: string; name: string };

type PeerState = {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
};

export type Call = {
  joined: boolean;
  muted: boolean;
  camOn: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  speaking: Record<string, boolean>; // peerId -> bool, "me" for local
  join: () => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
};

export function useVoice(
  code: string | null,
  myId: string,
  peers: CallPeer[],
): Call {
  const setVoice = useMutation(api.avalon.setVoice);
  const sendSignal = useMutation(api.avalon.sendSignal);
  const clearSignals = useMutation(api.avalon.clearSignals);

  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});

  const local = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const pendingCand = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const monitors = useRef<Map<string, () => void>>(new Map());
  const processed = useRef<Set<string>>(new Set());
  const audioCtx = useRef<AudioContext | null>(null);

  const signals = useQuery(
    api.avalon.getSignals,
    joined && code ? { code, toId: myId } : "skip",
  );

  /* ---- speaking detection (Web Audio RMS) ---- */
  const monitor = useCallback((key: string, stream: MediaStream) => {
    if (monitors.current.has(key)) return;
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      let raf = 0;
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        setSpeaking((s) => {
          const on = rms > 0.045;
          return s[key] === on ? s : { ...s, [key]: on };
        });
        raf = requestAnimationFrame(loop);
      };
      loop();
      monitors.current.set(key, () => { cancelAnimationFrame(raf); try { src.disconnect(); } catch {} });
    } catch { /* best-effort */ }
  }, []);

  const send = useCallback(
    (toId: string, kind: "offer" | "answer" | "candidate", data: unknown) => {
      if (code) sendSignal({ code, fromId: myId, toId, kind, data: JSON.stringify(data) }).catch(() => {});
    },
    [code, myId, sendSignal],
  );

  const drainCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const arr = pendingCand.current.get(peerId);
    if (!arr) return;
    for (const c of arr) { try { await pc.addIceCandidate(c); } catch {} }
    pendingCand.current.delete(peerId);
  }, []);

  const closePeer = useCallback((peerId: string) => {
    peersRef.current.get(peerId)?.pc.close();
    peersRef.current.delete(peerId);
    pendingCand.current.delete(peerId);
    monitors.current.get(peerId)?.();
    monitors.current.delete(peerId);
    setRemoteStreams((s) => { const n = { ...s }; delete n[peerId]; return n; });
    setSpeaking((s) => { const n = { ...s }; delete n[peerId]; return n; });
  }, []);

  /* ---- create a peer connection (perfect-negotiation) ---- */
  const createPeer = useCallback((peerId: string): PeerState => {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection(ICE);
    const ps: PeerState = { pc, makingOffer: false, ignoreOffer: false, polite: myId > peerId };
    peersRef.current.set(peerId, ps);

    local.current?.getTracks().forEach((t) => pc.addTrack(t, local.current!));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) send(peerId, "candidate", candidate.toJSON());
    };
    pc.ontrack = ({ streams: [stream] }) => {
      if (!stream) return;
      setRemoteStreams((s) => (s[peerId] === stream ? s : { ...s, [peerId]: stream }));
      monitor(peerId, stream);
    };
    pc.onnegotiationneeded = async () => {
      try {
        ps.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) send(peerId, pc.localDescription.type as "offer" | "answer", pc.localDescription);
      } catch { /* ignore */ } finally {
        ps.makingOffer = false;
      }
    };
    return ps;
  }, [myId, send, monitor]);

  /* ---- consume incoming handshakes ---- */
  useEffect(() => {
    if (!signals || !joined) return;
    let cancelled = false;
    (async () => {
      for (const sig of signals) {
        if (processed.current.has(sig._id)) continue;
        processed.current.add(sig._id);
        try {
          if (sig.kind === "offer" || sig.kind === "answer") {
            const desc = JSON.parse(sig.data) as RTCSessionDescriptionInit;
            const ps = createPeer(sig.fromId);
            const pc = ps.pc;
            const collision = desc.type === "offer" && (ps.makingOffer || pc.signalingState !== "stable");
            ps.ignoreOffer = !ps.polite && collision;
            if (ps.ignoreOffer) continue;
            await pc.setRemoteDescription(desc); // implicit rollback for polite peer
            await drainCandidates(sig.fromId, pc);
            if (desc.type === "offer") {
              await pc.setLocalDescription();
              if (pc.localDescription) send(sig.fromId, "answer", pc.localDescription);
            }
          } else if (sig.kind === "candidate") {
            const cand = JSON.parse(sig.data) as RTCIceCandidateInit;
            const ps = peersRef.current.get(sig.fromId);
            if (ps && ps.pc.remoteDescription) {
              try { await ps.pc.addIceCandidate(cand); } catch { if (!ps.ignoreOffer) {/* ignore */} }
            } else {
              const arr = pendingCand.current.get(sig.fromId) ?? [];
              arr.push(cand);
              pendingCand.current.set(sig.fromId, arr);
            }
          }
        } catch { /* ignore malformed/late signals */ }
      }
      const ids = signals.map((s) => s._id);
      if (!cancelled && ids.length) clearSignals({ ids }).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [signals, joined, createPeer, drainCandidates, send, clearSignals]);

  /* ---- reconcile mesh with current call roster ---- */
  useEffect(() => {
    if (!joined || !local.current) return;
    const want = new Set(peers.map((p) => p.playerId));
    for (const p of peers) {
      if (p.playerId !== myId && !peersRef.current.has(p.playerId)) {
        createPeer(p.playerId); // adding tracks fires negotiationneeded
      }
    }
    for (const peerId of Array.from(peersRef.current.keys())) {
      if (!want.has(peerId)) closePeer(peerId);
    }
  }, [peers, joined, myId, createPeer, closePeer]);

  /* ---- actions ---- */
  const join = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      local.current = stream;
      setLocalStream(stream);
      setMuted(false);
      setCamOn(false);
      monitor("me", stream);
      setJoined(true);
      if (code) await setVoice({ code, playerId: myId, on: true });
    } catch {
      alert("A microphone is needed for the war council. Please allow mic access.");
    }
  }, [code, myId, monitor, setVoice]);

  const leave = useCallback(async () => {
    setJoined(false);
    if (code) await setVoice({ code, playerId: myId, on: false }).catch(() => {});
    for (const peerId of Array.from(peersRef.current.keys())) closePeer(peerId);
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    monitors.current.get("me")?.();
    monitors.current.delete("me");
    setLocalStream(null);
    setRemoteStreams({});
    setMuted(false);
    setCamOn(false);
    setSpeaking({});
  }, [code, myId, closePeer, setVoice]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      local.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
      return next;
    });
  }, []);

  const toggleCamera = useCallback(async () => {
    if (!local.current) return;
    if (camOn) {
      // turn off: remove + stop the video track (triggers renegotiation per peer)
      for (const { pc } of peersRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) pc.removeTrack(sender);
      }
      local.current.getVideoTracks().forEach((t) => { t.stop(); local.current!.removeTrack(t); });
      setCamOn(false);
      setLocalStream(new MediaStream(local.current.getTracks()));
    } else {
      try {
        const vstream = await navigator.mediaDevices.getUserMedia({ video: VIDEO });
        const vtrack = vstream.getVideoTracks()[0];
        local.current.addTrack(vtrack);
        for (const { pc } of peersRef.current.values()) pc.addTrack(vtrack, local.current!);
        setCamOn(true);
        setLocalStream(new MediaStream(local.current.getTracks()));
      } catch {
        alert("Could not access the camera.");
      }
    }
  }, [camOn]);

  /* ---- cleanup ---- */
  useEffect(() => {
    const bye = () => { if (joined && code) setVoice({ code, playerId: myId, on: false }).catch(() => {}); };
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, [joined, code, myId, setVoice]);

  useEffect(() => () => {
    peersRef.current.forEach((ps) => ps.pc.close());
    peersRef.current.clear();
    local.current?.getTracks().forEach((t) => t.stop());
    audioCtx.current?.close().catch(() => {});
  }, []);

  return { joined, muted, camOn, localStream, remoteStreams, speaking, join, leave, toggleMute, toggleCamera };
}

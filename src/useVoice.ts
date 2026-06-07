import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

/**
 * Jitsi Meet configuration.
 * Uses the free public meet.jit.si server.
 * For production you can self-host or use JaaS (8x8.vc).
 */
const JITSI_DOMAIN = "meet.jit.si";
const JITSI_MUC = `conference.${JITSI_DOMAIN}`;
const JITSI_LIB_URL = `https://${JITSI_DOMAIN}/libs/lib-jitsi-meet.min.js`;

// Keep mesh video light
const VIDEO_CONSTRAINTS = {
  resolution: 360,
  constraints: {
    video: {
      height: { ideal: 240, max: 360 },
      width: { ideal: 320, max: 480 },
    },
  },
};

export type CallPeer = { playerId: string; name: string };

export type Call = {
  joined: boolean;
  muted: boolean;
  camOn: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  speaking: Record<string, boolean>;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
};

/* ---- Load lib-jitsi-meet dynamically ---- */
let jitsiLoadPromise: Promise<void> | null = null;

function loadJitsiLib(): Promise<void> {
  if ((window as any).JitsiMeetJS) return Promise.resolve();
  if (jitsiLoadPromise) return jitsiLoadPromise;
  jitsiLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = JITSI_LIB_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load lib-jitsi-meet"));
    document.head.appendChild(script);
  });
  return jitsiLoadPromise;
}
export function useVoice(
  code: string | null,
  myId: string,
  _peers: CallPeer[], // peers list kept for interface compat; Jitsi manages its own roster
): Call {
  const setVoice = useMutation(api.avalon.setVoice);

  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});

  // Jitsi refs
  const connectionRef = useRef<any>(null);
  const roomRef = useRef<any>(null);
  const localTracksRef = useRef<any[]>([]);
  const remoteTracksRef = useRef<Map<string, any[]>>(new Map());
  // Maps Jitsi participantId -> game playerId (via displayName)
  const jitsiToPlayerRef = useRef<Map<string, string>>(new Map());

  /* ---- helpers to build MediaStream from Jitsi tracks ---- */
  const buildLocalStream = useCallback(() => {
    const tracks = localTracksRef.current
      .map((t) => t.getOriginalStream()?.getTracks())
      .flat()
      .filter(Boolean);
    if (tracks.length > 0) {
      const ms = new MediaStream(tracks);
      setLocalStream(ms);
    } else {
      setLocalStream(null);
    }
  }, []);

  const buildRemoteStream = useCallback((participantId: string) => {
    const gameId = jitsiToPlayerRef.current.get(participantId) ?? participantId;
    const jitsiTracks = remoteTracksRef.current.get(participantId) ?? [];
    const nativeTracks = jitsiTracks
      .map((t: any) => t.getOriginalStream()?.getTracks())
      .flat()
      .filter(Boolean);
    if (nativeTracks.length > 0) {
      setRemoteStreams((prev) => ({
        ...prev,
        [gameId]: new MediaStream(nativeTracks),
      }));
    } else {
      setRemoteStreams((prev) => {
        const n = { ...prev };
        delete n[gameId];
        return n;
      });
    }
  }, []);

  /* ---- join ---- */
  const join = useCallback(async () => {
    if (!code) return;
    try {
      await loadJitsiLib();
      const JitsiMeetJS = (window as any).JitsiMeetJS;
      JitsiMeetJS.init();
      JitsiMeetJS.setLogLevel(JitsiMeetJS.logLevels.ERROR);

      // Create connection
      const connection = new JitsiMeetJS.JitsiConnection(null, null, {
        hosts: {
          domain: JITSI_DOMAIN,
          muc: JITSI_MUC,
        },
        serviceUrl: `wss://${JITSI_DOMAIN}/xmpp-websocket`,
      });
      connectionRef.current = connection;

      // Connection events
      connection.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
        () => {
          // Join conference room named after game code
          const roomName = `avalon-${code.toLowerCase()}`;
          const room = connection.initJitsiConference(roomName, {
            openBridgeChannel: true,
            ...VIDEO_CONSTRAINTS,
          });
          roomRef.current = room;

          // Conference events
          room.on(JitsiMeetJS.events.conference.TRACK_ADDED, (track: any) => {
            if (track.isLocal()) return;
            const participantId = track.getParticipantId();
            const existing = remoteTracksRef.current.get(participantId) ?? [];
            existing.push(track);
            remoteTracksRef.current.set(participantId, existing);
            buildRemoteStream(participantId);

            track.addEventListener(
              JitsiMeetJS.events.track.TRACK_MUTE_CHANGED,
              () => {
                buildRemoteStream(participantId);
              },
            );
          });

          room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, (track: any) => {
            if (track.isLocal()) return;
            const participantId = track.getParticipantId();
            const existing = remoteTracksRef.current.get(participantId) ?? [];
            remoteTracksRef.current.set(
              participantId,
              existing.filter((t: any) => t !== track),
            );
            buildRemoteStream(participantId);
          });

          room.on(JitsiMeetJS.events.conference.USER_LEFT, (id: string) => {
            const gameId = jitsiToPlayerRef.current.get(id) ?? id;
            remoteTracksRef.current.delete(id);
            jitsiToPlayerRef.current.delete(id);
            setRemoteStreams((prev) => {
              const n = { ...prev };
              delete n[gameId];
              return n;
            });
            setSpeaking((prev) => {
              const n = { ...prev };
              delete n[gameId];
              return n;
            });
          });

          // Dominant speaker detection (Jitsi built-in)
          room.on(
            JitsiMeetJS.events.conference.DOMINANT_SPEAKER_CHANGED,
            (id: string) => {
              const myJitsiId = room.myUserId();
              const isMe = id === myJitsiId;
              const gameId = isMe
                ? "me"
                : (jitsiToPlayerRef.current.get(id) ?? id);
              setSpeaking((prev) => {
                const next: Record<string, boolean> = {};
                for (const key of Object.keys(prev)) next[key] = false;
                next[gameId] = true;
                return next;
              });
            },
          );

          // Track display name changes to build jitsi->game ID mapping
          room.on(
            JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED,
            (id: string, displayName: string) => {
              if (displayName) {
                jitsiToPlayerRef.current.set(id, displayName);
                // Rebuild stream under the correct key
                buildRemoteStream(id);
              }
            },
          );

          // Also capture initial participants who joined before us
          room.on(
            JitsiMeetJS.events.conference.USER_JOINED,
            (id: string, participant: any) => {
              const name = participant.getDisplayName?.();
              if (name) {
                jitsiToPlayerRef.current.set(id, name);
              }
            },
          );

          // Set display name to game player ID for mapping
          room.setDisplayName(myId);

          room.join();
        },
      );

      connection.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_FAILED,
        (err: any) => {
          console.error("Jitsi connection failed:", err);
          alert("Could not connect to voice server. Please try again.");
        },
      );

      connection.connect();

      // Create local audio track
      const localTracks = await JitsiMeetJS.createLocalTracks({
        devices: ["audio"],
      });
      localTracksRef.current = localTracks;
      buildLocalStream();

      // Add tracks to room once it's ready
      const waitForRoom = setInterval(() => {
        if (roomRef.current && roomRef.current.isJoined()) {
          clearInterval(waitForRoom);
          for (const track of localTracks) {
            roomRef.current.addTrack(track);
          }
        }
      }, 100);

      setJoined(true);
      setMuted(false);
      setCamOn(false);
      if (code) await setVoice({ code, playerId: myId, on: true });
    } catch (e) {
      console.error("Failed to join voice:", e);
      alert(
        "A microphone is needed for the war council. Please allow mic access.",
      );
    }
  }, [code, myId, setVoice, buildLocalStream, buildRemoteStream]);

  /* ---- leave ---- */
  const leave = useCallback(async () => {
    // Dispose local tracks
    for (const track of localTracksRef.current) {
      try {
        track.dispose();
      } catch {}
    }
    localTracksRef.current = [];

    // Leave room
    if (roomRef.current) {
      try {
        await roomRef.current.leave();
      } catch {}
      roomRef.current = null;
    }

    // Disconnect
    if (connectionRef.current) {
      try {
        connectionRef.current.disconnect();
      } catch {}
      connectionRef.current = null;
    }

    remoteTracksRef.current.clear();
    jitsiToPlayerRef.current.clear();
    setJoined(false);
    setLocalStream(null);
    setRemoteStreams({});
    setSpeaking({});
    setMuted(false);
    setCamOn(false);

    if (code)
      await setVoice({ code, playerId: myId, on: false }).catch(() => {});
  }, [code, myId, setVoice]);

  /* ---- toggleMute ---- */
  const toggleMute = useCallback(() => {
    const audioTrack = localTracksRef.current.find(
      (t: any) => t.getType() === "audio",
    );
    if (!audioTrack) return;
    if (muted) {
      audioTrack.unmute();
    } else {
      audioTrack.mute();
    }
    setMuted(!muted);
  }, [muted]);

  /* ---- toggleCamera ---- */
  const toggleCamera = useCallback(async () => {
    const JitsiMeetJS = (window as any).JitsiMeetJS;
    if (!JitsiMeetJS || !roomRef.current) return;

    if (camOn) {
      // Remove video track
      const videoTrack = localTracksRef.current.find(
        (t: any) => t.getType() === "video",
      );
      if (videoTrack) {
        if (roomRef.current.isJoined()) {
          try {
            await roomRef.current.removeTrack(videoTrack);
          } catch {}
        }
        videoTrack.dispose();
        localTracksRef.current = localTracksRef.current.filter(
          (t: any) => t !== videoTrack,
        );
      }
      setCamOn(false);
      buildLocalStream();
    } else {
      try {
        const [videoTrack] = await JitsiMeetJS.createLocalTracks({
          devices: ["video"],
          constraints: VIDEO_CONSTRAINTS.constraints,
        });
        localTracksRef.current.push(videoTrack);
        if (roomRef.current.isJoined()) {
          roomRef.current.addTrack(videoTrack);
        }
        setCamOn(true);
        buildLocalStream();
      } catch {
        alert("Could not access the camera.");
      }
    }
  }, [camOn, buildLocalStream]);

  /* ---- cleanup on unmount ---- */
  useEffect(() => {
    return () => {
      for (const track of localTracksRef.current) {
        try {
          track.dispose();
        } catch {}
      }
      if (roomRef.current) {
        try {
          roomRef.current.leave();
        } catch {}
      }
      if (connectionRef.current) {
        try {
          connectionRef.current.disconnect();
        } catch {}
      }
    };
  }, []);

  /* ---- notify server on page close ---- */
  useEffect(() => {
    const bye = () => {
      if (joined && code)
        setVoice({ code, playerId: myId, on: false }).catch(() => {});
    };
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, [joined, code, myId, setVoice]);

  return {
    joined,
    muted,
    camOn,
    localStream,
    remoteStreams,
    speaking,
    join,
    leave,
    toggleMute,
    toggleCamera,
  };
}

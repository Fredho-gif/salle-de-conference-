import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface UseWebRTCOptions {
  socket: Socket | null;
  roomId: string;
  userId: string;
  userName: string;
}

export function useWebRTC({ socket, roomId, userId }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [mediaError, setMediaError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Local Media Stream
  const initLocalStream = useCallback(async () => {
    try {
      setMediaError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Audio analysis for speaking indicator
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.4;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            setIsSpeaking(average > 25);
            animationFrameRef.current = requestAnimationFrame(checkVolume);
          };
          checkVolume();
        }
      } catch (audioErr) {
        console.warn('Audio analyser init skipped:', audioErr);
      }

      return stream;
    } catch (err: any) {
      console.warn('getUserMedia failed (normal in restricted iframes or if camera rejected):', err);
      setMediaError(err.name === 'NotAllowedError' ? 'Accès à la caméra/micro refusé par le navigateur' : err.message);

      // Create synthetic audio/video canvas track fallback if physical camera is denied
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 640, 360);
      }
      const syntheticStream = (canvas as any).captureStream ? (canvas as any).captureStream(10) : null;
      if (syntheticStream) {
        setLocalStream(syntheticStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = syntheticStream;
        }
      }
      return null;
    }
  }, []);

  // Toggle Microphone
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      const newState = !isAudioEnabled;
      audioTracks.forEach((track) => {
        track.enabled = newState;
      });
      setIsAudioEnabled(newState);
      socket?.emit('update-media-state', { audioEnabled: newState });
    }
  }, [localStream, isAudioEnabled, socket]);

  // Toggle Camera
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      const newState = !isVideoEnabled;
      videoTracks.forEach((track) => {
        track.enabled = newState;
      });
      setIsVideoEnabled(newState);
      socket?.emit('update-media-state', { videoEnabled: newState });
    }
  }, [localStream, isVideoEnabled, socket]);

  // Toggle Screen Sharing
  const toggleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.onended = () => {
          stopScreenSharing();
        };

        // Replace track in peer connections
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
        socket?.emit('update-media-state', { screenSharing: true });
      } catch (err) {
        console.warn('Screen share canceled or failed:', err);
      }
    } else {
      stopScreenSharing();
    }
  }, [isScreenSharing, socket]);

  const stopScreenSharing = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }
    setIsScreenSharing(false);
    socket?.emit('update-media-state', { screenSharing: false });
  }, [localStream, socket]);

  // Create WebRTC Peer Connection with STUN servers
  const createPeerConnection = useCallback((targetSocketId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Add local tracks to peer connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('signal-ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Remote Track Handler
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams((prev) => new Map(prev).set(targetSocketId, remoteStream));
      }
    };

    peerConnectionsRef.current.set(targetSocketId, pc);
    return pc;
  }, [localStream, socket]);

  // Signaling Event Listeners
  useEffect(() => {
    if (!socket) return;

    const handleSignalOffer = async (payload: { senderSocketId: string; offer: any }) => {
      const pc = createPeerConnection(payload.senderSocketId);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('signal-answer', {
        targetSocketId: payload.senderSocketId,
        answer,
      });
    };

    const handleSignalAnswer = async (payload: { senderSocketId: string; answer: any }) => {
      const pc = peerConnectionsRef.current.get(payload.senderSocketId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
      }
    };

    const handleSignalIceCandidate = async (payload: { senderSocketId: string; candidate: any }) => {
      const pc = peerConnectionsRef.current.get(payload.senderSocketId);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    };

    socket.on('signal-offer', handleSignalOffer);
    socket.on('signal-answer', handleSignalAnswer);
    socket.on('signal-ice-candidate', handleSignalIceCandidate);

    return () => {
      socket.off('signal-offer', handleSignalOffer);
      socket.off('signal-answer', handleSignalAnswer);
      socket.off('signal-ice-candidate', handleSignalIceCandidate);
    };
  }, [socket, createPeerConnection]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
    };
  }, [localStream]);

  return {
    localStream,
    localVideoRef,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    isSpeaking,
    mediaError,
    initLocalStream,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    createPeerConnection,
  };
}

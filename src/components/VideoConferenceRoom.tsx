import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  MessageSquare,
  Users,
  Copy,
  Check,
  Send,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Volume2,
  Maximize2,
  Minimize2,
  Zap,
  Info,
  Sliders,
} from 'lucide-react';
import { Room, Participant, ChatMessage, User } from '../types';
import { useWebRTC } from '../hooks/useWebRTC';
import { Socket } from 'socket.io-client';
import { api } from '../services/api';

interface VideoConferenceRoomProps {
  room: Room;
  currentUser: User;
  socket: Socket | null;
  initialParticipants?: Participant[];
  initialMessages?: ChatMessage[];
  onLeaveRoom: () => void;
  onRoomFull: (room: Room) => void;
}

export const VideoConferenceRoom: React.FC<VideoConferenceRoomProps> = ({
  room,
  currentUser,
  socket,
  initialParticipants = [],
  initialMessages = [],
  onLeaveRoom,
  onRoomFull,
}) => {
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [messageInput, setMessageInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentCapacityCount, setCurrentCapacityCount] = useState<number>(room.currentParticipantsCount || 1);
  const [maxCapacity, setMaxCapacity] = useState<number>(room.maxParticipants);
  const [concurrencyTesting, setConcurrencyTesting] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // WebRTC Media Hook
  const {
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
  } = useWebRTC({
    socket,
    roomId: room.id,
    userId: currentUser.id,
    userName: currentUser.name,
  });

  // Start local stream upon joining
  useEffect(() => {
    initLocalStream();
  }, [initLocalStream]);

  // Connect local video element to local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isScreenSharing]);

  // Socket Event Listeners for room updates, capacity, and chat
  useEffect(() => {
    if (!socket) return;

    const handleParticipantJoined = (data: { participant: Participant; currentCount: number; remainingSlots: number }) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.socketId === data.participant.socketId)) return prev;
        return [...prev, data.participant];
      });
      setCurrentCapacityCount(data.currentCount);

      // WebRTC Offer to newly arrived peer
      if (data.participant.socketId !== socket.id) {
        const pc = createPeerConnection(data.participant.socketId);
        pc.createOffer().then((offer) => {
          pc.setLocalDescription(offer);
          socket.emit('signal-offer', {
            targetSocketId: data.participant.socketId,
            offer,
          });
        });
      }
    };

    const handleParticipantLeft = (data: { socketId: string; name: string; currentCount: number }) => {
      setParticipants((prev) => prev.filter((p) => p.socketId !== data.socketId));
      setCurrentCapacityCount(data.currentCount);
    };

    const handleCapacityUpdated = (data: { roomId: string; currentCount: number; maxCapacity: number }) => {
      if (data.roomId === room.id) {
        setCurrentCapacityCount(data.currentCount);
        if (data.maxCapacity) setMaxCapacity(data.maxCapacity);
      }
    };

    const handleMediaChanged = (data: { socketId: string; mediaState: any }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === data.socketId ? { ...p, ...data.mediaState } : p))
      );
    };

    const handleNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (!isChatOpen) {
        setUnreadChatCount((count) => count + 1);
      }
    };

    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('capacity-updated', handleCapacityUpdated);
    socket.on('participant-media-changed', handleMediaChanged);
    socket.on('new-message', handleNewMessage);

    return () => {
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('capacity-updated', handleCapacityUpdated);
      socket.off('participant-media-changed', handleMediaChanged);
      socket.off('new-message', handleNewMessage);
    };
  }, [socket, room.id, isChatOpen, createPeerConnection]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (isChatOpen) {
      setUnreadChatCount(0);
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !socket) return;
    socket.emit('send-message', { content: messageInput });
    setMessageInput('');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?room=${room.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit('leave-room');
    }
    onLeaveRoom();
  };

  // Run in-room stress test
  const triggerInRoomStressTest = async () => {
    setConcurrencyTesting(true);
    try {
      await api.stressTestCapacity(room.id, 15);
    } catch (err) {
      console.error(err);
    } finally {
      setConcurrencyTesting(false);
    }
  };

  const remainingSlots = Math.max(0, maxCapacity - currentCapacityCount);
  const fillPercent = Math.min(100, Math.round((currentCapacityCount / maxCapacity) * 100));

  // Determine pill status color
  let capacityBadgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (fillPercent >= 100) {
    capacityBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  } else if (fillPercent >= 80) {
    capacityBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Conference Bar */}
      <div className="h-14 px-4 sm:px-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 truncate">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-white truncate max-w-[200px] sm:max-w-md">
              {room.title}
            </span>
            <div className="hidden sm:flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
              <span>{room.code}</span>
              <button onClick={handleCopyCode} title="Copier le code">
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
              </button>
            </div>
          </div>
        </div>

        {/* Live Atomic Capacity Counter */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-2 ${capacityBadgeColor}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Places : {currentCapacityCount} / {maxCapacity}
            </span>
            <span className="hidden md:inline text-slate-400 font-normal">
              ({remainingSlots} {remainingSlots > 1 ? 'libres' : 'libre'})
            </span>
          </div>

          <button
            onClick={handleCopyLink}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            title="Copier le lien d'invitation"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Lien copié' : 'Inviter'}</span>
          </button>

          {/* Quick saturation test */}
          <button
            onClick={triggerInRoomStressTest}
            disabled={concurrencyTesting}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-medium transition disabled:opacity-50"
            title="Simuler un afflux de participants pour tester le verrou atomique Redis"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">{concurrencyTesting ? 'Test...' : 'Test Saturation'}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace (Video Grid + Drawers) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left/Center: Video Grid */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto flex items-center justify-center">
          <div className="w-full h-full max-w-6xl flex items-center justify-center">
            {/* Grid Layout depending on count */}
            <div
              className={`w-full h-full grid gap-3 ${
                participants.length === 0
                  ? 'grid-cols-1 max-w-3xl max-h-[80vh]'
                  : participants.length === 1
                  ? 'grid-cols-1 sm:grid-cols-2 max-h-[85vh]'
                  : participants.length <= 3
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 max-h-[85vh]'
                  : 'grid-cols-2 md:grid-cols-3 max-h-[90vh]'
              }`}
            >
              {/* Local Participant Video Box */}
              <div
                className={`relative w-full h-full min-h-[220px] rounded-2xl overflow-hidden bg-slate-900 border transition-all duration-200 flex items-center justify-center ${
                  isSpeaking ? 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'border-slate-800'
                }`}
              >
                {/* Local Video Tag */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition duration-300 ${
                    !isVideoEnabled && !isScreenSharing ? 'hidden' : ''
                  }`}
                />

                {/* Avatar fallback if camera is turned off */}
                {!isVideoEnabled && !isScreenSharing && (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="relative">
                      {isSpeaking && (
                        <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-audio-ring" />
                      )}
                      <img
                        src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.name)}`}
                        alt={currentUser.name}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-indigo-500/40 object-cover shadow-xl relative z-10"
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-200">{currentUser.name} (Vous)</span>
                    <span className="text-xs text-slate-500">Caméra désactivée</span>
                  </div>
                )}

                {/* Overlays (Name tag & Mute Indicators) */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800/80 text-xs font-medium text-white flex items-center gap-1.5 shadow-md">
                    <span>{currentUser.name} (Vous)</span>
                    {isScreenSharing && (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                        Écran
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isAudioEnabled && (
                      <div className="p-1.5 rounded-lg bg-rose-500/80 backdrop-blur-md text-white shadow-md">
                        <MicOff className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {isSpeaking && isAudioEnabled && (
                      <div className="px-2 py-1 rounded-lg bg-emerald-500/90 text-slate-950 text-[10px] font-bold flex items-center gap-1 shadow-md">
                        <Volume2 className="w-3 h-3 animate-pulse" />
                        <span>Parle</span>
                      </div>
                    )}
                  </div>
                </div>

                {mediaError && (
                  <div className="absolute top-3 left-3 right-3 p-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{mediaError}</span>
                  </div>
                )}
              </div>

              {/* Remote Participants */}
              {participants.map((p) => {
                const stream = remoteStreams.get(p.socketId);
                return (
                  <div
                    key={p.socketId}
                    className="relative w-full h-full min-h-[220px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center group"
                  >
                    {stream ? (
                      <video
                        autoPlay
                        playsInline
                        ref={(el) => {
                          if (el && el.srcObject !== stream) {
                            el.srcObject = stream;
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <img
                          src={p.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name)}`}
                          alt={p.name}
                          className="w-20 h-20 rounded-full border-2 border-slate-700 object-cover shadow-lg"
                        />
                        <span className="text-sm font-semibold text-slate-200">{p.name}</span>
                        <span className="text-xs text-slate-500">Flux WebRTC prêt</span>
                      </div>
                    )}

                    {/* Remote Name & Status */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      <div className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs font-medium text-white flex items-center gap-1.5 shadow-md">
                        <span>{p.name}</span>
                        {p.isHost && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                            Hôte
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!p.audioEnabled && (
                          <div className="p-1.5 rounded-lg bg-rose-500/80 backdrop-blur-md text-white shadow-md">
                            <MicOff className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side Drawer: Chat */}
        {isChatOpen && (
          <div className="w-80 sm:w-96 border-l border-slate-800 bg-slate-900 flex flex-col shrink-0 z-20 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">Discussion de la salle</h3>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                Fermer
              </button>
            </div>

            {/* Messages List */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-xs ${
                    msg.isSystem
                      ? 'p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-center text-slate-400 italic'
                      : msg.senderId === currentUser.id
                      ? 'ml-auto max-w-[85%] text-right'
                      : 'mr-auto max-w-[85%]'
                  }`}
                >
                  {!msg.isSystem && (
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                      <span className="font-bold text-slate-300">{msg.senderName}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>
                  )}
                  {!msg.isSystem ? (
                    <div
                      className={`p-3 rounded-2xl leading-relaxed text-left ${
                        msg.senderId === currentUser.id
                          ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20'
                          : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60'
                      }`}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Envoyer un message à la salle..."
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Side Drawer: Participants */}
        {isParticipantsOpen && (
          <div className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col shrink-0 z-20 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">
                  Participants ({currentCapacityCount} / {maxCapacity})
                </h3>
              </div>
              <button
                onClick={() => setIsParticipantsOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                Fermer
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {/* Local User item */}
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.name)}`}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full border border-indigo-500/50 object-cover"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">{currentUser.name} (Vous)</span>
                    <span className="text-[10px] text-indigo-400 font-medium">Participant Actif</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  {isAudioEnabled ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                  {isVideoEnabled ? <Video className="w-3.5 h-3.5 text-emerald-400" /> : <VideoOff className="w-3.5 h-3.5 text-slate-500" />}
                </div>
              </div>

              {/* Remote Participants */}
              {participants.map((p) => (
                <div key={p.socketId} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={p.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name)}`}
                      alt={p.name}
                      className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-200 block truncate max-w-[130px]">{p.name}</span>
                      <span className="text-[10px] text-slate-500">{p.isHost ? 'Animateur' : 'Membre'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    {p.audioEnabled ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                    {p.videoEnabled ? <Video className="w-3.5 h-3.5 text-emerald-400" /> : <VideoOff className="w-3.5 h-3.5 text-slate-500" />}
                  </div>
                </div>
              ))}

              {/* Remaining Empty Slots visualization */}
              {Array.from({ length: Math.min(5, remainingSlots) }).map((_, i) => (
                <div
                  key={`empty_${i}`}
                  className="p-2 rounded-xl border border-dashed border-slate-800 text-slate-600 text-xs flex items-center justify-between"
                >
                  <span className="italic text-[11px]">Emplacement libre ({i + 1})</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-500">Disponible</span>
                </div>
              ))}
              {remainingSlots > 5 && (
                <p className="text-center text-[11px] text-slate-500 py-1">
                  + {remainingSlots - 5} autres places disponibles
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="h-20 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-xl px-4 flex items-center justify-center shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Microphone */}
          <button
            onClick={toggleAudio}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border transition active:scale-95 ${
              isAudioEnabled
                ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
            }`}
            title={isAudioEnabled ? 'Désactiver le micro' : 'Activer le micro'}
          >
            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleVideo}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border transition active:scale-95 ${
              isVideoEnabled
                ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
            }`}
            title={isVideoEnabled ? 'Couper la caméra' : 'Allumer la caméra'}
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border transition active:scale-95 ${
              isScreenSharing
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white'
            }`}
            title={isScreenSharing ? 'Arrêter le partage' : 'Partager l\'écran'}
          >
            <ScreenShare className="w-5 h-5" />
          </button>

          <div className="w-[1px] h-8 bg-slate-800 mx-1" />

          {/* Chat Toggle */}
          <button
            onClick={() => {
              setIsChatOpen(!isChatOpen);
              if (isParticipantsOpen) setIsParticipantsOpen(false);
            }}
            className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-2xl border transition active:scale-95 ${
              isChatOpen
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white'
            }`}
            title="Discussion"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadChatCount > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-slate-950">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Participants Toggle */}
          <button
            onClick={() => {
              setIsParticipantsOpen(!isParticipantsOpen);
              if (isChatOpen) setIsChatOpen(false);
            }}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border transition active:scale-95 ${
              isParticipantsOpen
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white'
            }`}
            title="Liste des participants"
          >
            <Users className="w-5 h-5" />
          </button>

          <div className="w-[1px] h-8 bg-slate-800 mx-1" />

          {/* Leave Conference (Red) */}
          <button
            onClick={handleLeave}
            className="flex items-center gap-2 px-5 h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-600/30 transition active:scale-95"
            title="Quitter la réunion et libérer la place atomiquement"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline">Quitter</span>
          </button>
        </div>
      </div>
    </div>
  );
};

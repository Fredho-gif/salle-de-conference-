import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RoomCard } from './components/RoomCard';
import { CreateRoomModal } from './components/CreateRoomModal';
import { RoomFullModal } from './components/RoomFullModal';
import { ArchitectureModal } from './components/ArchitectureModal';
import { AuthModal } from './components/AuthModal';
import { VideoConferenceRoom } from './components/VideoConferenceRoom';
import { Room, User, Participant, ChatMessage } from './types';
import { api } from './services/api';
import { getSocket } from './services/socket';
import {
  Users,
  Plus,
  ArrowRight,
  ShieldCheck,
  Zap,
  Cpu,
  Layers,
  Search,
  Sparkles,
  Lock,
  RefreshCw,
  Video,
} from 'lucide-react';

const DEFAULT_USER: User = {
  id: 'usr_default_admin',
  email: 'architect@conferoom.io',
  name: 'Alexandre Martin (Architecte)',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString(),
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('conferoom_user');
    return saved ? JSON.parse(saved) : DEFAULT_USER;
  });

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<Participant[]>([]);
  const [roomMessages, setRoomMessages] = useState<ChatMessage[]>([]);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [rejectedRoom, setRejectedRoom] = useState<Room | null>(null);

  const socket = getSocket();

  // Save current user to localStorage
  const handleUserChange = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('conferoom_user', JSON.stringify(user));
  };

  // Fetch rooms list
  const loadRooms = useCallback(async () => {
    try {
      const data = await api.getRooms();
      setRooms(data);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 4000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  // Handle URL param join (?room=CONF-1234)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && !activeRoom) {
      setJoinCodeInput(roomParam);
      handleJoinByIdentifier(roomParam);
    }
  }, []);

  // Join Room by Code or ID
  const handleJoinByIdentifier = async (identifier: string) => {
    if (!identifier.trim()) return;
    setJoinLoading(true);
    setJoinError(null);

    try {
      const room = await api.getRoom(identifier.trim());
      attemptJoinRoom(room);
    } catch (err: any) {
      setJoinError(err.message || 'Salle introuvable');
      setJoinLoading(false);
    }
  };

  // Attempt Admission with Atomic Capacity Check
  const attemptJoinRoom = (room: Room) => {
    setJoinLoading(true);
    setJoinError(null);

    // Socket.io Admission Handshake
    socket.emit('join-room', {
      roomId: room.id,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
      },
    });

    const handleJoinSuccess = (data: {
      room: Room;
      participant: Participant;
      participants: Participant[];
      messages: ChatMessage[];
      capacity: any;
    }) => {
      cleanupListeners();
      setJoinLoading(false);
      setActiveRoom(data.room);
      setRoomParticipants(data.participants || []);
      setRoomMessages(data.messages || []);
    };

    const handleJoinError = (data: { code: string; message: string; maxCapacity: number; currentCount: number }) => {
      cleanupListeners();
      setJoinLoading(false);
      if (data.code === 'ROOM_FULL') {
        setRejectedRoom({
          ...room,
          maxParticipants: data.maxCapacity,
          currentParticipantsCount: data.currentCount,
        });
      } else {
        setJoinError(data.message);
      }
    };

    const cleanupListeners = () => {
      socket.off('join-success', handleJoinSuccess);
      socket.off('join-error', handleJoinError);
    };

    socket.once('join-success', handleJoinSuccess);
    socket.once('join-error', handleJoinError);
  };

  // Leave active room
  const handleLeaveRoom = () => {
    setActiveRoom(null);
    setRoomParticipants([]);
    setRoomMessages([]);
    loadRooms();
    // remove query param if present
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  // Create Room
  const handleCreateRoom = async (data: { title: string; description: string; maxParticipants: number }) => {
    const newRoom = await api.createRoom({
      title: data.title,
      description: data.description,
      maxParticipants: data.maxParticipants,
      hostId: currentUser.id,
      hostName: currentUser.name,
    });
    await loadRooms();
    // Automatically join the newly created room
    attemptJoinRoom(newRoom);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        currentUser={currentUser}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenArchitecture={() => setIsArchitectureOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        activeRoomTitle={activeRoom?.title}
        onLeaveRoom={handleLeaveRoom}
      />

      {/* Main View: Either Conference Room or Dashboard */}
      {activeRoom ? (
        <VideoConferenceRoom
          room={activeRoom}
          currentUser={currentUser}
          socket={socket}
          initialParticipants={roomParticipants}
          initialMessages={roomMessages}
          onLeaveRoom={handleLeaveRoom}
          onRoomFull={(r) => setRejectedRoom(r)}
        />
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Hero Banner */}
          <div className="relative rounded-3xl overflow-hidden p-6 sm:p-10 border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-2xl relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Architecture Distribuée • LiveKit SFU • Verrous Atomiques Redis</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Visioconférence haute capacité avec{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-200 bg-clip-text text-transparent">
                  contrôle atomique strict
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Créez des salles configurables de 2 à 200 participants. Chaque place est vérifiée en O(1) via un
                script Lua Redis : zéro surréservation, libération instantanée lors d'une déconnexion, audio/vidéo
                WebRTC fluide et chat temps réel.
              </p>

              {/* Quick Actions (Join by Code & Create) */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleJoinByIdentifier(joinCodeInput);
                  }}
                  className="flex-1 max-w-md flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1.5 focus-within:border-indigo-500 transition shadow-inner"
                >
                  <Search className="w-4 h-4 text-slate-500 ml-2.5 shrink-0" />
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="Code de réunion (ex: CONF-7489)..."
                    className="flex-1 bg-transparent px-3 py-1.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none uppercase font-mono"
                  />
                  <button
                    type="submit"
                    disabled={joinLoading || !joinCodeInput.trim()}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm transition active:scale-95 disabled:opacity-40"
                  >
                    {joinLoading ? 'Vérification...' : 'Rejoindre'}
                  </button>
                </form>

                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm border border-slate-700/80 transition active:scale-95"
                >
                  <Plus className="w-4 h-4 text-indigo-400" />
                  <span>Nouvelle réunion</span>
                </button>
              </div>

              {joinError && (
                <p className="text-xs text-rose-400 font-medium">{joinError}</p>
              )}
            </div>
          </div>

          {/* Active Conferences Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-indigo-400" />
                  <span>Salles de conférence actives</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Affichage en direct des participants, capacité restante et verrous de présence
                </p>
              </div>

              <button
                onClick={loadRooms}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-medium transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
            </div>

            {loadingRooms ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-44 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">Aucune salle en cours</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Créez la première salle de conférence pour tester l'architecture WebRTC.
                </p>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                >
                  Créer une salle
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onJoin={(r) => attemptJoinRoom(r)}
                    onStressTest={(r) => {
                      setIsArchitectureOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Architecture & Tech Specs Summary Card */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Fiabilité Limite de Capacité</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Le point critique de l'application est garanti par un script Lua atomique Redis (<code className="text-indigo-300">SCARD + SADD</code>). Même avec 100 requêtes concurrentes à la même milliseconde, il est mathématiquement impossible de dépasser la capacité configurée.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-violet-400 font-bold text-sm">
                <Zap className="w-4 h-4" />
                <span>Libération Automatique de Place</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dès qu'un participant ferme son onglet ou perd sa connexion, le gestionnaire Socket.io capture l'événement <code className="text-violet-300">disconnect</code>, retire le membre de Redis et répercute immédiatement la place disponible aux autres utilisateurs.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Cpu className="w-4 h-4" />
                <span>SFU LiveKit & WebRTC Dédié</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Support d'un flux WebRTC optimisé avec gestion du microphone, caméra, partage d'écran haute résolution et adaptabilité de débit pour résister aux instabilités de réseau.
              </p>
            </div>
          </div>
        </main>
      )}

      {/* Modals */}
      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateRoom}
      />

      <RoomFullModal
        isOpen={!!rejectedRoom}
        onClose={() => setRejectedRoom(null)}
        room={rejectedRoom}
        onRetry={() => {
          if (rejectedRoom) attemptJoinRoom(rejectedRoom);
        }}
        isRetrying={joinLoading}
      />

      <ArchitectureModal
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
        rooms={rooms}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onUserChange={handleUserChange}
      />
    </div>
  );
}

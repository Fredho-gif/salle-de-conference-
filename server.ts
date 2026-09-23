import express, { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());

// In-Memory Database representing PostgreSQL + Redis Store
interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

interface Room {
  id: string;
  code: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  maxParticipants: number;
  currentParticipantsCount: number;
  createdAt: string;
  isPrivate?: boolean;
}

interface Participant {
  id: string;
  userId: string;
  socketId: string;
  name: string;
  avatarUrl?: string;
  isHost: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  joinedAt: string;
}

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isSystem?: boolean;
}

// Data Stores
const users = new Map<string, User>();
const rooms = new Map<string, Room>();
const roomParticipants = new Map<string, Map<string, Participant>>(); // roomId -> (socketId -> Participant)
const roomMessages = new Map<string, ChatMessage[]>();

// Seed default users
const defaultUser: User = {
  id: 'usr_default_admin',
  email: 'architect@conferoom.io',
  name: 'Alexandre Martin (Architecte)',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString(),
};
users.set(defaultUser.id, defaultUser);

// Seed 3 realistic demo rooms
const demoRooms: Room[] = [
  {
    id: 'room_demo_sprint',
    code: 'CONF-7489',
    title: 'Daily Standup & Revue Sprint 42',
    description: 'Point d\'équipe quotidien et synchronisation des chantiers en cours.',
    hostId: defaultUser.id,
    hostName: defaultUser.name,
    maxParticipants: 8,
    currentParticipantsCount: 0,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'room_demo_allhands',
    code: 'TECH-1024',
    title: 'Keynote & Démo Architecture WebRTC',
    description: 'Présentation du cluster SFU Mediasoup & contrôle atomique Redis.',
    hostId: defaultUser.id,
    hostName: defaultUser.name,
    maxParticipants: 25,
    currentParticipantsCount: 0,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'room_demo_interview',
    code: 'VIP-0004',
    title: 'Entretien Technique Privé (2 Personnes)',
    description: 'Session exclusive limitée strictement à 2 participants pour tests de saturation.',
    hostId: defaultUser.id,
    hostName: defaultUser.name,
    maxParticipants: 2,
    currentParticipantsCount: 0,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  }
];

demoRooms.forEach((r) => {
  rooms.set(r.id, r);
  roomParticipants.set(r.id, new Map());
  roomMessages.set(r.id, [
    {
      id: `msg_welcome_${r.id}`,
      roomId: r.id,
      senderId: 'system',
      senderName: 'Système',
      content: `Bienvenue dans la salle "${r.title}". La capacité maximale est fixée à ${r.maxParticipants} participants.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true,
    }
  ]);
});

/**
 * ATOMIC CAPACITY ENGINE (Mirrors Redis Lua script semantics in-memory)
 * Redis Equivalent:
 * local count = redis.call('SCARD', 'room:' .. roomId .. ':participants')
 * if count >= maxCap and not redis.call('SISMEMBER', 'room:' .. roomId .. ':participants', userId) then
 *    return { 0, count, maxCap }
 * end
 * redis.call('SADD', 'room:' .. roomId .. ':participants', userId)
 * return { 1, count + 1, maxCap }
 */
class AtomicCapacityManager {
  private static locks = new Map<string, Promise<void>>();

  // Mutex lock per room to guarantee zero race conditions during parallel requests
  private static async acquireLock(roomId: string): Promise<() => void> {
    while (this.locks.has(roomId)) {
      await this.locks.get(roomId);
    }
    let resolver: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    this.locks.set(roomId, lockPromise);

    return () => {
      this.locks.delete(roomId);
      resolver();
    };
  }

  static async tryAcquireSeat(
    roomId: string,
    participant: Participant
  ): Promise<{ success: boolean; reason?: string; currentCount: number; maxCapacity: number; remainingSlots: number }> {
    const release = await this.acquireLock(roomId);
    try {
      const room = rooms.get(roomId);
      if (!room) {
        return { success: false, reason: 'ROOM_NOT_FOUND', currentCount: 0, maxCapacity: 0, remainingSlots: 0 };
      }

      let participants = roomParticipants.get(roomId);
      if (!participants) {
        participants = new Map();
        roomParticipants.set(roomId, participants);
      }

      // Check if participant already in room
      if (participants.has(participant.socketId)) {
        return {
          success: true,
          currentCount: participants.size,
          maxCapacity: room.maxParticipants,
          remainingSlots: room.maxParticipants - participants.size,
        };
      }

      // ATOMIC CHECK: If room is at or exceeds max capacity, refuse immediately
      if (participants.size >= room.maxParticipants) {
        return {
          success: false,
          reason: 'ROOM_FULL',
          currentCount: participants.size,
          maxCapacity: room.maxParticipants,
          remainingSlots: 0,
        };
      }

      // Add participant atomically
      participants.set(participant.socketId, participant);
      room.currentParticipantsCount = participants.size;

      return {
        success: true,
        currentCount: participants.size,
        maxCapacity: room.maxParticipants,
        remainingSlots: room.maxParticipants - participants.size,
      };
    } finally {
      release();
    }
  }

  static async releaseSeat(roomId: string, socketId: string): Promise<{ released: boolean; currentCount: number; maxCapacity: number }> {
    const release = await this.acquireLock(roomId);
    try {
      const room = rooms.get(roomId);
      const participants = roomParticipants.get(roomId);

      if (!room || !participants || !participants.has(socketId)) {
        return { released: false, currentCount: room ? room.currentParticipantsCount : 0, maxCapacity: room ? room.maxParticipants : 0 };
      }

      participants.delete(socketId);
      room.currentParticipantsCount = participants.size;

      return {
        released: true,
        currentCount: participants.size,
        maxCapacity: room.maxParticipants,
      };
    } finally {
      release();
    }
  }
}

// REST API ROUTES
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeRooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

// Authentication
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email requis' });
  }

  // Find or create
  let user = Array.from(users.values()).find((u) => u.email === email);
  if (!user) {
    user = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email,
      name: name || email.split('@')[0],
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      createdAt: new Date().toISOString(),
    };
    users.set(user.id, user);
  }

  return res.json({
    user,
    token: `jwt_mock_${user.id}_${Date.now()}`,
  });
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, name } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'Nom et email requis' });
  }

  const existing = Array.from(users.values()).find((u) => u.email === email);
  if (existing) {
    return res.status(409).json({ error: 'Cet email est déjà enregistré' });
  }

  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email,
    name,
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    createdAt: new Date().toISOString(),
  };
  users.set(newUser.id, newUser);

  return res.json({
    user: newUser,
    token: `jwt_mock_${newUser.id}_${Date.now()}`,
  });
});

// Rooms List & Details
app.get('/api/rooms', (req: Request, res: Response) => {
  const roomList = Array.from(rooms.values()).map((r) => {
    const participants = roomParticipants.get(r.id);
    const count = participants ? participants.size : 0;
    return {
      ...r,
      currentParticipantsCount: count,
      remainingSlots: Math.max(0, r.maxParticipants - count),
      isFull: count >= r.maxParticipants,
    };
  });
  return res.json(roomList);
});

app.post('/api/rooms', (req: Request, res: Response) => {
  const { title, description, maxParticipants, hostId, hostName } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Titre de la salle obligatoire' });
  }

  const parsedMax = Number(maxParticipants) || 10;
  if (parsedMax < 2 || parsedMax > 500) {
    return res.status(400).json({ error: 'La capacité doit être comprise entre 2 et 500 participants' });
  }

  const code = `ROOM-${Math.floor(1000 + Math.random() * 9000)}`;
  const id = `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newRoom: Room = {
    id,
    code,
    title,
    description: description || 'Conférence interactive',
    hostId: hostId || 'usr_anonymous',
    hostName: hostName || 'Animateur',
    maxParticipants: parsedMax,
    currentParticipantsCount: 0,
    createdAt: new Date().toISOString(),
  };

  rooms.set(id, newRoom);
  roomParticipants.set(id, new Map());
  roomMessages.set(id, [
    {
      id: `msg_${Date.now()}`,
      roomId: id,
      senderId: 'system',
      senderName: 'Système',
      content: `Salle créée par ${newRoom.hostName}. Capacité maximale fixée à ${newRoom.maxParticipants} participants.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true,
    }
  ]);

  return res.status(201).json(newRoom);
});

app.get('/api/rooms/:identifier', (req: Request, res: Response) => {
  const { identifier } = req.params;
  const room = Array.from(rooms.values()).find((r) => r.id === identifier || r.code === identifier.toUpperCase());

  if (!room) {
    return res.status(404).json({ error: 'Salle introuvable' });
  }

  const participants = roomParticipants.get(room.id);
  const count = participants ? participants.size : 0;

  return res.json({
    ...room,
    currentParticipantsCount: count,
    remainingSlots: Math.max(0, room.maxParticipants - count),
    isFull: count >= room.maxParticipants,
    participants: participants ? Array.from(participants.values()) : [],
  });
});

// Capacity Stress Test Endpoint (simulates N concurrent requests to prove zero race conditions)
app.post('/api/rooms/:id/stress-test', async (req: Request, res: Response) => {
  const { id } = req.params;
  const room = rooms.get(id);
  if (!room) return res.status(404).json({ error: 'Salle introuvable' });

  const attemptsCount = Number(req.body.attempts) || 30;
  const results: { id: number; accepted: boolean; currentCount: number }[] = [];

  // Launch parallel attempts simulating rapid race condition
  const promises = Array.from({ length: attemptsCount }).map(async (_, idx) => {
    const mockParticipant: Participant = {
      id: `sim_${idx}_${Date.now()}`,
      userId: `user_sim_${idx}`,
      socketId: `socket_sim_${idx}_${Math.random()}`,
      name: `Robot Test #${idx + 1}`,
      isHost: false,
      audioEnabled: true,
      videoEnabled: true,
      screenSharing: false,
      joinedAt: new Date().toISOString(),
    };

    const resAcq = await AtomicCapacityManager.tryAcquireSeat(id, mockParticipant);
    results.push({
      id: idx + 1,
      accepted: resAcq.success,
      currentCount: resAcq.currentCount,
    });
    return resAcq;
  });

  await Promise.all(promises);

  const acceptedTotal = results.filter((r) => r.accepted).length;
  const rejectedTotal = results.filter((r) => !r.accepted).length;
  const participants = roomParticipants.get(id);
  const actualCount = participants ? participants.size : 0;

  // Broadcast updated room state
  io.to(id).emit('capacity-updated', {
    roomId: id,
    currentCount: actualCount,
    maxCapacity: room.maxParticipants,
    remainingSlots: Math.max(0, room.maxParticipants - actualCount),
  });

  return res.json({
    roomId: id,
    maxCapacity: room.maxParticipants,
    attemptsCount,
    acceptedTotal,
    rejectedTotal,
    finalCount: actualCount,
    strictCapRespected: actualCount <= room.maxParticipants,
    results: results.slice(0, 15), // sample
  });
});

// Reset room participants
app.post('/api/rooms/:id/reset-participants', (req: Request, res: Response) => {
  const { id } = req.params;
  const room = rooms.get(id);
  if (!room) return res.status(404).json({ error: 'Salle introuvable' });

  const participants = roomParticipants.get(id);
  if (participants) {
    // Notify all connected sockets before reset
    participants.forEach((p) => {
      io.to(p.socketId).emit('room-reset');
    });
    participants.clear();
  }
  room.currentParticipantsCount = 0;

  io.to(id).emit('capacity-updated', {
    roomId: id,
    currentCount: 0,
    maxCapacity: room.maxParticipants,
    remainingSlots: room.maxParticipants,
  });

  return res.json({ success: true, message: 'Participants réinitialisés avec succès' });
});

// SOCKET.IO SIGNALING & PRESENCE MANAGEMENT
io.on('connection', (socket: Socket) => {
  let currentRoomId: string | null = null;
  let currentParticipant: Participant | null = null;

  // Join Room with Atomic Capacity Check
  socket.on('join-room', async (data: { roomId: string; user: { id: string; name: string; avatarUrl?: string } }) => {
    const { roomId, user } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('join-error', {
        code: 'ROOM_NOT_FOUND',
        message: 'La salle de conférence demandée n\'existe pas ou a expiré.',
      });
      return;
    }

    const participant: Participant = {
      id: `part_${socket.id}`,
      userId: user.id,
      socketId: socket.id,
      name: user.name || 'Invité',
      avatarUrl: user.avatarUrl,
      isHost: room.hostId === user.id,
      audioEnabled: true,
      videoEnabled: true,
      screenSharing: false,
      joinedAt: new Date().toISOString(),
    };

    // ATOMIC LOCK ACQUISITION
    const admission = await AtomicCapacityManager.tryAcquireSeat(roomId, participant);

    if (!admission.success) {
      // Rejection with clear information
      socket.emit('join-error', {
        code: 'ROOM_FULL',
        message: `Accès refusé : la salle a atteint sa capacité maximale de ${admission.maxCapacity} participants.`,
        currentCount: admission.currentCount,
        maxCapacity: admission.maxCapacity,
        remainingSlots: 0,
      });
      return;
    }

    // Success! Bind socket to room
    currentRoomId = roomId;
    currentParticipant = participant;
    socket.join(roomId);

    const participantsMap = roomParticipants.get(roomId) || new Map();
    const existingParticipants = Array.from(participantsMap.values()).filter((p) => p.socketId !== socket.id);
    const messages = roomMessages.get(roomId) || [];

    // Notify client of successful admission
    socket.emit('join-success', {
      room,
      participant,
      participants: existingParticipants,
      messages,
      capacity: {
        currentCount: admission.currentCount,
        maxCapacity: admission.maxCapacity,
        remainingSlots: admission.remainingSlots,
      },
    });

    // Notify other peers in room of new joiner
    socket.to(roomId).emit('participant-joined', {
      participant,
      currentCount: admission.currentCount,
      remainingSlots: admission.remainingSlots,
    });

    // Broadcast capacity update to everyone in room and global listeners
    io.to(roomId).emit('capacity-updated', {
      roomId,
      currentCount: admission.currentCount,
      maxCapacity: admission.maxCapacity,
      remainingSlots: admission.remainingSlots,
    });

    // Add system join message in chat
    const systemMsg: ChatMessage = {
      id: `sys_${Date.now()}_${Math.random()}`,
      roomId,
      senderId: 'system',
      senderName: 'Système',
      content: `${participant.name} a rejoint la conférence.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true,
    };
    if (roomMessages.has(roomId)) {
      roomMessages.get(roomId)!.push(systemMsg);
    }
    io.to(roomId).emit('new-message', systemMsg);
  });

  // Media State Toggles (Audio, Video, Screen)
  socket.on('update-media-state', (state: { audioEnabled?: boolean; videoEnabled?: boolean; screenSharing?: boolean }) => {
    if (!currentRoomId || !currentParticipant) return;

    if (state.audioEnabled !== undefined) currentParticipant.audioEnabled = state.audioEnabled;
    if (state.videoEnabled !== undefined) currentParticipant.videoEnabled = state.videoEnabled;
    if (state.screenSharing !== undefined) currentParticipant.screenSharing = state.screenSharing;

    // Update in store
    const participants = roomParticipants.get(currentRoomId);
    if (participants && participants.has(socket.id)) {
      participants.set(socket.id, currentParticipant);
    }

    // Broadcast to room peers
    socket.to(currentRoomId).emit('participant-media-changed', {
      socketId: socket.id,
      mediaState: state,
    });
  });

  // WebRTC P2P / SFU Signaling (Offer, Answer, ICE Candidates)
  socket.on('signal-offer', (payload: { targetSocketId: string; offer: any }) => {
    io.to(payload.targetSocketId).emit('signal-offer', {
      senderSocketId: socket.id,
      senderName: currentParticipant?.name || 'Pair',
      offer: payload.offer,
    });
  });

  socket.on('signal-answer', (payload: { targetSocketId: string; answer: any }) => {
    io.to(payload.targetSocketId).emit('signal-answer', {
      senderSocketId: socket.id,
      answer: payload.answer,
    });
  });

  socket.on('signal-ice-candidate', (payload: { targetSocketId: string; candidate: any }) => {
    io.to(payload.targetSocketId).emit('signal-ice-candidate', {
      senderSocketId: socket.id,
      candidate: payload.candidate,
    });
  });

  // In-Room Chat Message
  socket.on('send-message', (data: { content: string }) => {
    if (!currentRoomId || !currentParticipant || !data.content?.trim()) return;

    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      roomId: currentRoomId,
      senderId: currentParticipant.userId,
      senderName: currentParticipant.name,
      content: data.content.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const messages = roomMessages.get(currentRoomId) || [];
    messages.push(msg);
    if (messages.length > 200) messages.shift(); // keep last 200
    roomMessages.set(currentRoomId, messages);

    io.to(currentRoomId).emit('new-message', msg);
  });

  // Explicit Leave Room
  socket.on('leave-room', async () => {
    await handleLeave();
  });

  // Disconnection Handler (Automatic seat release & race condition prevention)
  socket.on('disconnect', async () => {
    await handleLeave();
  });

  async function handleLeave() {
    if (!currentRoomId || !currentParticipant) return;

    const roomId = currentRoomId;
    const participant = currentParticipant;

    currentRoomId = null;
    currentParticipant = null;

    // ATOMIC SEAT RELEASE
    const releaseRes = await AtomicCapacityManager.releaseSeat(roomId, socket.id);

    if (releaseRes.released) {
      // Notify remaining peers
      socket.to(roomId).emit('participant-left', {
        socketId: socket.id,
        participantId: participant.id,
        name: participant.name,
        currentCount: releaseRes.currentCount,
        remainingSlots: releaseRes.maxCapacity - releaseRes.currentCount,
      });

      // Broadcast capacity update
      io.to(roomId).emit('capacity-updated', {
        roomId,
        currentCount: releaseRes.currentCount,
        maxCapacity: releaseRes.maxCapacity,
        remainingSlots: releaseRes.maxCapacity - releaseRes.currentCount,
      });

      // Add system leave message
      const systemMsg: ChatMessage = {
        id: `sys_${Date.now()}_${Math.random()}`,
        roomId,
        senderId: 'system',
        senderName: 'Système',
        content: `${participant.name} a quitté la conférence. Place libérée (${releaseRes.currentCount}/${releaseRes.maxCapacity}).`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: true,
      };
      if (roomMessages.has(roomId)) {
        roomMessages.get(roomId)!.push(systemMsg);
      }
      io.to(roomId).emit('new-message', systemMsg);
    }

    socket.leave(roomId);
  }
});

// Serve frontend with Vite in dev mode, or static in production
async function startServer() {
  const PORT = process.env.PORT || 3000;

  if (process.env.NODE_ENV === 'production') {
    // Serve static files from dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Setup Vite middleware for local development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, () => {
    console.log(`🚀 ConfeRoom Backend Server running on http://localhost:${PORT}`);
    console.log(`📡 Socket.io signaling gateway mounted & ready.`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

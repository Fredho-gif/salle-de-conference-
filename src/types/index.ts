export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Room {
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

export interface Participant {
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

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isSystem?: boolean;
}

export interface JoinRoomResponse {
  success: boolean;
  error?: string;
  errorCode?: 'ROOM_FULL' | 'ROOM_NOT_FOUND' | 'ALREADY_JOINED' | 'UNAUTHORIZED';
  room?: Room;
  participants?: Participant[];
  currentCount?: number;
  maxCapacity?: number;
  remainingSlots?: number;
}

export interface MediaStateChange {
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  screenSharing?: boolean;
}

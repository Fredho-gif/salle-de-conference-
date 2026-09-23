import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RedisCapacityService } from '../redis/redis-capacity.service';
import { RoomsService } from '../rooms/rooms.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SignalingGateway.name);

  // Map to track socket metadata: socketId -> { roomId, userId, userName }
  private activeSockets = new Map<
    string,
    { roomId: string; userId: string; userName: string; avatarUrl?: string }
  >();

  constructor(
    private readonly redisCapacityService: RedisCapacityService,
    private readonly roomsService: RoomsService
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const metadata = this.activeSockets.get(client.id);

    if (metadata) {
      const { roomId, userId, userName } = metadata;
      this.activeSockets.delete(client.id);

      // ATOMIC SEAT RELEASE IN REDIS
      const releaseRes = await this.redisCapacityService.releaseSeat(roomId, userId);

      // Notify other room participants
      this.server.to(roomId).emit('participant-left', {
        socketId: client.id,
        userId,
        name: userName,
        currentCount: releaseRes.currentCount,
      });

      // Update room capacity globally
      this.server.to(roomId).emit('capacity-updated', {
        roomId,
        currentCount: releaseRes.currentCount,
      });

      // Notify leave in DB
      await this.roomsService.leaveRoom(roomId, userId, client.id);
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; userName: string; avatarUrl?: string }
  ) {
    const { roomId, userId, userName, avatarUrl } = data;

    const room = await this.roomsService.getRoomByIdentifier(roomId);
    if (!room) {
      client.emit('join-error', { code: 'ROOM_NOT_FOUND', message: 'Salle introuvable' });
      return;
    }

    // ATOMIC REDIS CAPACITY CHECK
    const admission = await this.redisCapacityService.tryAcquireSeat(
      room.id,
      userId,
      client.id,
      room.maxParticipants
    );

    if (!admission.allowed) {
      client.emit('join-error', {
        code: 'ROOM_FULL',
        message: `Salle complète : la limite de ${room.maxParticipants} participants est atteinte.`,
        currentCount: admission.currentCount,
        maxCapacity: room.maxParticipants,
        remainingSlots: 0,
      });
      return;
    }

    // Register active socket
    this.activeSockets.set(client.id, { roomId: room.id, userId, userName, avatarUrl });
    client.join(room.id);

    // Respond success
    client.emit('join-success', {
      room,
      participant: {
        socketId: client.id,
        userId,
        name: userName,
        avatarUrl,
        audioEnabled: true,
        videoEnabled: true,
        screenSharing: false,
      },
      capacity: {
        currentCount: admission.currentCount,
        maxCapacity: room.maxParticipants,
        remainingSlots: admission.remainingSlots,
      },
    });

    // Broadcast new participant to other room members
    client.to(room.id).emit('participant-joined', {
      socketId: client.id,
      userId,
      name: userName,
      avatarUrl,
      currentCount: admission.currentCount,
      remainingSlots: admission.remainingSlots,
    });

    // Broadcast capacity update to room
    this.server.to(room.id).emit('capacity-updated', {
      roomId: room.id,
      currentCount: admission.currentCount,
      maxCapacity: room.maxParticipants,
      remainingSlots: admission.remainingSlots,
    });
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    await this.handleDisconnect(client);
    client.leave(client.rooms.values().next().value);
  }

  // WebRTC Signaling Events (Peer-to-Peer or SFU Bridge)
  @SubscribeMessage('signal-offer')
  handleOffer(@ConnectedSocket() client: Socket, @MessageBody() payload: { targetSocketId: string; offer: any }) {
    this.server.to(payload.targetSocketId).emit('signal-offer', {
      senderSocketId: client.id,
      offer: payload.offer,
    });
  }

  @SubscribeMessage('signal-answer')
  handleAnswer(@ConnectedSocket() client: Socket, @MessageBody() payload: { targetSocketId: string; answer: any }) {
    this.server.to(payload.targetSocketId).emit('signal-answer', {
      senderSocketId: client.id,
      answer: payload.answer,
    });
  }

  @SubscribeMessage('signal-ice-candidate')
  handleIceCandidate(@ConnectedSocket() client: Socket, @MessageBody() payload: { targetSocketId: string; candidate: any }) {
    this.server.to(payload.targetSocketId).emit('signal-ice-candidate', {
      senderSocketId: client.id,
      candidate: payload.candidate,
    });
  }

  // Media state changes (Mute Mic, Turn Video Off, Screen Share)
  @SubscribeMessage('media-state-change')
  handleMediaState(@ConnectedSocket() client: Socket, @MessageBody() payload: { audioEnabled?: boolean; videoEnabled?: boolean; screenSharing?: boolean }) {
    const meta = this.activeSockets.get(client.id);
    if (!meta) return;

    client.to(meta.roomId).emit('participant-media-changed', {
      socketId: client.id,
      mediaState: payload,
    });
  }

  // Chat in Room
  @SubscribeMessage('send-chat-message')
  handleChatMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: { content: string }) {
    const meta = this.activeSockets.get(client.id);
    if (!meta || !payload.content) return;

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      roomId: meta.roomId,
      senderId: meta.userId,
      senderName: meta.userName,
      content: payload.content.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    this.server.to(meta.roomId).emit('new-message', message);
  }
}

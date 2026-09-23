import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { Message } from '../entities/message.entity';
import { RedisCapacityService } from '../redis/redis-capacity.service';
import { LivekitService } from '../sfu/livekit.service';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private participantsRepository: Repository<RoomParticipant>,
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    private redisCapacityService: RedisCapacityService,
    private livekitService: LivekitService
  ) {}

  async createRoom(dto: { title: string; description?: string; maxParticipants: number; hostId: string }) {
    if (dto.maxParticipants < 2 || dto.maxParticipants > 500) {
      throw new BadRequestException('Le nombre de participants doit être compris entre 2 et 500.');
    }

    const code = `CONF-${Math.floor(1000 + Math.random() * 9000)}`;

    const room = this.roomsRepository.create({
      code,
      title: dto.title,
      description: dto.description,
      hostId: dto.hostId,
      maxParticipants: dto.maxParticipants,
      isActive: true,
    });

    return this.roomsRepository.save(room);
  }

  async listActiveRooms() {
    const rooms = await this.roomsRepository.find({
      where: { isActive: true },
      relations: ['host'],
      order: { createdAt: 'DESC' },
    });

    // Enrich with live Redis participant count
    const enriched = await Promise.all(
      rooms.map(async (r) => {
        const count = await this.redisCapacityService.getCurrentCount(r.id);
        return {
          id: r.id,
          code: r.code,
          title: r.title,
          description: r.description,
          hostName: r.host?.name || 'Animateur',
          maxParticipants: r.maxParticipants,
          currentParticipantsCount: count,
          remainingSlots: Math.max(0, r.maxParticipants - count),
          isFull: count >= r.maxParticipants,
          createdAt: r.createdAt,
        };
      })
    );

    return enriched;
  }

  async getRoomByIdentifier(identifier: string) {
    const room = await this.roomsRepository.findOne({
      where: [{ id: identifier }, { code: identifier.toUpperCase() }],
      relations: ['host'],
    });

    if (!room) {
      throw new NotFoundException('Salle de conférence introuvable.');
    }

    const currentCount = await this.redisCapacityService.getCurrentCount(room.id);

    return {
      ...room,
      hostName: room.host?.name || 'Animateur',
      currentParticipantsCount: currentCount,
      remainingSlots: Math.max(0, room.maxParticipants - currentCount),
      isFull: currentCount >= room.maxParticipants,
    };
  }

  async checkAndJoinRoom(roomId: string, userId: string, socketId: string, userName: string) {
    const room = await this.roomsRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Salle introuvable');
    }

    // Atomic seat acquisition in Redis
    const admission = await this.redisCapacityService.tryAcquireSeat(
      room.id,
      userId,
      socketId,
      room.maxParticipants
    );

    if (!admission.allowed) {
      return {
        success: false,
        reason: 'ROOM_FULL',
        message: `La salle est complète (${room.maxParticipants}/${room.maxParticipants} participants max).`,
        currentCount: admission.currentCount,
        maxCapacity: room.maxParticipants,
      };
    }

    // Generate SFU Token if allowed
    const livekitToken = await this.livekitService.generateJoinToken(room.id, userId, userName);

    // Save DB participation
    await this.participantsRepository.save({
      roomId: room.id,
      userId,
      socketId,
      isHost: room.hostId === userId,
      audioEnabled: true,
      videoEnabled: true,
      screenSharing: false,
    });

    return {
      success: true,
      room,
      livekitToken,
      livekitUrl: this.livekitService.getServerUrl(),
      currentCount: admission.currentCount,
      remainingSlots: admission.remainingSlots,
      maxCapacity: room.maxParticipants,
    };
  }

  async leaveRoom(roomId: string, userId: string, socketId: string) {
    await this.redisCapacityService.releaseSeat(roomId, userId);
    await this.participantsRepository.update(
      { roomId, socketId },
      { leftAt: new Date() }
    );
  }
}

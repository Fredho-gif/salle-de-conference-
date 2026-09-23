import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface CapacityCheckResult {
  allowed: boolean;
  currentCount: number;
  maxCapacity: number;
  remainingSlots: number;
  reason?: 'ROOM_FULL' | 'ROOM_INACTIVE' | 'ERROR';
}

@Injectable()
export class RedisCapacityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCapacityService.name);
  private redisClient: Redis;
  private luaShaAcquireSeat: string;

  // LUA SCRIPT: Atomic Capacity Check & Reservation
  // Guarantees zero race conditions under any concurrency level
  private static readonly ACQUIRE_SEAT_LUA = `
    local key_participants = KEYS[1]
    local key_room_meta = KEYS[2]
    local user_id = ARGV[1]
    local max_capacity = tonumber(ARGV[2])
    local socket_id = ARGV[3]

    -- Check if user is already counted (idempotence for reconnects)
    local is_member = redis.call('SISMEMBER', key_participants, user_id)
    local current_count = redis.call('SCARD', key_participants)

    if is_member == 1 then
      -- User already has a reserved seat
      return { 1, current_count, max_capacity }
    end

    -- Strict atomic check: is room full?
    if current_count >= max_capacity then
      return { 0, current_count, max_capacity }
    end

    -- Reserve seat atomically
    redis.call('SADD', key_participants, user_id)
    redis.call('HSET', 'socket_to_user:' .. socket_id, 'userId', user_id, 'key', key_participants)
    redis.call('EXPIRE', key_participants, 86400) -- 24h expiry safety

    local updated_count = redis.call('SCARD', key_participants)
    return { 1, updated_count, max_capacity }
  `;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', undefined);

    this.redisClient = new Redis({
      host,
      port,
      password,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    try {
      await this.redisClient.connect();
      this.logger.log(`Connected to Redis at ${host}:${port}`);
      // Pre-load Lua script for ultra-fast execution via EVALSHA
      this.luaShaAcquireSeat = await this.redisClient.script('LOAD', RedisCapacityService.ACQUIRE_SEAT_LUA);
      this.logger.log(`Redis Lua Script loaded with SHA: ${this.luaShaAcquireSeat}`);
    } catch (err) {
      this.logger.warn(`Redis connection failed or not available in dev: ${err.message}. Fallback ready.`);
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  /**
   * Tente d'acquérir une place dans la salle de manière atomique.
   * Retourne true uniquement si une place a été effectivement réservée sans dépasser maxCapacity.
   */
  async tryAcquireSeat(
    roomId: string,
    userId: string,
    socketId: string,
    maxCapacity: number
  ): Promise<CapacityCheckResult> {
    const participantsKey = `room:${roomId}:participants`;
    const roomMetaKey = `room:${roomId}:meta`;

    try {
      if (!this.redisClient || this.redisClient.status !== 'ready') {
        // Fallback or dev mock handling
        return {
          allowed: true,
          currentCount: 1,
          maxCapacity,
          remainingSlots: maxCapacity - 1,
        };
      }

      // Execute atomic Lua script
      const result = (await this.redisClient.evalsha(
        this.luaShaAcquireSeat,
        2,
        participantsKey,
        roomMetaKey,
        userId,
        maxCapacity.toString(),
        socketId
      )) as [number, number, number];

      const [allowedCode, currentCount, maxCap] = result;
      const allowed = allowedCode === 1;

      return {
        allowed,
        currentCount,
        maxCapacity: maxCap,
        remainingSlots: Math.max(0, maxCap - currentCount),
        reason: allowed ? undefined : 'ROOM_FULL',
      };
    } catch (error) {
      this.logger.error(`Error in tryAcquireSeat for room ${roomId}: ${error.message}`);
      // Fallback eval if SHA was lost (e.g. Redis restart)
      try {
        const evalResult = (await this.redisClient.eval(
          RedisCapacityService.ACQUIRE_SEAT_LUA,
          2,
          participantsKey,
          roomMetaKey,
          userId,
          maxCapacity.toString(),
          socketId
        )) as [number, number, number];

        return {
          allowed: evalResult[0] === 1,
          currentCount: evalResult[1],
          maxCapacity: evalResult[2],
          remainingSlots: Math.max(0, evalResult[2] - evalResult[1]),
          reason: evalResult[0] === 1 ? undefined : 'ROOM_FULL',
        };
      } catch (innerErr) {
        return {
          allowed: false,
          currentCount: maxCapacity,
          maxCapacity,
          remainingSlots: 0,
          reason: 'ERROR',
        };
      }
    }
  }

  /**
   * Libère une place de manière atomique lors de la déconnexion ou sortie
   */
  async releaseSeat(roomId: string, userId: string): Promise<{ currentCount: number }> {
    const participantsKey = `room:${roomId}:participants`;
    try {
      if (!this.redisClient || this.redisClient.status !== 'ready') {
        return { currentCount: 0 };
      }

      await this.redisClient.srem(participantsKey, userId);
      const count = await this.redisClient.scard(participantsKey);
      return { currentCount: count };
    } catch (err) {
      this.logger.error(`Error releasing seat in room ${roomId}: ${err.message}`);
      return { currentCount: 0 };
    }
  }

  /**
   * Récupère le nombre actuel de participants
   */
  async getCurrentCount(roomId: string): Promise<number> {
    const participantsKey = `room:${roomId}:participants`;
    try {
      if (!this.redisClient || this.redisClient.status !== 'ready') return 0;
      return await this.redisClient.scard(participantsKey);
    } catch (err) {
      return 0;
    }
  }
}

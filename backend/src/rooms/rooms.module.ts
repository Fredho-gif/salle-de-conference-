import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { Message } from '../entities/message.entity';
import { RedisModule } from '../redis/redis.module';
import { LivekitService } from '../sfu/livekit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomParticipant, Message]),
    RedisModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService, LivekitService],
  exports: [RoomsService],
})
export class RoomsModule {}

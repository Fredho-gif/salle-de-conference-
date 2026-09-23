import { Module } from '@nestjs/common';
import { SignalingGateway } from './signaling.gateway';
import { RedisModule } from '../redis/redis.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [RedisModule, RoomsModule],
  providers: [SignalingGateway],
  exports: [SignalingGateway],
})
export class SignalingModule {}

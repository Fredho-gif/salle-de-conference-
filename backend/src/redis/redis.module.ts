import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisCapacityService } from './redis-capacity.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisCapacityService],
  exports: [RedisCapacityService],
})
export class RedisModule {}

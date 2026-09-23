import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { RedisModule } from './redis/redis.module';
import { SignalingModule } from './signaling/signaling.module';
import { User } from './entities/user.entity';
import { Room } from './entities/room.entity';
import { RoomParticipant } from './entities/room-participant.entity';
import { Message } from './entities/message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'postgres'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'conferoom_user'),
        password: configService.get<string>('DB_PASSWORD', 'conferoom_password'),
        database: configService.get<string>('DB_NAME', 'conferoom_db'),
        entities: [User, Room, RoomParticipant, Message],
        synchronize: true, // Pour le MVP; en prod utiliser des migrations TypeORM
        logging: false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    RoomsModule,
    RedisModule,
    SignalingModule,
  ],
})
export class AppModule {}

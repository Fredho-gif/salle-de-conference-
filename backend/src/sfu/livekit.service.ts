import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private apiKey: string;
  private apiSecret: string;
  private livekitUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY', 'devkey');
    this.apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET', 'secret_livekit_key_2026');
    this.livekitUrl = this.configService.get<string>('LIVEKIT_URL', 'ws://localhost:7880');
  }

  /**
   * Génère un JWT de connexion WebRTC SFU LiveKit pour un participant autorisé
   */
  async generateJoinToken(roomId: string, participantId: string, participantName: string): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantId,
      name: participantName,
      ttl: '12h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }

  getServerUrl(): string {
    return this.livekitUrl;
  }
}

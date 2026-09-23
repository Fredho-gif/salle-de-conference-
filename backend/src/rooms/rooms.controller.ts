import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async listRooms() {
    return this.roomsService.listActiveRooms();
  }

  @Get(':identifier')
  async getRoom(@Param('identifier') identifier: string) {
    return this.roomsService.getRoomByIdentifier(identifier);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createRoom(
    @Request() req,
    @Body() body: { title: string; description?: string; maxParticipants: number }
  ) {
    return this.roomsService.createRoom({
      title: body.title,
      description: body.description,
      maxParticipants: Number(body.maxParticipants) || 10,
      hostId: req.user.userId,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/join')
  async joinRoom(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { socketId: string }
  ) {
    return this.roomsService.checkAndJoinRoom(
      id,
      req.user.userId,
      body.socketId,
      req.user.name
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/leave')
  async leaveRoom(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { socketId: string }
  ) {
    await this.roomsService.leaveRoom(id, req.user.userId, body.socketId);
    return { success: true, message: 'Place libérée avec succès.' };
  }
}

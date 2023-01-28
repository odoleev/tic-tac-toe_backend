import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnModuleInit } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MyGateway implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  onModuleInit(): any {
    this.server.on('connection', (socket) => {
      console.log(socket.id, 'Connected');
    });
  }

  @SubscribeMessage('join_game')
  async joinGame(
    @MessageBody() message: any,
    @ConnectedSocket() socket: Socket,
  ) {
    console.log('New user joining room: ', message);

    const connectedSockets = this.server.sockets.adapter.rooms.get(
      message.roomId,
    );
    const socketRooms = Array.from(socket.rooms.values()).filter(
      (room) => room !== socket.id,
    );

    if (
      socketRooms.length > 0 ||
      (connectedSockets && connectedSockets.size === 2)
    ) {
      socket.emit('room_join_error', {
        error: 'Room is full! Choose another one!',
      });
    } else {
      await socket.join(message.roomId);
      socket.emit('room_joined');

      if (this.server.sockets.adapter.rooms.get(message.roomId).size === 2) {
        socket.emit('start_game', { start: true, symbol: 'x' });
        socket
          .to(message.roomId)
          .emit('start_game', { start: false, symbol: 'o' });
      }
    }
  }

  private getSocketGameRoom(socket: Socket): string {
    const socketRooms = Array.from(socket.rooms.values()).filter(
      (room) => room !== socket.id,
    );
    const gameRoom = socketRooms && socketRooms[0];

    return gameRoom;
  }

  @SubscribeMessage('update_game')
  async updateGame(
    @MessageBody() body: any,
    @ConnectedSocket() socket: Socket,
  ) {
    const gameRoom = this.getSocketGameRoom(socket);
    socket.to(gameRoom).emit('on_game_update', body);
  }

  @SubscribeMessage('game_win')
  public async gameWin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() message: any,
  ) {
    const gameRoom = this.getSocketGameRoom(socket);
    socket.to(gameRoom).emit('on_game_win', message);
  }
}

import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all in development
    methods: ["GET", "POST"]
  }
});

// Rooms structure to track peers in a room
const rooms = new Map<string, string[]>();

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', (roomId: string) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }
    socket.join(roomId);
    rooms.get(roomId)?.push(socket.id);
    console.log(`Room created: ${roomId} by ${socket.id}`);
  });

  socket.on('join-room', (roomId: string) => {
    const room = rooms.get(roomId);
    if (room && room.length < 2) {
      socket.join(roomId);
      room.push(socket.id);
      console.log(`User ${socket.id} joined room: ${roomId}`);
      
      // Notify both peers that the room is ready for connection
      socket.to(roomId).emit('peer-joined', socket.id);
    } else if (room && room.length >= 2) {
      socket.emit('room-full');
    } else {
      socket.emit('room-not-found');
    }
  });

  // Signaling messages (offer, answer, ice-candidate)
  socket.on('signal', (data: { roomId: string, signal: any, to?: string }) => {
    if (data.to) {
      // Send directly to specific peer
      io.to(data.to).emit('signal', {
        signal: data.signal,
        from: socket.id
      });
    } else {
      // Broadcast to room
      socket.to(data.roomId).emit('signal', {
        signal: data.signal,
        from: socket.id
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove from rooms and notify peers
    for (const [roomId, peers] of rooms.entries()) {
      const index = peers.indexOf(socket.id);
      if (index !== -1) {
        peers.splice(index, 1);
        socket.to(roomId).emit('peer-disconnected', socket.id);
        if (peers.length === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});

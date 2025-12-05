/**
 * @file socketService.ts
 * @description Socket.io logic for handling real-time chat events.
 */

import { Server, Socket } from 'socket.io';
import { verifyToken } from '../middleware/auth';

/**
 * Interface for the Join Room event payload.
 */
interface JoinRoomPayload {
  roomId: string;
  userId: string;
}

/**
 * Interface for the Send Message event payload.
 */
interface SendMessagePayload {
  roomId: string;
  message: string;
  // Sender info might be inferred from the socket or passed in.
  // Based on requirements, we need to identify participants.
  // We will attach sender info to the message when broadcasting.
}

/**
 * Interface for Simple-peer signal event payload.
 * Simple-peer uses a single 'signal' event that contains offer, answer, or ICE candidate data.
 */
interface WebRTCSignalPayload {
  roomId: string;
  signal: any; // Simple-peer signal data (can be offer, answer, or ICE candidate)
  targetUserId?: string; // Optional: for direct peer-to-peer communication
}

/**
 * Interface for the User in the socket.
 */
interface SocketUser {
  uid: string;
  name?: string;
  email?: string;
  [key: string]: any;
}

// Extend the Socket interface to include user data
declare module 'socket.io' {
  interface Socket {
    user?: SocketUser;
  }
}

/**
 * Initializes the Socket.io server with event handlers.
 * @param {Server} io - The Socket.io server instance.
 */
export const initializeSocket = (io: Server): void => {
  // Middleware for authentication
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      // Verify the token using the auth middleware
      const decodedToken = await verifyToken(token as string);
      
      // Attach user info to the socket
      socket.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User', // Fallback name
      };

      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}, UserID: ${socket.user?.uid}`);

    /**
     * Handle 'join-room' event for WebRTC rooms.
     * Joins a socket to a specific room for WebRTC signaling with Simple-peer.
     */
    socket.on('join-room', (payload: JoinRoomPayload) => {
      const { roomId, userId } = payload;
      
      if (!roomId) {
        socket.emit('error', { message: 'roomId is required' });
        return;
      }

      // Join the Socket.io room
      socket.join(roomId);
      
      console.log(`User ${socket.user?.uid} (${socket.id}) joined room: ${roomId}`);
      
      // Notify other peers in the room that a new peer has joined
      socket.to(roomId).emit('peer-joined', {
        roomId,
        userId: socket.user?.uid || userId,
        socketId: socket.id,
      });

      // Notify the joining peer about existing peers in the room
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room) {
        const peersInRoom = Array.from(room)
          .filter(socketId => socketId !== socket.id)
          .map(socketId => {
            const peerSocket = io.sockets.sockets.get(socketId);
            return {
              socketId,
              userId: peerSocket?.user?.uid || 'unknown',
            };
          });
        
        socket.emit('room-peers', {
          roomId,
          peers: peersInRoom,
        });
      }
    });

    /**
     * Handle 'leave-room' event.
     * Removes a socket from a specific room.
     */
    socket.on('leave-room', (payload: { roomId: string }) => {
      const { roomId } = payload;
      
      if (!roomId) {
        socket.emit('error', { message: 'roomId is required' });
        return;
      }

      socket.leave(roomId);
      
      console.log(`User ${socket.user?.uid} (${socket.id}) left room: ${roomId}`);
      
      // Notify other peers in the room that a peer has left
      socket.to(roomId).emit('peer-left', {
        roomId,
        userId: socket.user?.uid,
        socketId: socket.id,
      });
    });

    /**
     * Handle 'webrtc-signal' event (Simple-peer compatible).
     * Simple-peer uses a single 'signal' event that encapsulates offer, answer, and ICE candidates.
     * This event ensures signals are only sent to peers within the same room.
     */
    socket.on('webrtc-signal', (payload: WebRTCSignalPayload) => {
      const { roomId, signal, targetUserId } = payload;
      
      if (!roomId) {
        socket.emit('error', { message: 'roomId is required' });
        return;
      }

      // Verify socket is in the room
      if (!socket.rooms.has(roomId)) {
        socket.emit('error', { message: 'You must join the room first' });
        return;
      }

      const signalData = {
        roomId,
        signal,
        fromUserId: socket.user?.uid,
        fromSocketId: socket.id,
      };

      if (targetUserId) {
        // Send to specific peer if targetUserId is provided
        const targetSocket = Array.from(io.sockets.sockets.values())
          .find((s: Socket) => s.user?.uid === targetUserId && s.rooms.has(roomId)) as Socket | undefined;
        
        if (targetSocket) {
          targetSocket.emit('webrtc-signal', signalData);
          console.log(`WebRTC signal sent to specific peer ${targetUserId} in room ${roomId}`);
        } else {
          socket.emit('error', { message: 'Target peer not found in room' });
        }
      } else {
        // Broadcast to all peers in the room except sender
        socket.to(roomId).emit('webrtc-signal', signalData);
        console.log(`WebRTC signal broadcasted in room ${roomId} from ${socket.user?.name}`);
      }
    });

    /**
     * Handle 'disconnect' event.
     * Cleans up rooms and notifies other peers when a user disconnects.
     */
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}, UserID: ${socket.user?.uid}`);
      
      // Notify all rooms that this peer has left
      // socket.rooms includes the socket's own room (socket.id) and all joined rooms
      socket.rooms.forEach((roomId: string) => {
        // Skip the socket's own room
        if (roomId !== socket.id) {
          socket.to(roomId).emit('peer-left', {
            roomId,
            userId: socket.user?.uid,
            socketId: socket.id,
          });
        }
      });
    });
  });
};


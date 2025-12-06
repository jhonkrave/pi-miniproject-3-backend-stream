# TeamLink - WebRTC Signaling Server

**TeamLink** is a real-time video conferencing platform developed as part of the **Proyecto Integrador** academic course. This repository contains the WebRTC signaling server that facilitates peer-to-peer connections for video and audio communication.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [WebRTC Signaling Flow](#webrtc-signaling-flow)
- [Security](#security)
- [Development](#development)
- [Deployment](#deployment)

## 🎯 Overview

This server acts as a **WebRTC signaling server** that enables real-time video and audio communication between multiple users. It uses Socket.io for real-time signaling and Firebase Authentication for secure user verification. The server facilitates the exchange of WebRTC signaling data (offers, answers, and ICE candidates) between peers in virtual rooms, allowing them to establish direct peer-to-peer connections.

**Important**: This server only handles signaling (control messages). The actual media streams (video/audio) flow directly between clients once the WebRTC connection is established (peer-to-peer).


### Components

- **Express Server**: HTTP server for health checks and API endpoints
- **Socket.io Server**: Real-time bidirectional communication for WebRTC signaling
- **Firebase Admin**: Token verification and user authentication
- **Room Management**: Virtual rooms for organizing video conferences

## ✨ Features

- 🔐 **Firebase Authentication**: Secure token-based authentication
- 🎥 **WebRTC Signaling**: Facilitates peer-to-peer video/audio connections
- 🏠 **Room Management**: Support for multiple concurrent video rooms
- 👥 **Multi-peer Support**: Handle multiple participants in a single room
- 📡 **Real-time Events**: Socket.io for instant signaling
- 🎯 **Targeted Signaling**: Send signals to specific peers or broadcast to all
- 🔄 **Auto-cleanup**: Automatic room cleanup on disconnect
- 🌐 **CORS Support**: Configurable cross-origin resource sharing

## 📦 Prerequisites

- **Node.js** >= 16.0.0
- **npm** or **yarn**
- **Firebase Project** with Authentication enabled
- **Firebase Service Account Key** (JSON file)

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pi-miniproject-3-backend-stream
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase credentials**
   - Place your Firebase service account key file at `api/config/serviceAccountKey.json`
   - Or set the `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` environment variable

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=9000

# CORS Configuration (comma-separated for multiple origins)
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com

# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=api/config/serviceAccountKey.json

# Node Environment
NODE_ENV=production
```

### Firebase Service Account Key

The server requires a Firebase service account key to verify authentication tokens. You can:

1. **Use local file**: Place the JSON file at `api/config/serviceAccountKey.json`
2. **Use environment variable**: Set `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` to the absolute path

**Note**: Never commit the service account key to version control. Add it to `.gitignore`.

## 💻 Usage

### Starting the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

The server will start on `http://localhost:9000` (or the port specified in `PORT`).

### Health Check

```bash
curl http://localhost:9000/
# Response: "Chat Server is running"
```

### Client Connection

Clients must connect using Socket.io with authentication:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:9000', {
  auth: {
    token: 'your-firebase-id-token'
  }
});
```

## 📡 API Reference

### Socket.io Events

#### Client → Server Events

##### `join-room`
Join a WebRTC room to start or participate in a video conference.

```javascript
socket.emit('join-room', {
  roomId: 'room-123',
  userId: 'user-456'
});
```

**Payload:**
- `roomId` (string, required): Unique identifier for the room
- `userId` (string, required): User identifier

**Response Events:**
- `room-peers`: List of existing peers in the room
- `peer-joined`: Emitted to other peers when you join

---

##### `leave-room`
Leave a WebRTC room.

```javascript
socket.emit('leave-room', {
  roomId: 'room-123'
});
```

**Payload:**
- `roomId` (string, required): Room identifier to leave

**Response Events:**
- `peer-left`: Emitted to other peers when you leave

---

##### `webrtc-signal`
Send WebRTC signaling data (offer, answer, or ICE candidate).

```javascript
socket.emit('webrtc-signal', {
  roomId: 'room-123',
  signal: offer, // or answer, or ICE candidate
  targetUserId: 'user-456' // optional: for direct peer communication
});
```

**Payload:**
- `roomId` (string, required): Room identifier
- `signal` (object, required): WebRTC signal (offer/answer/ICE candidate)
- `targetUserId` (string, optional): Send to specific peer, or omit to broadcast

**Response Events:**
- `webrtc-signal`: Forwarded to target peer(s) in the room
- `error`: If room validation fails

---

#### Server → Client Events

##### `peer-joined`
Emitted when a new peer joins the room.

```javascript
socket.on('peer-joined', (data) => {
  console.log('New peer:', data.userId);
  // data: { roomId, userId, socketId }
});
```

---

##### `peer-left`
Emitted when a peer leaves the room.

```javascript
socket.on('peer-left', (data) => {
  console.log('Peer left:', data.userId);
  // data: { roomId, userId, socketId }
});
```

---

##### `room-peers`
Emitted when joining a room, contains list of existing peers.

```javascript
socket.on('room-peers', (data) => {
  console.log('Peers in room:', data.peers);
  // data: { roomId, peers: [{ socketId, userId }] }
});
```

---

##### `webrtc-signal`
Emitted when receiving WebRTC signaling data from another peer.

```javascript
socket.on('webrtc-signal', (data) => {
  const { signal, fromUserId, fromSocketId } = data;
  // Process the signal (offer/answer/ICE candidate)
});
```

**Payload:**
- `roomId`: Room identifier
- `signal`: WebRTC signal data
- `fromUserId`: User ID of the sender
- `fromSocketId`: Socket ID of the sender

---

##### `error`
Emitted when an error occurs.

```javascript
socket.on('error', (error) => {
  console.error('Error:', error.message);
});
```

---

## 🔄 WebRTC Signaling Flow

### Typical Connection Flow

1. **Client A connects** → Authenticates with Firebase token
2. **Client A joins room** → Emits `join-room` event
3. **Client B connects** → Authenticates with Firebase token
4. **Client B joins room** → Emits `join-room` event
5. **Server notifies peers** → Client A receives `peer-joined`, Client B receives `room-peers`
6. **Client A creates offer** → Creates RTCPeerConnection offer
7. **Client A sends offer** → Emits `webrtc-signal` with offer
8. **Server forwards offer** → Client B receives `webrtc-signal` with offer
9. **Client B creates answer** → Creates RTCPeerConnection answer
10. **Client B sends answer** → Emits `webrtc-signal` with answer
11. **Server forwards answer** → Client A receives `webrtc-signal` with answer
12. **ICE candidates exchanged** → Both clients exchange ICE candidates via `webrtc-signal`
13. **P2P connection established** → Media streams flow directly between clients

### Example Client Implementation

```javascript
// Connect to server
const socket = io('http://localhost:9000', {
  auth: { token: firebaseToken }
});

// Join room
socket.emit('join-room', { roomId: 'room-123', userId: 'user-456' });

// Handle peer joined
socket.on('peer-joined', async (data) => {
  // Create peer connection
  const peerConnection = new RTCPeerConnection(config);
  
  // Create and send offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  
  socket.emit('webrtc-signal', {
    roomId: 'room-123',
    signal: offer,
    targetUserId: data.userId
  });
});

// Handle incoming signals
socket.on('webrtc-signal', async (data) => {
  const { signal, fromUserId } = data;
  
  if (signal.type === 'offer') {
    await peerConnection.setRemoteDescription(signal);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    socket.emit('webrtc-signal', {
      roomId: 'room-123',
      signal: answer,
      targetUserId: fromUserId
    });
  } else if (signal.type === 'answer') {
    await peerConnection.setRemoteDescription(signal);
  } else if (signal.candidate) {
    await peerConnection.addIceCandidate(signal);
  }
});
```

## 🔒 Security

### Authentication

- All connections require a valid Firebase ID token
- Tokens are verified using Firebase Admin SDK
- Invalid or missing tokens result in connection rejection

### Room Validation

- Users must join a room before sending signals
- Signals are only forwarded to peers in the same room
- Room membership is verified before signal forwarding

### Best Practices

1. **Never expose service account keys** in version control
2. **Use HTTPS** in production
3. **Validate room IDs** on the client side
4. **Implement rate limiting** for production deployments
5. **Monitor connection logs** for suspicious activity

## 🛠️ Development

### Project Structure

```
.
├── api/
│   ├── config/
│   │   └── serviceAccountKey.json    # Firebase credentials (gitignored)
│   ├── middleware/
│   │   └── auth.ts                    # Firebase token verification
│   ├── services/
│   │   └── socketService.ts           # Socket.io event handlers
│   └── index.ts                       # Server entry point
├── dist/                              # Compiled JavaScript (generated)
├── .env                               # Environment variables (gitignored)
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### Available Scripts

```bash
# Development
npm run dev          # Start server with ts-node (hot reload)

# Production
npm run build        # Compile TypeScript to JavaScript
npm start            # Start compiled server

# Code Quality
npm run lint         # Run ESLint
```

### TypeScript Configuration

The project uses TypeScript with strict type checking. Configuration is in `tsconfig.json`.

## 🚢 Deployment

### Environment Setup

1. Set environment variables on your hosting platform
2. Upload Firebase service account key (or use environment variable path)
3. Ensure Node.js >= 16.0.0 is available

### Build and Deploy

```bash
npm install
npm run build
npm start
```

### Recommended Platforms

- **Render**: Easy deployment with environment variable support
- **Heroku**: Supports Node.js applications
- **AWS EC2**: Full control over server configuration
- **DigitalOcean**: Simple droplet setup

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` with production domain(s)
- [ ] Secure Firebase service account key
- [ ] Enable HTTPS/SSL
- [ ] Set up monitoring and logging
- [ ] Configure firewall rules
- [ ] Set up process manager (PM2, systemd, etc.)

## 📝 License

This project is part of the **Proyecto Integrador** academic course.

## 👥 Contributors

Developed as part of the TeamLink project for the Proyecto Integrador course.

## 📞 Support

For issues or questions, please refer to the course documentation or contact the development team.

---

**TeamLink** - Real-time video conferencing platform | Proyecto Integrador

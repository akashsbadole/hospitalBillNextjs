import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ==================== ROOM / PEER TRACKING ====================

interface PeerInfo {
  socketId: string
  peerName: string
  roomId: string
  isInitiator: boolean
}

// roomId -> Set<socketId>
const rooms = new Map<string, Set<string>>()

// socketId -> PeerInfo
const peers = new Map<string, PeerInfo>()

const PORT = 3005

io.on('connection', (socket) => {
  console.log(`[VideoService] Peer connected: ${socket.id}`)

  // ==================== JOIN ROOM ====================
  socket.on(
    'join-room',
    (data: { roomId: string; peerName: string; isInitiator: boolean }) => {
      const { roomId, peerName, isInitiator } = data

      // Leave any previous room
      leaveCurrentRoom(socket.id)

      // Join the room
      socket.join(roomId)

      // Track peer
      const peerInfo: PeerInfo = {
        socketId: socket.id,
        peerName,
        roomId,
        isInitiator,
      }
      peers.set(socket.id, peerInfo)

      // Track room participants
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set())
      }
      rooms.get(roomId)!.add(socket.id)

      const participantCount = rooms.get(roomId)!.size
      console.log(
        `[VideoService] ${peerName} joined room ${roomId} (initiator=${isInitiator}, total=${participantCount})`
      )

      // Notify peer of room state
      socket.emit('room-joined', {
        roomId,
        participantCount,
        participants: getRoomParticipants(roomId),
      })

      // Notify others in the room
      socket.to(roomId).emit('peer-joined', {
        peerId: socket.id,
        peerName,
        isInitiator,
        participantCount,
      })
    }
  )

  // ==================== WEBRTC SIGNALING ====================

  // Forward SDP offer to the other peer in the room
  socket.on('offer', (data: { roomId: string; targetPeerId: string; sdp: RTCSessionDescriptionInit }) => {
    const { roomId, targetPeerId, sdp } = data
    console.log(`[VideoService] Offer from ${socket.id} to ${targetPeerId} in room ${roomId}`)
    io.to(targetPeerId).emit('offer', {
      sdp,
      fromPeerId: socket.id,
    })
  })

  // Forward SDP answer to the other peer in the room
  socket.on('answer', (data: { roomId: string; targetPeerId: string; sdp: RTCSessionDescriptionInit }) => {
    const { targetPeerId, sdp } = data
    console.log(`[VideoService] Answer from ${socket.id} to ${targetPeerId}`)
    io.to(targetPeerId).emit('answer', {
      sdp,
      fromPeerId: socket.id,
    })
  })

  // Forward ICE candidates
  socket.on('ice-candidate', (data: { roomId: string; targetPeerId: string; candidate: RTCIceCandidateInit }) => {
    const { targetPeerId, candidate } = data
    io.to(targetPeerId).emit('ice-candidate', {
      candidate,
      fromPeerId: socket.id,
    })
  })

  // ==================== LEAVE ROOM ====================
  socket.on('leave-room', (data: { roomId: string }) => {
    handleLeaveRoom(socket.id, data.roomId)
  })

  // ==================== END CALL (force end for all) ====================
  socket.on('end-call', (data: { roomId: string }) => {
    const { roomId } = data
    console.log(`[VideoService] Call ended in room ${roomId} by ${socket.id}`)
    // Notify ALL peers in the room that the call has ended
    io.to(roomId).emit('call-ended', {
      endedBy: socket.id,
      roomId,
    })
    // Clean up room
    cleanupRoom(roomId)
  })

  // ==================== DISCONNECT ====================
  socket.on('disconnect', (reason) => {
    console.log(`[VideoService] Peer disconnected: ${socket.id} (reason: ${reason})`)
    leaveCurrentRoom(socket.id)
    peers.delete(socket.id)
  })

  socket.on('error', (error) => {
    console.error(`[VideoService] Socket error (${socket.id}):`, error)
  })
})

// ==================== HELPER FUNCTIONS ====================

function getRoomParticipants(roomId: string): { peerId: string; peerName: string; isInitiator: boolean }[] {
  const roomSockets = rooms.get(roomId)
  if (!roomSockets) return []
  return Array.from(roomSockets).map((sid) => {
    const peer = peers.get(sid)
    return {
      peerId: sid,
      peerName: peer?.peerName || 'Unknown',
      isInitiator: peer?.isInitiator || false,
    }
  })
}

function leaveCurrentRoom(socketId: string) {
  const peer = peers.get(socketId)
  if (!peer) return

  const { roomId, peerName } = peer

  // Remove from room
  const room = rooms.get(roomId)
  if (room) {
    room.delete(socketId)
    if (room.size === 0) {
      rooms.delete(roomId)
      console.log(`[VideoService] Room ${roomId} is now empty, removed.`)
    } else {
      // Notify remaining peers
      io.to(roomId).emit('peer-left', {
        peerId: socketId,
        peerName,
        participantCount: room.size,
      })
      console.log(
        `[VideoService] ${peerName} left room ${roomId}, ${room.size} remaining`
      )
    }
  }
}

function handleLeaveRoom(socketId: string, roomId: string) {
  const peer = peers.get(socketId)
  const peerName = peer?.peerName || 'Unknown'
  console.log(`[VideoService] ${peerName} leaving room ${roomId}`)

  // Notify others
  const room = rooms.get(roomId)
  if (room) {
    room.delete(socketId)
    if (room.size === 0) {
      rooms.delete(roomId)
    } else {
      io.to(roomId).emit('peer-left', {
        peerId: socketId,
        peerName,
        participantCount: room.size,
      })
    }
  }

  // Remove from peers map
  peers.delete(socketId)
  const connectedSocket = io.sockets.sockets.get(socketId)
  if (connectedSocket) {
    connectedSocket.leave(roomId)
  }
}

function cleanupRoom(roomId: string) {
  const room = rooms.get(roomId)
  if (!room) return
  // Clean up all peers in this room
  for (const socketId of room) {
    peers.delete(socketId)
  }
  rooms.delete(roomId)
}

// ==================== START SERVER ====================

httpServer.listen(PORT, () => {
  console.log(`[VideoService] WebRTC signaling server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[VideoService] Received SIGTERM, shutting down...')
  httpServer.close(() => {
    console.log('[VideoService] Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[VideoService] Received SIGINT, shutting down...')
  httpServer.close(() => {
    console.log('[VideoService] Server closed')
    process.exit(0)
  })
})

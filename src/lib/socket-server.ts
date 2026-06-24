import { createServer } from 'http'
import { Server } from 'socket.io'

let io: Server | null = null

export function getIO(): Server | null {
  return io
}

export function startSocketServer(port: number = parseInt(process.env.SOCKET_PORT || '3001')) {
  const httpServer = createServer()

  io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  })

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`)

    socket.on('join-branch', (branchId: string) => {
      socket.join(`branch:${branchId}`)
      console.log(`[Socket.IO] ${socket.id} joined branch:${branchId}`)
    })

    socket.on('leave-branch', (branchId: string) => {
      socket.leave(`branch:${branchId}`)
    })

    socket.on('join-user', (userId: string) => {
      socket.join(`user:${userId}`)
    })

    socket.on('leave-user', (userId: string) => {
      socket.leave(`user:${userId}`)
    })

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(port, () => {
    console.log(`[Socket.IO] Real-time server running on port ${port}`)
  })

  return io
}

export function emitBranchEvent(branchId: string, event: string, data: unknown) {
  if (io) {
    io.to(`branch:${branchId}`).emit(event, data)
  }
}

export function emitUserEvent(userId: string, event: string, data: unknown) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data)
  }
}

export function emitGlobalEvent(event: string, data: unknown) {
  if (io) {
    io.emit(event, data)
  }
}

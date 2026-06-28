import { createServer } from 'http'
import { Server, type Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || ''

interface SocketTokenPayload {
  id: string
  userId: string
  email: string
  role: string
  branchId?: string
  type?: string
}

function verifySocketToken(token: string): SocketTokenPayload | null {
  if (!JWT_SECRET) return null
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SocketTokenPayload
    if (decoded.type !== 'access') return null
    return decoded
  } catch {
    return null
  }
}

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

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication required'))
    }
    const decoded = verifySocketToken(token)
    if (!decoded) {
      return next(new Error('Invalid or expired token'))
    }
    socket.data.user = decoded
    next()
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as SocketTokenPayload
    // eslint-disable-next-line no-console
    console.debug(`[Socket.IO] Client connected: ${socket.id} (user: ${user.userId})`)

    socket.on('join-branch', (branchId: string) => {
      if (typeof branchId !== 'string' || branchId.length > 100) return
      if (user.role !== 'Admin' && user.branchId !== branchId) return
      socket.join(`branch:${branchId}`)
      // eslint-disable-next-line no-console
      console.debug(`[Socket.IO] ${socket.id} joined branch:${branchId}`)
    })

    socket.on('leave-branch', (branchId: string) => {
      if (typeof branchId !== 'string') return
      socket.leave(`branch:${branchId}`)
    })

    socket.on('join-user', (userId: string) => {
      if (typeof userId !== 'string' || userId.length > 100) return
      if (user.userId !== userId && user.role !== 'Admin') return
      socket.join(`user:${userId}`)
    })

    socket.on('leave-user', (userId: string) => {
      if (typeof userId !== 'string') return
      socket.leave(`user:${userId}`)
    })

    socket.on('disconnect', () => {
      // eslint-disable-next-line no-console
      console.debug(`[Socket.IO] Client disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.debug(`[Socket.IO] Real-time server running on port ${port}`)
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

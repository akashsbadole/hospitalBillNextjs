'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/stores/auth'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'

interface BranchState {
  selectedBranchId: string | null
}

const useBranch = create<BranchState>()(
  persist<BranchState>(
    () => ({ selectedBranchId: null }),
    { name: 'medibill-branch' }
  )
)

let globalSocket: Socket | null = null
let globalSubscribers = 0

export function useRealtime() {
  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const user = useAuth((s: { user: { id: string } | null }) => s.user)
  const selectedBranchId = useBranch((s: BranchState) => s.selectedBranchId)

  useEffect(() => {
    if (!user) return

    if (!globalSocket) {
      globalSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      })

      globalSocket.on('connect', () => {
        console.warn('[Realtime] Connected:', globalSocket?.id)
      })

      globalSocket.on('disconnect', (reason: string) => {
        console.warn('[Realtime] Disconnected:', reason)
      })

      globalSocket.on('connect_error', (err: Error) => {
        console.warn('[Realtime] Connection error:', err.message)
      })
    }

    socketRef.current = globalSocket
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(globalSocket)
    globalSubscribers++

    if (globalSocket.connected) {
      globalSocket.emit('join-user', user.id)
      if (selectedBranchId) {
        globalSocket.emit('join-branch', selectedBranchId)
      }
    } else {
      globalSocket.on('connect', () => {
        globalSocket?.emit('join-user', user.id)
        if (selectedBranchId) {
          globalSocket?.emit('join-branch', selectedBranchId)
        }
      })
    }

    return () => {
      globalSubscribers--
      if (globalSubscribers <= 0 && globalSocket) {
        globalSocket.disconnect()
        globalSocket = null
        socketRef.current = null
      }
    }
  }, [user, selectedBranchId])

  useEffect(() => {
    if (globalSocket?.connected && selectedBranchId) {
      globalSocket.emit('join-branch', selectedBranchId)
    }
  }, [selectedBranchId])

  const subscribe = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    globalSocket?.on(event, handler)
    return () => {
      globalSocket?.off(event, handler)
    }
  }, [])

  const emit = useCallback((event: string, data?: unknown) => {
    globalSocket?.emit(event, data)
  }, [])

  return { subscribe, emit, socket }
}

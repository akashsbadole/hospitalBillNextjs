'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Maximize2,
  Minimize2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ==================== TYPES ====================

export type ConnectionStatus = 'Connecting' | 'Connected' | 'Reconnecting' | 'Disconnected'

interface VideoCallViewProps {
  callSessionId: string
  participantName: string
  onCallEnd: () => void
  isInitiator: boolean
  callType?: 'Video' | 'Audio'
  userName?: string
}

// ==================== ICE SERVERS ====================

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
}

// ==================== CONNECTION STATUS CONFIG ====================

function getConnectionStatusConfig(status: ConnectionStatus) {
  switch (status) {
    case 'Connecting':
      return {
        label: 'Connecting...',
        color: 'bg-amber-500',
        textColor: 'text-amber-100',
        animate: true,
      }
    case 'Connected':
      return {
        label: 'Connected',
        color: 'bg-emerald-500',
        textColor: 'text-emerald-100',
        animate: false,
      }
    case 'Reconnecting':
      return {
        label: 'Reconnecting...',
        color: 'bg-orange-500',
        textColor: 'text-orange-100',
        animate: true,
      }
    case 'Disconnected':
      return {
        label: 'Disconnected',
        color: 'bg-red-500',
        textColor: 'text-red-100',
        animate: false,
      }
  }
}

// ==================== CALL TIMER HOOK ====================

function useCallTimer(isActive: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!isActive) {
      startTimeRef.current = null
      cancelAnimationFrame(rafRef.current)
      return
    }

    startTimeRef.current = Date.now()

    const tick = () => {
      if (startTimeRef.current) {
         
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [isActive])

  // When not active, show 0 without triggering a state update
  return isActive ? elapsed : 0
}

function formatCallTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// ==================== MAIN COMPONENT ====================

export function VideoCallView({
  callSessionId,
  participantName,
  onCallEnd,
  isInitiator,
  callType = 'Video',
  userName = 'User',
}: VideoCallViewProps) {
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const hasCreatedOffer = useRef(false)
  const remotePeerIdRef = useRef<string | null>(null)
  const isScreenSharingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // State
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(callType === 'Audio')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Connecting')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [remotePeerConnected, setRemotePeerConnected] = useState(false)

  const elapsed = useCallTimer(remotePeerConnected)
  const isVideoCall = callType === 'Video'

  // ==================== GET USER MEDIA ====================

  const getLocalStream = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: isVideoCall
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            }
          : false,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      return stream
    } catch (err) {
      console.error('[VideoCallView] Failed to get user media:', err)
      // Fallback: audio only
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true })
        localStreamRef.current = audioOnly
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = audioOnly
        }
        return audioOnly
      } catch {
        console.error('[VideoCallView] Failed to get audio too')
        return null
      }
    }
  }, [isVideoCall])

  // ==================== ICE RESTART ====================

  const restartICE = useCallback(async (pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer({ iceRestart: true })
      await pc.setLocalDescription(offer)
      if (socketRef.current && remotePeerIdRef.current) {
        socketRef.current.emit('offer', {
          roomId: callSessionId,
          targetPeerId: remotePeerIdRef.current,
          sdp: pc.localDescription,
        })
      }
    } catch (err) {
      console.error('[VideoCallView] ICE restart failed:', err)
    }
  }, [callSessionId])

  // ==================== CREATE PEER CONNECTION ====================

  const createPeerConnection = useCallback(() => {
    // Clean up existing connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    const pc = new RTCPeerConnection(ICE_SERVERS)
    peerConnectionRef.current = pc

    // Add local tracks
    const localStream = localStreamRef.current
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream)
      })
    }

    // Handle incoming remote tracks
    const remoteStream = new MediaStream()
    remoteStreamRef.current = remoteStream
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream
    }

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track)
      })
      setRemotePeerConnected(true)
    }

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && remotePeerIdRef.current) {
        socketRef.current.emit('ice-candidate', {
          roomId: callSessionId,
          targetPeerId: remotePeerIdRef.current,
          candidate: event.candidate.toJSON(),
        })
      }
    }

    // Connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      switch (state) {
        case 'connected':
          setConnectionStatus('Connected')
          setRemotePeerConnected(true)
          break
        case 'connecting':
          setConnectionStatus('Connecting')
          break
        case 'disconnected':
        case 'failed':
          setConnectionStatus('Reconnecting')
          // Attempt ICE restart
          if (state === 'failed' && isInitiator && hasCreatedOffer.current) {
            // eslint-disable-next-line no-console
            console.log('[VideoCallView] ICE failed, restarting...')
            restartICE(pc)
          }
          break
        case 'closed':
          setConnectionStatus('Disconnected')
          setRemotePeerConnected(false)
          break
      }
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      if (state === 'connected' || state === 'completed') {
        setConnectionStatus('Connected')
        setRemotePeerConnected(true)
      }
    }

    return pc
  }, [callSessionId, isInitiator, restartICE])

  // ==================== CREATE AND SEND OFFER ====================

  const createAndSendOffer = useCallback(async () => {
    if (hasCreatedOffer.current) return

    const pc = peerConnectionRef.current || createPeerConnection()
    peerConnectionRef.current = pc

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      hasCreatedOffer.current = true

      if (socketRef.current && remotePeerIdRef.current) {
        socketRef.current.emit('offer', {
          roomId: callSessionId,
          targetPeerId: remotePeerIdRef.current,
          sdp: pc.localDescription,
        })
      }
    } catch (err) {
      console.error('[VideoCallView] Error creating offer:', err)
    }
  }, [callSessionId, createPeerConnection])

  // ==================== INIT SIGNALING ====================

  const initSignaling = useCallback(async () => {
    // Connect to signaling server
    const socket = io('/?XTransformPort=3005', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      // eslint-disable-next-line no-console
      console.log('[VideoCallView] Connected to signaling server')
      // Join the room
      socket.emit('join-room', {
        roomId: callSessionId,
        peerName: userName,
        isInitiator,
      })
    })

    socket.on('disconnect', () => {
      // eslint-disable-next-line no-console
      console.log('[VideoCallView] Disconnected from signaling server')
    })

    socket.on('room-joined', (data: { roomId: string; participantCount: number; participants: { peerId: string; peerName: string }[] }) => {
      // eslint-disable-next-line no-console
      console.log('[VideoCallView] Joined room:', data)
      // Find the other peer
      const otherPeer = data.participants.find((p) => p.peerId !== socket.id)
      if (otherPeer) {
        remotePeerIdRef.current = otherPeer.peerId
        // If we're the initiator and haven't created an offer yet, create one
        if (isInitiator && !hasCreatedOffer.current) {
          createAndSendOffer()
        }
      }
    })

    socket.on('peer-joined', (data: { peerId: string; peerName: string; isInitiator: boolean }) => {
      // eslint-disable-next-line no-console
      console.log('[VideoCallView] Peer joined:', data)
      remotePeerIdRef.current = data.peerId

      // If we're the initiator and haven't created an offer, create one
      if (isInitiator && !hasCreatedOffer.current) {
        // Small delay to ensure peer connection is ready
        setTimeout(() => createAndSendOffer(), 500)
      }
    })

    socket.on('peer-left', (data: { peerId: string; peerName: string; participantCount: number }) => {
      // eslint-disable-next-line no-console
      console.log('[VideoCallView] Peer left:', data)
      if (data.peerId === remotePeerIdRef.current) {
        setRemotePeerConnected(false)
        setConnectionStatus('Disconnected')
        remotePeerIdRef.current = null
        hasCreatedOffer.current = false

        // Clean up remote stream
        if (remoteStreamRef.current) {
          remoteStreamRef.current.getTracks().forEach((t) => t.stop())
          remoteStreamRef.current = null
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null
        }
      }
    })

    socket.on('call-ended', (data: { endedBy: string; roomId: string }) => {
      // eslint-disable-next-line no-console
      console.log('[VideoCallView] Call ended by:', data)
      onCallEnd()
    })

    // WebRTC signaling events
    socket.on('offer', async (data: { sdp: RTCSessionDescriptionInit; fromPeerId: string }) => {
      // eslint-disable-next-line no-console
      console.log('[VideoCallView] Received offer from:', data.fromPeerId)
      remotePeerIdRef.current = data.fromPeerId

      const pc = peerConnectionRef.current
      if (!pc) return

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        socket.emit('answer', {
          roomId: callSessionId,
          targetPeerId: data.fromPeerId,
          sdp: pc.localDescription,
        })
      } catch (err) {
        console.error('[VideoCallView] Error handling offer:', err)
      }
    })

    socket.on('answer', async (data: { sdp: RTCSessionDescriptionInit; fromPeerId: string }) => {
      // eslint-disable-next-line no-console
      console.log('[VideoCallView] Received answer from:', data.fromPeerId)
      const pc = peerConnectionRef.current
      if (!pc) return

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
      } catch (err) {
        console.error('[VideoCallView] Error handling answer:', err)
      }
    })

    socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit; fromPeerId: string }) => {
      const pc = peerConnectionRef.current
      if (!pc) return

      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
      } catch (err) {
        console.error('[VideoCallView] Error adding ICE candidate:', err)
      }
    })
  }, [callSessionId, isInitiator, onCallEnd, userName, createAndSendOffer])

  // ==================== TOGGLE AUDIO ====================

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current
    if (stream) {
      const audioTracks = stream.getAudioTracks()
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsAudioMuted((prev) => !prev)
    }
  }, [])

  // ==================== TOGGLE VIDEO ====================

  const toggleVideo = useCallback(async () => {
    const stream = localStreamRef.current
    if (!stream || !isVideoCall) return

    const videoTracks = stream.getVideoTracks()

    if (videoTracks.length === 0) {
      // No video track — try to get one
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
        const newTrack = videoStream.getVideoTracks()[0]
        if (newTrack && peerConnectionRef.current) {
          const sender = peerConnectionRef.current
            .getSenders()
            .find((s) => s.track?.kind === 'video')
          if (sender) {
            await sender.replaceTrack(newTrack)
          }
          stream.addTrack(newTrack)
          videoStream.getAudioTracks().forEach((t) => t.stop())
        }
        setIsVideoMuted(false)
      } catch {
        console.error('[VideoCallView] Could not get video track')
      }
      return
    }

    videoTracks.forEach((track) => {
      track.enabled = !track.enabled
    })
    setIsVideoMuted((prev) => !prev)
  }, [isVideoCall])

  // ==================== TOGGLE SCREEN SHARE ====================

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharingRef.current) {
      // Stop screen sharing
      const pc = peerConnectionRef.current
      if (pc && screenStreamRef.current) {
        const screenTrack = screenStreamRef.current.getVideoTracks()[0]
        const sender = pc.getSenders().find((s) => s.track === screenTrack)
        // Replace with camera track
        const camStream = localStreamRef.current
        if (camStream && sender) {
          const camTrack = camStream.getVideoTracks()[0]
          if (camTrack) {
            await sender.replaceTrack(camTrack)
          }
        }
        screenStreamRef.current.getTracks().forEach((t) => t.stop())
        screenStreamRef.current = null
      }
      isScreenSharingRef.current = false
      setIsScreenSharing(false)
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        })
        screenStreamRef.current = screenStream

        const pc = peerConnectionRef.current
        if (pc) {
          const screenTrack = screenStream.getVideoTracks()[0]
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
          if (sender && screenTrack) {
            await sender.replaceTrack(screenTrack)
          }
        }

        // Handle user stopping screen share via browser UI
        screenStream.getVideoTracks()[0].onended = async () => {
          const pc2 = peerConnectionRef.current
          if (pc2 && screenStreamRef.current) {
            const camStream = localStreamRef.current
            if (camStream) {
              const camTrack = camStream.getVideoTracks()[0]
              const s = pc2.getSenders().find((s2) => s2.track?.kind === 'video')
              if (s && camTrack) {
                await s.replaceTrack(camTrack)
              }
            }
          }
          screenStreamRef.current?.getTracks().forEach((t) => t.stop())
          screenStreamRef.current = null
          isScreenSharingRef.current = false
          setIsScreenSharing(false)
        }

        isScreenSharingRef.current = true
        setIsScreenSharing(true)
      } catch (err) {
        console.error('[VideoCallView] Screen share failed:', err)
      }
    }
  }, [])

  // ==================== PICTURE IN PICTURE ====================

  const togglePiP = useCallback(async () => {
    const video = remoteVideoRef.current
    if (!video) return

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await video.requestPictureInPicture()
      }
    } catch (err) {
      console.error('[VideoCallView] PiP failed:', err)
    }
  }, [])

  // ==================== FULL SCREEN ====================

  const toggleFullScreen = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
      setIsFullScreen(false)
    } else {
      container.requestFullscreen()
      setIsFullScreen(true)
    }
  }, [])

  // ==================== END CALL ====================

  const handleEndCall = useCallback(() => {
    // Notify server
    if (socketRef.current) {
      socketRef.current.emit('end-call', { roomId: callSessionId })
    }

    // Clean up peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // Clean up streams
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    remoteStreamRef.current?.getTracks().forEach((t) => t.stop())
    remoteStreamRef.current = null
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null

    // Disconnect socket
    socketRef.current?.disconnect()
    socketRef.current = null

    hasCreatedOffer.current = false
    remotePeerIdRef.current = null

    onCallEnd()
  }, [callSessionId, onCallEnd])

  // ==================== INITIALIZE ====================

  useEffect(() => {
    let mounted = true

    const init = async () => {
      // Get local media
      const stream = await getLocalStream()
      if (!stream || !mounted) return

      // Create peer connection
      createPeerConnection()

      // Init signaling
      initSignaling()
    }

    init()

    return () => {
      mounted = false
      // Full cleanup on unmount
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      remoteStreamRef.current?.getTracks().forEach((t) => t.stop())
      remoteStreamRef.current = null
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null

      if (socketRef.current) {
        socketRef.current.emit('leave-room', { roomId: callSessionId })
        socketRef.current.disconnect()
        socketRef.current = null
      }

      hasCreatedOffer.current = false
      remotePeerIdRef.current = null

      // Exit PiP if active
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ==================== STATUS CONFIG ====================

  const statusConfig = getConnectionStatusConfig(connectionStatus)

  // ==================== RENDER ====================

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-gray-950"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <span
              className={`relative flex h-2.5 w-2.5 ${statusConfig.animate ? '' : ''}`}
            >
              {statusConfig.animate && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusConfig.color}`}
              />
            </span>
            <Badge
              variant="secondary"
              className={`${statusConfig.textColor} bg-gray-800 border-gray-700 text-xs`}
            >
              {statusConfig.label}
            </Badge>
          </div>

          {/* Call Timer */}
          {remotePeerConnected && (
            <span className="font-mono text-sm text-gray-300">
              {formatCallTime(elapsed)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 hidden sm:block">
            {participantName}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={toggleFullScreen}
          >
            {isFullScreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative overflow-hidden bg-gray-900">
        {/* Remote Video (full area) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          onDoubleClick={togglePiP}
        />

        {/* Remote Video Placeholder */}
        {!remotePeerConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
            {connectionStatus === 'Connecting' || connectionStatus === 'Reconnecting' ? (
              <>
                <Loader2 className="h-12 w-12 text-gray-500 animate-spin mb-4" />
                <p className="text-gray-400 text-lg">
                  Waiting for {participantName} to join...
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  {connectionStatus === 'Reconnecting'
                    ? 'Attempting to reconnect'
                    : 'Make sure they have opened the call link'}
                </p>
              </>
            ) : (
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-800 mb-4">
                  <span className="text-3xl font-bold text-gray-500">
                    {participantName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-400 text-lg">{participantName}</p>
                <p className="text-gray-500 text-sm mt-1">Not connected</p>
              </>
            )}
          </div>
        )}

        {/* Local Video (picture-in-picture) */}
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-10">
          <div
            className={`relative overflow-hidden rounded-xl border-2 transition-all shadow-2xl ${
              remotePeerConnected
                ? 'border-gray-600/50 w-[140px] h-[105px] sm:w-[200px] sm:h-[150px] md:w-[240px] md:h-[180px]'
                : 'border-gray-700 w-[140px] h-[105px] sm:w-[200px] sm:h-[150px]'
            }`}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                isVideoMuted || !isVideoCall ? 'bg-gray-800' : ''
              }`}
            />
            {/* Video muted overlay */}
            {(isVideoMuted || !isVideoCall) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700">
                  <span className="text-lg font-bold text-gray-400">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
            {/* Name label */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
              <p className="text-[11px] text-white font-medium truncate">
                You{isAudioMuted ? ' (muted)' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Screen share indicator */}
        {isScreenSharing && (
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10">
            <Badge className="bg-purple-600 text-white text-xs gap-1.5">
              <MonitorUp className="h-3 w-3" />
              Sharing Screen
            </Badge>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 px-4 py-4 sm:py-6 bg-gray-900/80 backdrop-blur-sm border-t border-gray-800">
        {/* Mute Audio */}
        <Button
          size="lg"
          variant="outline"
          className={`rounded-full h-12 w-12 sm:h-14 sm:w-14 p-0 border-gray-600 transition-colors ${
            isAudioMuted
              ? 'bg-red-600 hover:bg-red-700 border-red-600 text-white'
              : 'hover:bg-gray-700 text-gray-200'
          }`}
          onClick={toggleAudio}
          title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isAudioMuted ? (
            <MicOff className="h-5 w-5 sm:h-6 sm:w-6" />
          ) : (
            <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
          )}
        </Button>

        {/* Mute Video / Toggle Camera */}
        {isVideoCall && (
          <Button
            size="lg"
            variant="outline"
            className={`rounded-full h-12 w-12 sm:h-14 sm:w-14 p-0 border-gray-600 transition-colors ${
              isVideoMuted
                ? 'bg-red-600 hover:bg-red-700 border-red-600 text-white'
                : 'hover:bg-gray-700 text-gray-200'
            }`}
            onClick={toggleVideo}
            title={isVideoMuted ? 'Turn On Camera' : 'Turn Off Camera'}
          >
            {isVideoMuted ? (
              <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" />
            ) : (
              <Video className="h-5 w-5 sm:h-6 sm:w-6" />
            )}
          </Button>
        )}

        {/* Screen Share */}
        {isVideoCall && (
          <Button
            size="lg"
            variant="outline"
            className={`rounded-full h-12 w-12 sm:h-14 sm:w-14 p-0 border-gray-600 transition-colors ${
              isScreenSharing
                ? 'bg-purple-600 hover:bg-purple-700 border-purple-600 text-white'
                : 'hover:bg-gray-700 text-gray-200'
            }`}
            onClick={toggleScreenShare}
            title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          >
            <MonitorUp className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        )}

        {/* PiP */}
        {remotePeerConnected && isVideoCall && typeof document !== 'undefined' && document.pictureInPictureEnabled && (
          <Button
            size="lg"
            variant="outline"
            className="rounded-full h-12 w-12 sm:h-14 sm:w-14 p-0 border-gray-600 hover:bg-gray-700 text-gray-200 hidden sm:flex"
            onClick={togglePiP}
            title="Picture in Picture"
          >
            <Maximize2 className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        )}

        {/* End Call */}
        <Button
          size="lg"
          className="rounded-full h-12 w-12 sm:h-14 sm:w-14 p-0 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30"
          onClick={handleEndCall}
          title="End Call"
        >
          <PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      </div>
    </div>
  )
}

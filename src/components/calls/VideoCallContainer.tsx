'use client'

import React, { useState, useCallback } from 'react'
import {
  Video,
  Phone,
  PhoneCall,
  PhoneOff,
  Stethoscope,
  Clock,
  Calendar,
  Loader2,
  ShieldCheck,
  MonitorUp,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiPost, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VideoCallView } from './VideoCallView'

// ==================== TYPES ====================

export interface ActiveCallData {
  id: string
  sessionId: string
  patientId: string
  patientName: string
  patientPhone?: string
  doctorId: string
  doctorName: string
  doctorSpecialization?: string
  callType: 'Video' | 'Audio' | 'Chat'
  startedAt: string
  visitId?: string
  appointmentId?: string
}

interface VideoCallContainerProps {
  call: ActiveCallData
  onClose: () => void
  onCallEnded?: () => void
  userName?: string
}

// ==================== MAIN COMPONENT ====================

export function VideoCallContainer({
  call,
  onClose,
  onCallEnded,
  userName = 'User',
}: VideoCallContainerProps) {
  const [showPreCall, setShowPreCall] = useState(true)
  const [joining, setJoining] = useState(false)
  const { toast } = useToast()

  // ==================== JOIN CALL ====================

  const handleJoinVideo = useCallback(async () => {
    setJoining(true)
    try {
      // Notify the server that the call has been joined
      await apiPost(`/calls/${call.id}/start`, {})
      setShowPreCall(false)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: 'Failed to Join Call',
          description: error.message,
          variant: 'destructive',
        })
      }
      setJoining(false)
    }
  }, [call.id, toast])

  const handleJoinAudio = useCallback(async () => {
    setJoining(true)
    try {
      await apiPost(`/calls/${call.id}/start`, {})
      // Force audio mode — we can pass a prop to VideoCallView
      setShowPreCall(false)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: 'Failed to Join Call',
          description: error.message,
          variant: 'destructive',
        })
      }
      setJoining(false)
    }
  }, [call.id, toast])

  // ==================== END CALL ====================

  const handleCallEnd = useCallback(() => {
    // Notify parent to refresh
    onCallEnded?.()
    onClose()
  }, [onCallEnded, onClose])

  // ==================== CLOSE ====================

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Determine the other participant's name
  const otherParticipantName =
    call.doctorName === userName
      ? call.patientName
      : call.doctorName

  // ==================== PRE-CALL SCREEN ====================

  const preCallScreen = (
    <Dialog open={showPreCall} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <PhoneCall className="h-5 w-5 text-emerald-500" />
            Join Telemedicine Call
          </DialogTitle>
          <DialogDescription>
            Join the video consultation with your patient/doctor
          </DialogDescription>
        </DialogHeader>

        {/* Call Info */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          {/* Patient & Doctor */}
          <div className="flex items-center gap-4">
            {/* Patient */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  {call.patientName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Patient</p>
                <p className="text-sm font-semibold truncate">{call.patientName}</p>
                {call.patientPhone && (
                  <p className="text-xs text-muted-foreground">{call.patientPhone}</p>
                )}
              </div>
            </div>

            <span className="text-muted-foreground text-lg">→</span>

            {/* Doctor */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
                <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
                  {call.doctorName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Doctor</p>
                <p className="text-sm font-semibold truncate">{call.doctorName}</p>
                {call.doctorSpecialization && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" />
                    {call.doctorSpecialization}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Session Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-xs gap-1">
                <Calendar className="h-3 w-3" />
                Session
              </Badge>
              <span className="font-mono text-xs">{call.sessionId}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge
                variant="outline"
                className={`text-xs gap-1 ${
                  call.callType === 'Video'
                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300'
                    : call.callType === 'Audio'
                    ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300'
                    : 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300'
                }`}
              >
                {call.callType === 'Video' ? (
                  <Video className="h-3 w-3" />
                ) : (
                  <Phone className="h-3 w-3" />
                )}
                {call.callType}
              </Badge>
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                End-to-End Encrypted
              </p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                This call uses WebRTC peer-to-peer encryption. Video and audio data is encrypted during transit.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="flex-1 sm:flex-none sm:px-8 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleJoinVideo}
            disabled={joining}
          >
            {joining ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Video className="mr-2 h-4 w-4" />
            )}
            Start Video Call
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1 sm:flex-none sm:px-8"
            onClick={handleJoinAudio}
            disabled={joining}
          >
            {joining ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Phone className="mr-2 h-4 w-4" />
            )}
            Start Audio Call
          </Button>
        </div>

        {/* Cancel */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleClose}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  // ==================== RENDER ====================

  return (
    <>
      {/* Pre-call dialog */}
      {showPreCall && preCallScreen}

      {/* Active video call (full-screen overlay) */}
      {!showPreCall && (
        <VideoCallView
          callSessionId={call.sessionId}
          participantName={otherParticipantName}
          onCallEnd={handleCallEnd}
          isInitiator={false}
          callType={call.callType === 'Chat' ? 'Audio' : call.callType}
          userName={userName}
        />
      )}
    </>
  )
}

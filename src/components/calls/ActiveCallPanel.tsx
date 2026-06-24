'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Video,
  Phone,
  PhoneOff,
  MessageSquare,
  Clock,
  User,
  Stethoscope,
  Star,
  Loader2,
  FileText,
  Brain,
  Eye,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiPost, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

// ==================== TYPES ====================

interface ActiveCallPanelProps {
  call: {
    id: string
    sessionId: string
    patientId: string
    patientName: string
    patientPhone?: string
    doctorId: string
    doctorName: string
    doctorSpecialization?: string
    callType: string
    startedAt: string
    visitId?: string
  }
  onEndCall: (callId: string) => void
  onViewDetail?: (callId: string) => void
  onJoinCall?: () => void
}

// ==================== HELPERS ====================

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '00:00'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function getCallTypeIcon(type: string) {
  switch (type) {
    case 'Video': return Video
    case 'Audio': return Phone
    case 'Chat': return MessageSquare
    default: return Phone
  }
}

function getCallTypeColor(type: string) {
  switch (type) {
    case 'Video': return 'text-purple-600'
    case 'Audio': return 'text-sky-600'
    case 'Chat': return 'text-teal-600'
    default: return 'text-emerald-600'
  }
}

// ==================== DURATION TIMER HOOK ====================

function useDurationTimer(startedAt: string) {
  const startMs = new Date(startedAt).getTime()
  const calcElapsed = useCallback(() => Math.max(0, Math.floor((Date.now() - startMs) / 1000)), [startMs])
  const [elapsed, setElapsed] = useState(() => calcElapsed())

  useEffect(() => {
    const interval = setInterval(() => setElapsed(calcElapsed()), 1000)
    return () => clearInterval(interval)
  }, [calcElapsed])

  return elapsed
}

// ==================== STAR RATING ====================

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const starVal = i + 1
        const filled = starVal <= (hovered || value)
        return (
          <button
            key={i}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(starVal)}
            onMouseEnter={() => !readonly && setHovered(starVal)}
            onMouseLeave={() => !readonly && setHovered(0)}
            className={`transition-transform ${!readonly ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-muted text-muted-foreground/30'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}

// ==================== END CALL DIALOG ====================

function EndCallDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { diagnosis: string; followUpNotes: string; rating: number }) => void
  submitting: boolean
}) {
  const [diagnosis, setDiagnosis] = useState('')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [rating, setRating] = useState(4)

  function handleConfirm() {
    onSubmit({ diagnosis, followUpNotes, rating })
    // Reset form
    setDiagnosis('')
    setFollowUpNotes('')
    setRating(4)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneOff className="h-5 w-5 text-red-500" />
            End Call
          </DialogTitle>
          <DialogDescription>
            Please provide call summary details before ending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Diagnosis */}
          <div className="space-y-2">
            <Label htmlFor="diagnosis" className="text-sm font-medium">
              Diagnosis <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="diagnosis"
              placeholder="Enter diagnosis or findings..."
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Follow-up Notes */}
          <div className="space-y-2">
            <Label htmlFor="followUpNotes" className="text-sm font-medium">
              Follow-up Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="followUpNotes"
              placeholder="Add follow-up instructions or notes..."
              value={followUpNotes}
              onChange={(e) => setFollowUpNotes(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Call Quality Rating</Label>
            <div className="flex items-center gap-3">
              <StarRating value={rating} onChange={setRating} />
              <span className="text-sm text-muted-foreground">
                {rating}/5
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PhoneOff className="mr-2 h-4 w-4" />
            )}
            End Call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== MAIN COMPONENT ====================

export function ActiveCallPanel({ call, onEndCall, onViewDetail, onJoinCall }: ActiveCallPanelProps) {
  const { toast } = useToast()
  const elapsed = useDurationTimer(call.startedAt)
  const [endDialogOpen, setEndDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const CallIcon = getCallTypeIcon(call.callType)
  const callColor = getCallTypeColor(call.callType)

  const handleEndSubmit = async (data: { diagnosis: string; followUpNotes: string; rating: number }) => {
    setSubmitting(true)
    try {
      await apiPost(`/calls/${call.id}/end`, {
        diagnosis: data.diagnosis || undefined,
        followUpNotes: data.followUpNotes || undefined,
        rating: data.rating,
      })
      toast({ title: 'Call Ended', description: 'Call has been ended successfully.' })
      setEndDialogOpen(false)
      onEndCall(call.id)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickEnd = () => {
    setEndDialogOpen(true)
  }

  return (
    <>
      <Card className="overflow-hidden border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-0">
          {/* Gradient banner */}
          <div className="bg-gradient-to-r from-emerald-50 via-emerald-50/50 to-teal-50 dark:from-emerald-950/30 dark:via-emerald-950/20 dark:to-teal-950/30 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              {/* Left: Icon + Pulse */}
              <div className="flex items-center gap-3 sm:min-w-[80px]">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <CallIcon className={`h-6 w-6 ${callColor}`} />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
                  </span>
                </div>
              </div>

              {/* Center: Info */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 animate-pulse text-xs">
                    <Phone className="mr-1 h-3 w-3" /> In Progress
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {call.sessionId}
                  </Badge>
                </div>

                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
                  {/* Patient */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-[10px] font-bold">
                        {call.patientName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{call.patientName}</p>
                      {call.patientPhone && (
                        <p className="text-xs text-muted-foreground">{call.patientPhone}</p>
                      )}
                    </div>
                  </div>

                  <span className="hidden sm:block text-muted-foreground">→</span>

                  {/* Doctor */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-gradient-to-br from-purple-400 to-purple-600 text-white text-[10px] font-bold">
                        {call.doctorName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{call.doctorName}</p>
                      {call.doctorSpecialization && (
                        <p className="text-xs text-muted-foreground">{call.doctorSpecialization}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Duration */}
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {formatDuration(elapsed)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    elapsed
                  </span>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 sm:flex-col sm:gap-2 sm:min-w-[140px]">
                {onJoinCall && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onJoinCall}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Video className="mr-1.5 h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Join Video</span>
                    <span className="sm:hidden">Join</span>
                  </Button>
                )}
                {onViewDetail && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetail(call.id)}
                    className="w-full sm:w-auto"
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    <span className="hidden sm:inline">View</span>
                    <span className="sm:hidden">Details</span>
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleQuickEnd}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
                >
                  <PhoneOff className="mr-1.5 h-3.5 w-3.5" />
                  End Call
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* End Call Dialog */}
      <EndCallDialog
        open={endDialogOpen}
        onOpenChange={setEndDialogOpen}
        onSubmit={handleEndSubmit}
        submitting={submitting}
      />
    </>
  )
}

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Video,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  Star,
  User,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Activity,
  ExternalLink,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiGet, ApiError } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'

// ==================== TYPES ====================

interface CallDetailDialogProps {
  callId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface CallDetail {
  id: string
  sessionId: string
  appointmentId?: string
  patientId: string
  doctorId: string
  visitId?: string
  status: 'Scheduled' | 'In-Progress' | 'Completed' | 'Missed' | 'Cancelled'
  callType: 'Video' | 'Audio' | 'Chat'
  scheduledAt?: string
  startedAt?: string
  endedAt?: string
  duration: number
  notes?: string
  diagnosis?: string
  followUpNotes?: string
  rating?: number
  createdAt: string
  updatedAt?: string
  patient?: { name: string; phone: string }
  doctor?: { name: string; specialization: string }
  visit?: { id: string; visitId: string; status: string; stage?: string }
  analyses?: { id: string; type: string; createdAt: string }[]
}

// ==================== HELPERS ====================

function getStatusConfig(status: string) {
  switch (status) {
    case 'Scheduled':
      return {
        badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200',
        icon: Calendar,
        iconClass: 'text-amber-500',
      }
    case 'In-Progress':
      return {
        badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200',
        icon: Phone,
        iconClass: 'text-emerald-500',
      }
    case 'Completed':
      return {
        badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200',
        icon: CheckCircle2,
        iconClass: 'text-emerald-500',
      }
    case 'Missed':
      return {
        badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200',
        icon: AlertTriangle,
        iconClass: 'text-red-500',
      }
    case 'Cancelled':
      return {
        badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200',
        icon: XCircle,
        iconClass: 'text-gray-500',
      }
    default:
      return {
        badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
        icon: Clock,
        iconClass: 'text-gray-500',
      }
  }
}

function getCallTypeConfig(type: string) {
  switch (type) {
    case 'Video':
      return {
        badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200',
        icon: Video,
      }
    case 'Audio':
      return {
        badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200',
        icon: Phone,
      }
    case 'Chat':
      return {
        badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200',
        icon: MessageSquare,
      }
    default:
      return {
        badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
        icon: Phone,
      }
  }
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`
  }
  return `${mins}m ${secs}s`
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '--'
  try {
    return format(new Date(dateStr), 'MMM d, yyyy h:mm a')
  } catch {
    return '--'
  }
}

function StarRatingDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < value
        return (
          <Star
            key={i}
            className={`h-4 w-4 ${
              filled
                ? 'fill-amber-400 text-amber-400'
                : 'fill-muted text-muted-foreground/30'
            }`}
          />
        )
      })}
      <span className="ml-1 text-sm font-medium text-muted-foreground">{value}/5</span>
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

export function CallDetailDialog({ callId, open, onOpenChange }: CallDetailDialogProps) {
  const { toast } = useToast()
  const [detail, setDetail] = useState<CallDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<CallDetail | { data: CallDetail }>(`/calls/${callId}`)
      const call = (res as CallDetail).id ? (res as CallDetail) : (res as { data: CallDetail }).data
      setDetail(call)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [callId, toast])

   
  useEffect(() => {
    if (open && callId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchDetail()
    }
  }, [open, callId, fetchDetail])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-emerald-600" />
            Call Details
          </DialogTitle>
          <DialogDescription>
            View complete information about this telemedicine call session
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="space-y-4 pb-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : detail ? (
            <div className="space-y-4 pb-4">
              {/* Session Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold text-muted-foreground">
                    {detail.sessionId}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Created {formatDateTime(detail.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={detail.status} />
                  <CallTypeBadge type={detail.callType} />
                </div>
              </div>

              <Separator />

              {/* Session Info Grid */}
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Session Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <InfoItem label="Call Type" value={detail.callType} />
                    <InfoItem label="Status" value={detail.status} />
                    <InfoItem label="Scheduled" value={formatDateTime(detail.scheduledAt)} />
                    <InfoItem label="Started" value={formatDateTime(detail.startedAt)} />
                    <InfoItem label="Ended" value={formatDateTime(detail.endedAt)} />
                    <InfoItem
                      label="Duration"
                      value={detail.duration > 0 ? formatDuration(detail.duration) : '--'}
                    />
                    {detail.appointmentId && (
                      <InfoItem label="Appointment" value={detail.appointmentId} />
                    )}
                    {detail.visitId && (
                      <InfoItem label="Visit" value={detail.visitId} />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Patient & Doctor Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Patient */}
                <Card>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-emerald-600" />
                      Patient
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-sm font-bold">
                          {(detail.patient?.name || 'P').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {detail.patient?.name || `Patient ${detail.patientId.slice(0, 6)}`}
                        </p>
                        {detail.patient?.phone && (
                          <p className="text-xs text-muted-foreground">{detail.patient.phone}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Doctor */}
                <Card>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-purple-600" />
                      Doctor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-br from-purple-400 to-purple-600 text-white text-sm font-bold">
                          {(detail.doctor?.name || 'D').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {detail.doctor?.name || `Doctor ${detail.doctorId.slice(0, 6)}`}
                        </p>
                        {detail.doctor?.specialization && (
                          <p className="text-xs text-muted-foreground">{detail.doctor.specialization}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Notes & Clinical Info */}
              {(detail.notes || detail.diagnosis || detail.followUpNotes || detail.rating) && (
                <Card>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Clinical Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {detail.notes && (
                      <DetailSection label="Notes" content={detail.notes} />
                    )}
                    {detail.diagnosis && (
                      <DetailSection label="Diagnosis" content={detail.diagnosis} />
                    )}
                    {detail.followUpNotes && (
                      <DetailSection label="Follow-up Notes" content={detail.followUpNotes} />
                    )}
                    {detail.rating !== undefined && detail.rating !== null && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Rating</p>
                        <StarRatingDisplay value={detail.rating} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Linked Visit */}
              {detail.visit && (
                <Card>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-emerald-600" />
                      Linked Visit
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoItem label="Visit ID" value={detail.visit.visitId} />
                      <InfoItem label="Status" value={detail.visit.status} />
                      {detail.visit.stage && (
                        <InfoItem label="Stage" value={detail.visit.stage} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Linked Analyses */}
              {detail.analyses && detail.analyses.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-600" />
                      Linked Analyses ({detail.analyses.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {detail.analyses.map((analysis) => (
                        <div
                          key={analysis.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-purple-500" />
                            <div>
                              <p className="text-sm font-medium">{analysis.type}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(analysis.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="py-12 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">Failed to load call details</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ==================== SUB COMPONENTS ====================

function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status)
  const Icon = config.icon
  return (
    <Badge
      variant="outline"
      className={`${config.badgeClass} gap-1 ${status === 'In-Progress' ? 'animate-pulse' : ''}`}
    >
      <Icon className={`h-3 w-3 ${config.iconClass}`} />
      {status}
    </Badge>
  )
}

function CallTypeBadge({ type }: { type: string }) {
  const config = getCallTypeConfig(type)
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`${config.badgeClass} gap-1`}>
      <Icon className="h-3 w-3" />
      {type}
    </Badge>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function DetailSection({ label, content }: { label: string; content: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg bg-muted/50 p-3">
        {content}
      </p>
    </div>
  )
}

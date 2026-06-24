'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Video,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  Stethoscope,
  User,
  Search,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, ApiError, type PaginatedResponse } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

// ==================== TYPES ====================

interface DoctorOption {
  id: string
  name: string
  specialization: string
}

interface PatientOption {
  id: string
  name: string
  phone: string
  patientId: string
}

interface ScheduleCallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillPatientId?: string
  prefillDoctorId?: string
  prefillAppointmentId?: string
  onSuccess?: () => void
}

// ==================== HELPERS ====================

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
]

const CALL_TYPE_OPTIONS = [
  {
    value: 'Video' as const,
    label: 'Video Call',
    icon: Video,
    description: 'Face-to-face video consultation',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200',
    selectedColor: 'border-purple-500 bg-purple-50 dark:bg-purple-950/30',
  },
  {
    value: 'Audio' as const,
    label: 'Audio Call',
    icon: Phone,
    description: 'Voice-only consultation',
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200',
    selectedColor: 'border-sky-500 bg-sky-50 dark:bg-sky-950/30',
  },
  {
    value: 'Chat' as const,
    label: 'Chat',
    icon: MessageSquare,
    description: 'Text-based consultation',
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200',
    selectedColor: 'border-teal-500 bg-teal-50 dark:bg-teal-950/30',
  },
]

function getDefaultScheduledAt(): string {
  const now = new Date()
  now.setHours(now.getHours() + 1)
  now.setMinutes(0, 0, 0)
  return now.toISOString().slice(0, 16)
}

// ==================== MAIN COMPONENT ====================

export function ScheduleCallDialog({
  open,
  onOpenChange,
  prefillPatientId,
  prefillDoctorId,
  prefillAppointmentId,
  onSuccess,
}: ScheduleCallDialogProps) {
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    callType: 'Video' as 'Video' | 'Audio' | 'Chat',
    scheduledAt: getDefaultScheduledAt(),
    durationEstimate: 30,
    notes: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [patients, setPatients] = useState<PatientOption[]>([])
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [patientSearch, setPatientSearch] = useState('')
  const [doctorSearch, setDoctorSearch] = useState('')

  const fetchPatients = useCallback(async () => {
    setLoadingPatients(true)
    try {
      const res = await apiGet<PaginatedResponse<PatientOption>>('/patients', { limit: 100 })
      setPatients(res.data)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setLoadingPatients(false)
    }
  }, [toast])

  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true)
    try {
      const res = await apiGet<PaginatedResponse<DoctorOption>>('/doctors', { limit: 100 })
      setDoctors(res.data)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setLoadingDoctors(false)
    }
  }, [toast])

  useEffect(() => {
    if (open) {
      fetchPatients()
      fetchDoctors()
      setFormData({
        patientId: prefillPatientId || '',
        doctorId: prefillDoctorId || '',
        callType: 'Video',
        scheduledAt: getDefaultScheduledAt(),
        durationEstimate: 30,
        notes: '',
      })
      setFormErrors({})
      setPatientSearch('')
      setDoctorSearch('')
    }
  }, [open, prefillPatientId, prefillDoctorId, fetchPatients, fetchDoctors])

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients
    const q = patientSearch.toLowerCase()
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.patientId.toLowerCase().includes(q)
    )
  }, [patientSearch, patients])

  const filteredDoctors = useMemo(() => {
    if (!doctorSearch.trim()) return doctors
    const q = doctorSearch.toLowerCase()
    return doctors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q)
    )
  }, [doctorSearch, doctors])

  function validate(): boolean {
    const errors: Record<string, string> = {}

    if (!formData.patientId) {
      errors.patientId = 'Patient is required'
    }
    if (!formData.doctorId) {
      errors.doctorId = 'Doctor is required'
    }
    if (!formData.scheduledAt) {
      errors.scheduledAt = 'Scheduled time is required'
    } else if (new Date(formData.scheduledAt) <= new Date()) {
      errors.scheduledAt = 'Scheduled time must be in the future'
    }
    if (formData.patientId && formData.doctorId && formData.patientId === formData.doctorId) {
      errors.doctorId = 'Doctor cannot be the same as patient'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        patientId: formData.patientId,
        doctorId: formData.doctorId,
        callType: formData.callType,
        scheduledAt: new Date(formData.scheduledAt).toISOString(),
        notes: formData.notes || undefined,
      }
      if (prefillAppointmentId) {
        payload.appointmentId = prefillAppointmentId
      }

      await apiPost('/calls', payload)
      toast({
        title: 'Call Scheduled',
        description: `Telemedicine call has been scheduled successfully.`,
      })
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        toast({
          title: 'Error',
          description: 'Failed to schedule call',
          variant: 'destructive',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPatient = patients.find((p) => p.id === formData.patientId)
  const selectedDoctor = doctors.find((d) => d.id === formData.doctorId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-purple-600" />
            Schedule Telemedicine Call
          </DialogTitle>
          <DialogDescription>
            Set up a new video, audio, or chat consultation
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pb-2">
            {/* Patient Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Patient <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or ID..."
                  className="pl-9"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[160px] rounded-lg border">
                <div className="p-1.5 space-y-0.5">
                  {loadingPatients ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))
                  ) : filteredPatients.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No patients found
                    </div>
                  ) : (
                    filteredPatients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => setFormData((prev) => ({ ...prev, patientId: patient.id }))}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                          formData.patientId === patient.id
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-bold">
                          {patient.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {patient.patientId} · {patient.phone}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
              {formErrors.patientId && (
                <p className="text-xs text-destructive">{formErrors.patientId}</p>
              )}
            </div>

            {/* Doctor Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" />
                Doctor <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or specialization..."
                  className="pl-9"
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[160px] rounded-lg border">
                <div className="p-1.5 space-y-0.5">
                  {loadingDoctors ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))
                  ) : filteredDoctors.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No doctors found
                    </div>
                  ) : (
                    filteredDoctors.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setFormData((prev) => ({ ...prev, doctorId: doc.id }))}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                          formData.doctorId === doc.id
                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white text-xs font-bold">
                          {doc.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.specialization}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
              {formErrors.doctorId && (
                <p className="text-xs text-destructive">{formErrors.doctorId}</p>
              )}
            </div>

            {/* Call Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Call Type</Label>
              <RadioGroup
                value={formData.callType}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    callType: v as 'Video' | 'Audio' | 'Chat',
                  }))
                }
                className="grid grid-cols-3 gap-3"
              >
                {CALL_TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = formData.callType === opt.value
                  return (
                    <label
                      key={opt.value}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-sm ${
                        isSelected ? opt.selectedColor : 'border-transparent bg-card hover:border-border'
                      }`}
                    >
                      <RadioGroupItem value={opt.value} className="sr-only" />
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${opt.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-medium text-center">{opt.label}</span>
                    </label>
                  )
                })}
              </RadioGroup>
            </div>

            {/* Scheduled Date & Time */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Scheduled Date & Time <span className="text-red-500">*</span>
              </Label>
              <Input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                min={getDefaultScheduledAt()}
                className="max-w-xs"
              />
              {formErrors.scheduledAt && (
                <p className="text-xs text-destructive">{formErrors.scheduledAt}</p>
              )}
            </div>

            {/* Duration Estimate */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Estimated Duration
              </Label>
              <Select
                value={String(formData.durationEstimate)}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, durationEstimate: Number(v) }))
                }
              >
                <SelectTrigger className="max-w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="Add any notes about this consultation..."
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="resize-none"
                rows={3}
              />
            </div>

            {/* Summary */}
            {selectedPatient && selectedDoctor && (
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    Summary
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Patient</p>
                      <p className="font-medium">{selectedPatient.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Doctor</p>
                      <p className="font-medium">{selectedDoctor.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Type</p>
                      <Badge variant="outline" className={CALL_TYPE_OPTIONS.find((o) => o.value === formData.callType)?.color}>
                        {formData.callType}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-medium">
                        {DURATION_OPTIONS.find((d) => d.value === formData.durationEstimate)?.label}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="mr-2 h-4 w-4" />
            )}
            Schedule Call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

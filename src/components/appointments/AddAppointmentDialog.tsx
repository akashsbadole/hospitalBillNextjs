'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { format, isBefore, isToday, startOfDay } from 'date-fns'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  User,
  Stethoscope,
  AlertCircle,
  Timer,
  Search,
  Phone,
  UserPlus,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, ApiError, type PaginatedResponse, type SingleResponse } from '@/lib/api-client'
import { DURATION_OPTIONS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Calendar } from '@/components/ui/calendar'
import { ScrollArea } from '@/components/ui/scroll-area'

// ==================== TYPES ====================

interface Doctor {
  id: string
  doctorId: string
  name: string
  specialization: string
  consultationFee: number
  status: string
}

interface Patient {
  id: string
  patientId: string
  name: string
  phone: string
  gender?: string | null
  bloodGroup?: string | null
}

interface AppointmentResponse {
  id: string
  appointmentId: string
}

interface AddAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// ==================== HELPERS ====================

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30',
]

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

const STEPS = ['Doctor', 'Date & Time', 'Patient', 'Confirm']

const TYPE_OPTIONS = [
  { value: 'Consultation' as const, label: 'Consultation', icon: Stethoscope, color: 'bg-slate-100 text-slate-700' },
  { value: 'Follow-up' as const, label: 'Follow-up', icon: Timer, color: 'bg-amber-100 text-amber-700' },
  { value: 'Emergency' as const, label: 'Emergency', icon: AlertCircle, color: 'bg-red-100 text-red-700' },
]

// ==================== STEP COMPONENTS ====================

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex items-center gap-1.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                i < currentStep
                  ? 'bg-emerald-600 text-white'
                  : i === currentStep
                  ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < currentStep ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${i <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
              {step}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`mx-1 h-px w-6 ${i < currentStep ? 'bg-emerald-500' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

function SelectDoctorStep({
  doctors,
  loading,
  selectedDoctorId,
  onSelect,
}: {
  doctors: Doctor[]
  loading: boolean
  selectedDoctorId: string
  onSelect: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">Choose a doctor for the appointment</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {doctors.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onSelect(doc.id)}
            className={`relative rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
              selectedDoctorId === doc.id
                ? 'border-emerald-500 bg-emerald-50/50 shadow-md'
                : 'border-transparent bg-card hover:border-border'
            }`}
          >
            {selectedDoctorId === doc.id && (
              <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white text-lg font-bold shadow-sm">
                {doc.name.charAt(doc.name.indexOf(' ') + 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{doc.specialization}</p>
                <div className="mt-2">
                  <Badge variant="secondary" className="text-[11px]">{doc.specialization}</Badge>
                </div>
                <p className="mt-1 text-sm font-semibold text-emerald-600">{formatCurrency(doc.consultationFee)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function SelectDateTimeStep({
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: {
  selectedDate: Date | undefined
  selectedTime: string
  onSelectDate: (date: Date) => void
  onSelectTime: (time: string) => void
}) {
  const availableSlots = useMemo(() => {
    if (!selectedDate) return TIME_SLOTS
    const today = startOfDay(new Date())
    const isDatePast = isBefore(selectedDate, today) && !isToday(selectedDate)
    if (isDatePast) return []
    return TIME_SLOTS
  }, [selectedDate])

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && onSelectDate(date)}
          disabled={(date) => isBefore(date, startOfDay(new Date()))}
          className="rounded-lg border"
          defaultMonth={selectedDate || new Date()}
        />
      </div>
      {selectedDate && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Available Time Slots</Label>
          {availableSlots.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No available slots for this date</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => onSelectTime(slot)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all hover:shadow-sm ${
                    selectedTime === slot
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                      : 'border-border bg-card hover:border-emerald-300 hover:bg-emerald-50/50'
                  }`}
                >
                  {formatTime(slot)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PatientDetailsStep({
  patients,
  loadingPatients,
  formData,
  formErrors,
  onExistingSelect,
  onFieldChange,
}: {
  patients: Patient[]
  loadingPatients: boolean
  formData: {
    patientId: string
    patientName: string
    patientPhone: string
    type: string
    duration: number
    notes: string
  }
  formErrors: Record<string, string>
  onExistingSelect: (patientId: string) => void
  onFieldChange: (field: string, value: string | number) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isNewPatient, setIsNewPatient] = useState(false)

  const filteredPatients = useMemo(() => {
    if (!searchQuery) return patients
    const q = searchQuery.toLowerCase()
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.patientId.toLowerCase().includes(q)
    )
  }, [searchQuery, patients])

  return (
    <div className="space-y-4">
      {/* Toggle: Existing vs New */}
      <div className="flex rounded-lg border bg-muted p-1">
        <button
          onClick={() => setIsNewPatient(false)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            !isNewPatient ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="h-4 w-4" />
          Existing Patient
        </button>
        <button
          onClick={() => setIsNewPatient(true)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isNewPatient ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserPlus className="h-4 w-4" />
          New Patient
        </button>
      </div>

      {!isNewPatient ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or ID..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <ScrollArea className="h-[200px] rounded-lg border">
            <div className="p-2 space-y-1">
              {loadingPatients ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))
              ) : filteredPatients.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No patients found</div>
              ) : (
                filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => onExistingSelect(patient.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      formData.patientId === patient.id
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-bold">
                      {patient.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{patient.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{patient.patientId}</span>
                        <span>·</span>
                        <span>{patient.phone}</span>
                      </div>
                    </div>
                    {formData.patientId === patient.id && <Check className="h-4 w-4 text-emerald-600" />}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
          {formErrors.patientId && <p className="text-xs text-destructive">{formErrors.patientId}</p>}
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="newPatientName">Patient Name *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="newPatientName"
                placeholder="Enter patient name"
                className="pl-9"
                value={formData.patientName}
                onChange={(e) => onFieldChange('patientName', e.target.value)}
              />
            </div>
            {formErrors.patientName && <p className="text-xs text-destructive">{formErrors.patientName}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPatientPhone">Phone Number *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="newPatientPhone"
                placeholder="Enter phone number"
                className="pl-9"
                value={formData.patientPhone}
                onChange={(e) => onFieldChange('patientPhone', e.target.value)}
              />
            </div>
            {formErrors.patientPhone && <p className="text-xs text-destructive">{formErrors.patientPhone}</p>}
          </div>
        </div>
      )}

      {/* Appointment Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Appointment Type</Label>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                onClick={() => onFieldChange('type', opt.value)}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                  formData.type === opt.value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                    : `border-border bg-card hover:border-emerald-300 ${opt.color}`
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Duration</Label>
        <div className="flex gap-2">
          {DURATION_OPTIONS.map((dur) => (
            <button
              key={dur}
              onClick={() => onFieldChange('duration', dur)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                formData.duration === dur
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                  : 'border-border bg-card hover:border-emerald-300 hover:bg-emerald-50/50'
              }`}
            >
              {dur} min
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Notes <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          placeholder="Any additional notes for the appointment..."
          value={formData.notes}
          onChange={(e) => onFieldChange('notes', e.target.value)}
          className="resize-none"
          rows={3}
        />
      </div>
    </div>
  )
}

function ConfirmationStep({
  formData,
  doctors,
  patients,
}: {
  formData: {
    doctorId: string
    date: Date
    time: string
    patientId: string
    patientName: string
    patientPhone: string
    type: string
    duration: number
    notes: string
  }
  doctors: Doctor[]
  patients: Patient[]
}) {
  const doctor = doctors.find((d) => d.id === formData.doctorId)
  const patient = patients.find((p) => p.id === formData.patientId)

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <Sparkles className="h-7 w-7 text-emerald-600" />
        </div>
        <p className="text-sm text-muted-foreground">Review your appointment details</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white text-sm font-bold">
              {doctor?.name.charAt(doctor.name.indexOf(' ') + 1) || '?'}
            </div>
            <div>
              <p className="text-sm font-semibold">{doctor?.name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">{doctor?.specialization}</p>
            </div>
            <p className="ml-auto text-sm font-semibold text-emerald-600">
              {formatCurrency(doctor?.consultationFee || 0)}
            </p>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Date</p>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-medium">{formData.date ? format(formData.date, 'EEE, MMM d, yyyy') : 'Not selected'}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Time</p>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-medium">{formData.time ? formatTime(formData.time) : 'Not selected'}</p>
              </div>
            </div>
          </div>
          <Separator />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Patient</p>
            <div className="flex items-center gap-2">
              {patient ? (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-bold">
                    {patient.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{patient.name}</p>
                    <p className="text-xs text-muted-foreground">{patient.phone}</p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-sm font-medium">{formData.patientName}</p>
                  <p className="text-xs text-muted-foreground">{formData.patientPhone}</p>
                  <Badge variant="secondary" className="mt-1 text-[10px]">New Patient</Badge>
                </div>
              )}
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Type</p>
              <Badge variant="outline" className={`gap-1 ${formData.type === 'Consultation' ? 'bg-slate-100 text-slate-700' : formData.type === 'Follow-up' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {formData.type === 'Consultation' && <Stethoscope className="h-3 w-3" />}
                {formData.type === 'Follow-up' && <Timer className="h-3 w-3" />}
                {formData.type === 'Emergency' && <AlertCircle className="h-3 w-3" />}
                {formData.type}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                {formData.duration} min
              </p>
            </div>
          </div>
          {formData.notes && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm">{formData.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== MAIN DIALOG ====================

const DEFAULT_FORM = {
  doctorId: '',
  date: new Date(),
  time: '',
  patientId: '',
  patientName: '',
  patientPhone: '',
  type: 'Consultation' as string,
  duration: 30,
  notes: '',
}

export function AddAppointmentDialog({ open, onOpenChange, onSuccess }: AddAppointmentDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState(DEFAULT_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true)
    try {
      const res = await apiGet<PaginatedResponse<Doctor>>('/doctors', { limit: 100 })
      setDoctors(res.data)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setLoadingDoctors(false)
    }
  }, [toast])

  const fetchPatients = useCallback(async () => {
    setLoadingPatients(true)
    try {
      const res = await apiGet<PaginatedResponse<Patient>>('/patients', { limit: 100 })
      setPatients(res.data)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setLoadingPatients(false)
    }
  }, [toast])

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchDoctors()
       
      fetchPatients()
       
      setStep(0)
       
      setFormData(DEFAULT_FORM)
       
      setFormErrors({})
    }
  }, [open, fetchDoctors, fetchPatients])

  const canProceed = useMemo(() => {
    switch (step) {
      case 0: return !!formData.doctorId
      case 1: return !!formData.date && !!formData.time
      case 2: return !!formData.patientId || (formData.patientName && formData.patientPhone)
      case 3: return true
      default: return false
    }
  }, [step, formData])

  function handleNext() {
    if (!canProceed) return
    setFormErrors({})

    if (step === 2) {
      if (!formData.patientId) {
        if (!formData.patientName.trim()) {
          setFormErrors({ patientName: 'Patient name is required' })
          return
        }
        if (!formData.patientPhone.trim() || formData.patientPhone.length < 10) {
          setFormErrors({ patientPhone: 'Valid phone number is required' })
          return
        }
      }
    }

    if (step < 3) setStep((s) => s + 1)
  }

  function handleBack() {
    if (step > 0) {
      setStep((s) => s - 1)
      setFormErrors({})
    }
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const dateStr = formData.date ? format(formData.date, 'yyyy-MM-dd') : ''
      const payload: Record<string, unknown> = {
        doctorId: formData.doctorId,
        date: dateStr,
        time: formData.time,
        duration: formData.duration,
        type: formData.type,
        notes: formData.notes || undefined,
      }

      // If patientId exists, use it; otherwise create patient first
      if (formData.patientId) {
        payload.patientId = formData.patientId
      } else {
        // Create a new patient then use that ID
        try {
          const newPatient = await apiPost<SingleResponse<Patient>>('/patients', {
            name: formData.patientName,
            phone: formData.patientPhone,
          })
          payload.patientId = newPatient.data.id
        } catch {
          toast({ title: 'Error', description: 'Failed to create patient', variant: 'destructive' })
          setSubmitting(false)
          return
        }
      }

      await apiPost<SingleResponse<AppointmentResponse>>('/appointments', payload)
      toast({ title: 'Appointment Booked', description: 'Appointment has been successfully created.' })
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Error', description: 'Failed to create appointment', variant: 'destructive' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  function resetAndClose() {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-[580px] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-600" />
            New Appointment
          </DialogTitle>
          <DialogDescription>Book a new appointment in 4 simple steps</DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={step} />

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="pb-2">
            {step === 0 && (
              <SelectDoctorStep
                doctors={doctors}
                loading={loadingDoctors}
                selectedDoctorId={formData.doctorId}
                onSelect={(id) => setFormData((prev) => ({ ...prev, doctorId: id }))}
              />
            )}
            {step === 1 && (
              <SelectDateTimeStep
                selectedDate={formData.date}
                selectedTime={formData.time}
                onSelectDate={(date) => setFormData((prev) => ({ ...prev, date }))}
                onSelectTime={(time) => setFormData((prev) => ({ ...prev, time }))}
              />
            )}
            {step === 2 && (
              <PatientDetailsStep
                patients={patients}
                loadingPatients={loadingPatients}
                formData={formData}
                formErrors={formErrors}
                onExistingSelect={(id) => setFormData((prev) => ({ ...prev, patientId: id }))}
                onFieldChange={(field, value) => setFormData((prev) => ({ ...prev, [field]: value }))}
              />
            )}
            {step === 3 && (
              <ConfirmationStep
                formData={formData}
                doctors={doctors}
                patients={patients}
              />
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 pb-6 pt-2 gap-2 sm:gap-0">
          {step > 0 && (
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step < 3 ? (
            <Button onClick={handleNext} disabled={!canProceed} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Confirm Appointment
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

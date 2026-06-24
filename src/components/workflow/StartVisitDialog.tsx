'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { apiGet, apiPost, type PaginatedResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Loader2, Thermometer, Heart, Wind, Scale, UserRound, Stethoscope, CalendarDays, BedDouble, Building2 } from 'lucide-react'

interface StartVisitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillPatientId?: string
  onSuccess?: () => void
}

interface PatientOption {
  id: string
  patientId: string
  name: string
  phone: string
}

interface DoctorOption {
  id: string
  doctorId: string
  name: string
  specialization: string
}

interface AppointmentOption {
  id: string
  aptId: string
  date: string
  time: string
  status: string
  doctor: { name: string } | null
}

interface WardOption {
  id: string
  name: string
  floor: number
}

interface BedOption {
  id: string
  bedId: string
  bedNumber: string
  bedType: string
  dailyRate: number
  wardId: string
  wardName: string
}

const DEPARTMENTS = [
  'General Medicine',
  'Cardiology',
  'Orthopedics',
  'Neurology',
  'Pediatrics',
  'Gynecology',
  'Dermatology',
  'ENT',
  'Ophthalmology',
  'Psychiatry',
  'Radiology',
  'Pathology',
  'Emergency',
  'Surgery',
  'ICU',
]

export function StartVisitDialog({
  open,
  onOpenChange,
  prefillPatientId,
  onSuccess,
}: StartVisitDialogProps) {
  const { toast } = useToast()

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [notes, setNotes] = useState('')

  // Visit type & department
  const [visitType, setVisitType] = useState('OPD')
  const [department, setDepartment] = useState('')

  // IPD Bed state
  const [selectedBedId, setSelectedBedId] = useState('')
  const [selectedWardId, setSelectedWardId] = useState('')
  const [wards, setWards] = useState<WardOption[]>([])
  const [availableBeds, setAvailableBeds] = useState<BedOption[]>([])
  const [isLoadingBeds, setIsLoadingBeds] = useState(false)
  const [isLoadingWards, setIsLoadingWards] = useState(false)

  // Vitals
  const [temperature, setTemperature] = useState('')
  const [bloodPressure, setBloodPressure] = useState('')
  const [pulse, setPulse] = useState('')
  const [oxygenLevel, setOxygenLevel] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')

  // Data loading
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [appointments, setAppointments] = useState<AppointmentOption[]>([])
  const [isLoadingPatients, setIsLoadingPatients] = useState(false)
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false)
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')

  // Reset form on open
  useEffect(() => {
    if (open) {
      setSelectedPatientId(prefillPatientId ?? '')
      setSelectedDoctorId('')
      setSelectedAppointmentId('')
      setChiefComplaint('')
      setNotes('')
      setTemperature('')
      setBloodPressure('')
      setPulse('')
      setOxygenLevel('')
      setWeight('')
      setHeight('')
      setPatientSearch('')
      // Reset new state
      setVisitType('OPD')
      setDepartment('')
      setSelectedBedId('')
      setSelectedWardId('')
      setWards([])
      setAvailableBeds([])
      setIsLoadingBeds(false)
      setIsLoadingWards(false)
      fetchPatients()
      fetchDoctors()
    }
  }, [open, prefillPatientId])

  // Fetch appointments when patient selected
  useEffect(() => {
    if (selectedPatientId && open) {
      fetchAppointments(selectedPatientId)
    } else {
      setAppointments([])
      setSelectedAppointmentId('')
    }
  }, [selectedPatientId, open])

  // Fetch wards when visitType changes to IPD
  useEffect(() => {
    if (visitType === 'IPD' && open) {
      fetchWards()
      // Also fetch all available beds
      fetchAvailableBeds()
    } else {
      setWards([])
      setAvailableBeds([])
      setSelectedWardId('')
      setSelectedBedId('')
    }
  }, [visitType, open])

  const fetchPatients = async () => {
    setIsLoadingPatients(true)
    try {
      const res = await apiGet<PaginatedResponse<PatientOption>>('/patients', { limit: 100 })
      setPatients(res.data)
    } catch {
      // silent fail
    } finally {
      setIsLoadingPatients(false)
    }
  }

  const fetchDoctors = async () => {
    setIsLoadingDoctors(true)
    try {
      const res = await apiGet<PaginatedResponse<DoctorOption>>('/doctors', { limit: 100 })
      setDoctors(res.data)
    } catch {
      // silent fail
    } finally {
      setIsLoadingDoctors(false)
    }
  }

  const fetchAppointments = async (patientId: string) => {
    setIsLoadingAppointments(true)
    try {
      const res = await apiGet<PaginatedResponse<AppointmentOption>>('/appointments', {
        patientId,
        limit: 50,
      })
      // Only show Scheduled or in-progress appointments
      setAppointments(res.data.filter(a => a.status === 'Scheduled'))
    } catch {
      setAppointments([])
    } finally {
      setIsLoadingAppointments(false)
    }
  }

  const fetchWards = async () => {
    setIsLoadingWards(true)
    try {
      const res = await apiGet<WardOption[]>('/beds/wards')
      setWards(res)
    } catch {
      setWards([])
    } finally {
      setIsLoadingWards(false)
    }
  }

  const fetchAvailableBeds = async () => {
    setIsLoadingBeds(true)
    try {
      const res = await apiGet<PaginatedResponse<BedOption>>('/beds', { status: 'Available' })
      setAvailableBeds(res.data)
    } catch {
      setAvailableBeds([])
    } finally {
      setIsLoadingBeds(false)
    }
  }

  const filteredBeds = selectedWardId
    ? availableBeds.filter(b => b.wardId === selectedWardId)
    : availableBeds

  const selectedBed = availableBeds.find(b => b.id === selectedBedId)

  const handleSubmit = async () => {
    if (!selectedPatientId || !chiefComplaint.trim()) return

    setIsSubmitting(true)
    try {
      const hasVitals = [temperature, bloodPressure, pulse, oxygenLevel, weight, height].some(v => v.trim() !== '')

      const body: Record<string, unknown> = {
        patientId: selectedPatientId,
        chiefComplaint: chiefComplaint.trim(),
        notes: notes.trim() || undefined,
        visitType,
        department: department || undefined,
      }

      if (selectedDoctorId) body.doctorId = selectedDoctorId
      if (selectedAppointmentId) body.appointmentId = selectedAppointmentId
      if (visitType === 'IPD' && selectedBedId) body.bedId = selectedBedId

      if (hasVitals) {
        body.vitals = {
          ...(temperature.trim() && { temperature: temperature.trim() }),
          ...(bloodPressure.trim() && { bloodPressure: bloodPressure.trim() }),
          ...(pulse.trim() && { pulse: pulse.trim() }),
          ...(oxygenLevel.trim() && { oxygenLevel: oxygenLevel.trim() }),
          ...(weight.trim() && { weight: weight.trim() }),
          ...(height.trim() && { height: height.trim() }),
        }
      }

      await apiPost('/patient-visits', body)

      toast({
        title: 'Visit Started',
        description: 'New patient visit has been created successfully.',
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({
          title: 'Failed to Create Visit',
          description: err.message || 'Something went wrong. Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.patientId.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.phone.includes(patientSearch)
  )

  const selectedPatient = patients.find(p => p.id === selectedPatientId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <Stethoscope className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            Start New Patient Visit
          </DialogTitle>
          <DialogDescription>
            Register a new visit and begin tracking the patient workflow.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-1">
          <div className="space-y-5 pb-2">
            {/* Patient Selector */}
            <div className="space-y-2">
              <Label htmlFor="patient-select">
                <span className="flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5" />
                  Patient <span className="text-red-500">*</span>
                </span>
              </Label>
              {isLoadingPatients ? (
                <Skeleton className="h-9 w-full rounded-md" />
              ) : (
                <>
                  <div className="relative">
                    <Input
                      placeholder="Search patients by name, ID, or phone..."
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                      className="mb-2"
                    />
                  </div>
                  <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                    <SelectTrigger id="patient-select" className="w-full">
                      <SelectValue placeholder="Select a patient..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {filteredPatients.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          No patients found
                        </div>
                      ) : (
                        filteredPatients.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{p.name}</span>
                              <span className="text-xs text-muted-foreground">({p.patientId})</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {/* Appointment Linker */}
            {selectedPatientId && appointments.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="appointment-select">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Link Appointment (optional)
                  </span>
                </Label>
                {isLoadingAppointments ? (
                  <Skeleton className="h-9 w-full rounded-md" />
                ) : (
                  <Select value={selectedAppointmentId} onValueChange={setSelectedAppointmentId}>
                    <SelectTrigger id="appointment-select" className="w-full">
                      <SelectValue placeholder="Select an appointment..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      <SelectItem value="none">
                        <span className="text-muted-foreground">No appointment</span>
                      </SelectItem>
                      {appointments.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{a.aptId}</span>
                            <span className="text-xs text-muted-foreground">{a.date} {a.time}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Doctor Selector */}
            <div className="space-y-2">
              <Label htmlFor="doctor-select">
                <span className="flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5" />
                  Doctor (optional)
                </span>
              </Label>
              {isLoadingDoctors ? (
                <Skeleton className="h-9 w-full rounded-md" />
              ) : (
                <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                  <SelectTrigger id="doctor-select" className="w-full">
                    <SelectValue placeholder="Assign a doctor..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    <SelectItem value="none">
                      <span className="text-muted-foreground">No doctor assigned</span>
                    </SelectItem>
                    {doctors.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{d.name}</span>
                          <span className="text-xs text-muted-foreground">{d.specialization}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* Visit Type Selector */}
            <div className="space-y-2">
              <Label htmlFor="visit-type">
                <span className="flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5" />
                  Visit Type <span className="text-red-500">*</span>
                </span>
              </Label>
              <Select value={visitType} onValueChange={(val) => {
                setVisitType(val)
                // Reset bed selection when switching away from IPD
                if (val !== 'IPD') {
                  setSelectedBedId('')
                  setSelectedWardId('')
                }
              }}>
                <SelectTrigger id="visit-type" className="w-full">
                  <SelectValue placeholder="Select visit type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPD">OPD</SelectItem>
                  <SelectItem value="IPD">IPD (In-Patient Department)</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Follow-up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department Selector */}
            <div className="space-y-2">
              <Label htmlFor="department-select">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Department (optional)
                </span>
              </Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="department-select" className="w-full">
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* IPD Bed Allocation */}
            {visitType === 'IPD' && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    IPD Bed Allocation
                  </h3>
                </div>

                {/* Ward Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ward</Label>
                  {isLoadingWards ? (
                    <Skeleton className="h-9 w-full rounded-md" />
                  ) : (
                    <Select
                      value={selectedWardId}
                      onValueChange={(val) => {
                        setSelectedWardId(val)
                        setSelectedBedId('')
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select ward..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {wards.length === 0 ? (
                          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                            No wards available
                          </div>
                        ) : (
                          wards.map(w => (
                            <SelectItem key={w.id} value={w.id}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{w.name}</span>
                                <span className="text-xs text-muted-foreground">Floor {w.floor}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Bed Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Bed</Label>
                  {isLoadingBeds ? (
                    <Skeleton className="h-9 w-full rounded-md" />
                  ) : (
                    <Select value={selectedBedId} onValueChange={setSelectedBedId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={selectedWardId ? 'Select a bed...' : 'Select a ward first...'} />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {filteredBeds.length === 0 ? (
                          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                            {selectedWardId ? 'No available beds in this ward' : 'No available beds'}
                          </div>
                        ) : (
                          filteredBeds.map(b => (
                            <SelectItem key={b.id} value={b.id}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{b.bedNumber}</span>
                                <span className="text-xs text-muted-foreground">{b.bedType}</span>
                                <span className="text-xs text-muted-foreground">— ₹{b.dailyRate}/day</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Selected Bed Info */}
                {selectedBed && (
                  <div className="rounded-md border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <BedDouble className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-emerald-800 dark:text-emerald-300 font-medium">
                        Bed {selectedBed.bedNumber} ({selectedBed.wardName}) — ₹{selectedBed.dailyRate}/day
                      </span>
                    </div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 ml-6">
                      Type: {selectedBed.bedType}
                    </p>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Chief Complaint */}
            <div className="space-y-2">
              <Label htmlFor="chief-complaint">
                Chief Complaint <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="chief-complaint"
                placeholder="Describe the patient's chief complaint..."
                value={chiefComplaint}
                onChange={e => setChiefComplaint(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <Separator />

            {/* Vitals Section */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Thermometer className="h-3.5 w-3.5 text-rose-500" />
                Vitals (optional — skip to start at Registration)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Thermometer className="h-3 w-3" /> Temperature
                  </Label>
                  <Input
                    placeholder="98.6°F"
                    value={temperature}
                    onChange={e => setTemperature(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Heart className="h-3 w-3" /> BP
                  </Label>
                  <Input
                    placeholder="120/80"
                    value={bloodPressure}
                    onChange={e => setBloodPressure(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Heart className="h-3 w-3" /> Pulse
                  </Label>
                  <Input
                    placeholder="72 bpm"
                    value={pulse}
                    onChange={e => setPulse(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Wind className="h-3 w-3" /> O₂ Level
                  </Label>
                  <Input
                    placeholder="98%"
                    value={oxygenLevel}
                    onChange={e => setOxygenLevel(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Scale className="h-3 w-3" /> Weight
                  </Label>
                  <Input
                    placeholder="70 kg"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Scale className="h-3 w-3" /> Height
                  </Label>
                  <Input
                    placeholder="170 cm"
                    value={height}
                    onChange={e => setHeight(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="visit-notes">Notes (optional)</Label>
              <Textarea
                id="visit-notes"
                placeholder="Additional notes for this visit..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedPatientId || !chiefComplaint.trim() || isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Visit...
              </>
            ) : (
              <>
                <Stethoscope className="h-4 w-4 mr-2" />
                Start Visit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
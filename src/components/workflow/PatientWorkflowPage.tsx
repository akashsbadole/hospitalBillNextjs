'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  apiGet,
  apiPost,
  type PaginatedResponse,
  type SingleResponse,
  ApiError,
} from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { useNavigation } from '@/stores/navigation'
import {
  WORKFLOW_STAGES,
  WorkflowStepper,
  StageBadge,
  type StageInfo,
} from './WorkflowStepper'
import { StartVisitDialog } from './StartVisitDialog'
import { AdvanceStageDialog } from './AdvanceStageDialog'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Activity,
  Users,
  Stethoscope,
  Clock,
  Search,
  Plus,
  ChevronRight,
  ArrowRight,
  Eye,
  Brain,
  CheckCircle2,
  ClipboardList,
  Receipt,
  Loader2,
  X,
  AlertCircle,
  RefreshCw,
  UserRound,
  CalendarDays,
  Phone,
  ArrowLeft,
  Sparkles,
  Printer,
  FileDown,
  Heart,
  Thermometer,
  Scale,
  Droplets,
  Pill,
  TestTube2,
  Banknote,
  HeartPulse,
  Ruler,
  MoreHorizontal,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

// ─── Types ─────────────────────────────────────────────────────────────────

interface VisitStageRecord {
  id: string
  stage: string
  status: 'Pending' | 'Active' | 'Completed' | 'Skipped'
  completedAt: string | null
  completedById: string | null
  notes: string | null
  createdAt: string
}

interface PatientVisit {
  id: string
  visitId: string
  patientId: string
  appointmentId: string | null
  doctorId: string | null
  stage: string
  status: string
  temperature: string | null
  bloodPressure: string | null
  pulse: string | null
  oxygenLevel: string | null
  weight: string | null
  height: string | null
  chiefComplaint: string | null
  notes: string | null
  visitType: string | null
  createdAt: string
  updatedAt: string | null
  patient: { id: string; patientId: string; name: string; phone: string } | null
  doctorName: string | null
  doctor: { id: string; doctorId: string; name: string; specialization: string } | null
  appointmentAptId: string | null
  stages: VisitStageRecord[]
  _count: { analyses: number }
  analyses?: Array<{ id: string; type: string; createdAt: string }>
  callSession?: { id: string; sessionId: string; status: string; duration: number } | null
}

interface VisitDetail extends PatientVisit {
  patient: {
    id: string
    patientId: string
    name: string
    phone: string
    email: string | null
    gender: string | null
    dateOfBirth: string | null
    bloodGroup: string | null
  }
  vitals: {
    temperature: string | null
    bloodPressure: string | null
    pulse: string | null
    oxygenLevel: string | null
    weight: string | null
    height: string | null
  }
}

interface StatsData {
  activeVisits: number
  todayRegistrations: number
  inConsultation: number
  awaitingPayment: number
  waitingCount: number
  labPendingCount: number
}

// ─── Vitals Summary Card ──────────────────────────────────────────────────

function VitalsSummaryCard({ visit }: { visit: PatientVisit }) {
  const vitals = [
    { label: 'Temp', value: visit.temperature, icon: <Thermometer className="h-3.5 w-3.5 text-orange-500" />, unit: '°C' },
    { label: 'BP', value: visit.bloodPressure, icon: <Heart className="h-3.5 w-3.5 text-red-500" />, unit: 'mmHg' },
    { label: 'Pulse', value: visit.pulse, icon: <HeartPulse className="h-3.5 w-3.5 text-purple-500" />, unit: 'bpm' },
    { label: 'SpO₂', value: visit.oxygenLevel, icon: <Droplets className="h-3.5 w-3.5 text-sky-500" />, unit: '%' },
    { label: 'Weight', value: visit.weight, icon: <Scale className="h-3.5 w-3.5 text-emerald-500" />, unit: 'kg' },
    { label: 'Height', value: visit.height, icon: <Ruler className="h-3.5 w-3.5 text-gray-500" />, unit: 'cm' },
  ].filter(v => v.value)

  if (vitals.length === 0) return null

  return (
    <div className="mt-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
      <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Vitals Recorded</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {vitals.map((v) => (
          <div key={v.label} className="text-center">
            {v.icon}
            <p className="text-[10px] text-muted-foreground mt-0.5">{v.label}</p>
            <p className="text-xs font-semibold">{v.value}<span className="text-[9px] text-muted-foreground ml-0.5">{v.unit}</span></p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function VisitStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    Completed: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    Cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  }
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', styles[status] ?? 'bg-gray-100 text-gray-700')}
    >
      {status}
    </Badge>
  )
}

// ─── Stats Skeleton ─────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="rounded-xl border">
          <CardContent className="p-4 lg:p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-12" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Visit Card ─────────────────────────────────────────────────────────────

interface DischargeSummaryData {
  patient: {
    name: string
    patientId: string
    age: number | null
    gender: string | null
    bloodGroup: string | null
    phone: string
    address: string | null
  }
  visit: {
    visitId: string
    admissionDate: string
    dischargeDate: string | null
    department: string
    doctorName: string
    visitType: string
  }
  diagnosis: string
  vitals: {
    temperature: string | null
    bloodPressure: string | null
    pulse: string | null
    oxygenLevel: string | null
    weight: string | null
    height: string | null
  }
  treatments: string[]
  medications: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  labResults: string[]
  invoices: Array<{ invoiceNumber: string; grandTotal: number; status: string; paidAmount: number }>
  payments: Array<{ paymentId: string; amount: number; method: string; status: string }>
  dischargeNotes: string
  followUpInstructions: string
  workflowTimeline: Array<{ stage: string; status: string; completedAt: string | null; notes: string | undefined }>
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function VisitCard({
  visit,
  onViewDetails,
  onAdvanceStage,
  onQuickAdvance,
  onDischarge,
  onQuickAI,
  onPrintSummary,
}: {
  visit: PatientVisit
  onViewDetails: () => void
  onAdvanceStage: () => void
  onQuickAdvance: () => void
  onDischarge: () => void
  onQuickAI: () => void
  onPrintSummary: () => void
}) {
  const patientInitials = visit.patient?.name
    ? visit.patient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '??'

  const stagesForStepper: StageInfo[] = WORKFLOW_STAGES.map(ws => {
    const stageRecord = visit.stages.find(s => s.stage === ws.key)
    return {
      stage: ws.key,
      status: stageRecord?.status ?? 'Pending',
      completedAt: stageRecord?.completedAt ?? undefined,
      notes: stageRecord?.notes ?? undefined,
    }
  })

  const isDischargeable = ['Paid', 'Billed', 'Prescribed'].includes(visit.stage)
  const isActive = visit.status === 'Active'
  const isCompleted = visit.status === 'Completed'

  return (
    <Card
      className={cn(
        'rounded-xl border shadow-sm hover:shadow-md transition-all duration-200',
        isCompleted && 'opacity-75'
      )}
    >
      <CardContent className="p-4 lg:p-5">
        {/* Top Row: Patient Info */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'flex items-center justify-center h-10 w-10 rounded-full text-sm font-bold shrink-0',
              isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            )}>
              {patientInitials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{visit.patient?.name ?? 'Unknown Patient'}</h3>
                {visit.visitType && visit.visitType !== 'OPD' && (
                  <Badge variant="outline" className={cn(
                    'text-[10px] px-1.5 py-0 font-medium',
                    visit.visitType === 'IPD' && 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300',
                    visit.visitType === 'Emergency' && 'border-red-300 text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300',
                    visit.visitType === 'Follow-up' && 'border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-300',
                  )}>
                    {visit.visitType}
                  </Badge>
                )}
                <VisitStatusBadge status={visit.status} />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-muted-foreground">{visit.visitId}</span>
                {visit.doctorName && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Stethoscope className="h-3 w-3" />
                      {visit.doctorName}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <StageBadge stage={visit.stage} />
          </div>
        </div>

        {/* Chief Complaint */}
        {visit.chiefComplaint && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
            {visit.chiefComplaint}
          </p>
        )}

        {/* Vitals Summary for Triage stage */}
        {visit.stage === 'Triage' && <VitalsSummaryCard visit={visit} />}

        {/* Workflow Stepper */}
        <div className="mb-3">
          <WorkflowStepper
            currentStage={visit.stage}
            stages={stagesForStepper}
            compact={true}
          />
        </div>

        {/* Bottom Row: Time + Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(new Date(visit.createdAt), { addSuffix: true })}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onViewDetails}
            >
              <Eye className="h-3 w-3 mr-1" />
              Details
            </Button>

            {isActive && (
              <>
                {/* Quick Advance Button — 1-click to next immediate stage */}
                {visit.stage !== 'Discharged' && visit.stage !== 'Billed' && visit.stage !== 'Paid' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white"
                    onClick={onQuickAdvance}
                    title="Advance to next stage"
                  >
                    <ArrowRight className="h-3 w-3 mr-1" />
                    {WORKFLOW_STAGES[WORKFLOW_STAGES.findIndex(s => s.key === visit.stage) + 1]?.icon}
                    Advance
                  </Button>
                )}
                {(visit.stage === 'Billed' || visit.stage === 'Paid') && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white"
                      >
                        <ArrowRight className="h-3 w-3 mr-1" />
                        Advance
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={onAdvanceStage}>
                        <ChevronRight className="h-3.5 w-3.5 mr-2" />
                        Select Next Stage...
                      </DropdownMenuItem>
                      {isDischargeable && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={onDischarge} className="text-emerald-600 focus:text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                            Complete & Discharge
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {visit.stage !== 'Billed' && visit.stage !== 'Paid' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={onAdvanceStage}
                    title="Select specific stage"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={onQuickAI}
                >
                  <Sparkles className="h-3 w-3 mr-1 text-purple-500" />
                  AI
                </Button>
              </>
            )}

            {isCompleted && (
              <>
                <Badge variant="secondary" className="text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={onPrintSummary}
                >
                  <Printer className="h-3 w-3 mr-1" />
                  Summary
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Visit Detail Panel ─────────────────────────────────────────────────────

function VisitDetailPanel({
  visitId,
  onClose,
}: {
  visitId: string | null
  onClose: () => void
}) {
  const { toast } = useToast()
  const { setCurrentPage } = useNavigation()
  const [visit, setVisit] = useState<VisitDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visitId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisit(null)
      return
    }

    const fetchDetail = async () => {
       
      setIsLoading(true)
       
      setError(null)
      try {
        const res = await apiGet<SingleResponse<VisitDetail>>(`/patient-visits/${visitId}`)
         
        setVisit(res.data)
      } catch (err) {
        if (err instanceof ApiError) {
           
          setError(err.message)
          toast({
            title: 'Error',
            description: 'Failed to load visit details',
            variant: 'destructive',
          })
        }
      } finally {
         
        setIsLoading(false)
      }
    }

    fetchDetail()
  }, [visitId, toast])

  if (!visitId) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 lg:relative lg:z-0 lg:bg-transparent">
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-background border-l shadow-xl lg:relative lg:inset-auto lg:shadow-none lg:border lg:rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 lg:rounded-t-xl">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold text-sm">Visit Details</h2>
          </div>
          <div className="flex items-center gap-2">
            {visit?.patient && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setCurrentPage('patient-detail', { id: visit.patient.id })
                  onClose()
                }}
              >
                <UserRound className="h-3 w-3 mr-1" />
                Patient
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-60px)] lg:h-auto lg:max-h-[calc(100vh-200px)]">
          <div className="p-4 space-y-5">
            {isLoading && (
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Separator />
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            )}

            {error && !isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3">
                <AlertCircle className="h-10 w-10 text-red-400" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {visit && !isLoading && (
              <>
                {/* Patient Info Card */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-sm font-bold">
                      {visit.patient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{visit.patient.name}</h3>
                      <p className="text-xs text-muted-foreground">{visit.patient.patientId}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {visit.patient.gender && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <UserRound className="h-3 w-3" /> {visit.patient.gender}
                      </div>
                    )}
                    {visit.patient.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3 w-3" /> {visit.patient.phone}
                      </div>
                    )}
                    {visit.patient.bloodGroup && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Activity className="h-3 w-3" /> Blood: {visit.patient.bloodGroup}
                      </div>
                    )}
                    {visit.patient.dateOfBirth && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarDays className="h-3 w-3" /> {format(new Date(visit.patient.dateOfBirth), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Visit Info */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{visit.visitId}</span>
                    <div className="flex items-center gap-2">
                      <VisitStatusBadge status={visit.status} />
                      <StageBadge stage={visit.stage} />
                    </div>
                  </div>
                  {visit.doctorName && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Stethoscope className="h-3 w-3" /> {visit.doctorName}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Started {format(new Date(visit.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                  {visit.appointmentAptId && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" /> Linked: {visit.appointmentAptId}
                    </p>
                  )}
                </div>

                {/* Chief Complaint */}
                {visit.chiefComplaint && (
                  <div className="rounded-lg border p-4 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chief Complaint</p>
                    <p className="text-sm">{visit.chiefComplaint}</p>
                  </div>
                )}

                {/* Vitals */}
                {(visit.vitals.temperature || visit.vitals.bloodPressure || visit.vitals.pulse || visit.vitals.oxygenLevel || visit.vitals.weight || visit.vitals.height) && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vitals</p>
                    <div className="grid grid-cols-3 gap-3">
                      {visit.vitals.temperature && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Temp</p>
                          <p className="text-sm font-semibold">{visit.vitals.temperature}</p>
                        </div>
                      )}
                      {visit.vitals.bloodPressure && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">BP</p>
                          <p className="text-sm font-semibold">{visit.vitals.bloodPressure}</p>
                        </div>
                      )}
                      {visit.vitals.pulse && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Pulse</p>
                          <p className="text-sm font-semibold">{visit.vitals.pulse}</p>
                        </div>
                      )}
                      {visit.vitals.oxygenLevel && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">O₂</p>
                          <p className="text-sm font-semibold">{visit.vitals.oxygenLevel}</p>
                        </div>
                      )}
                      {visit.vitals.weight && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Weight</p>
                          <p className="text-sm font-semibold">{visit.vitals.weight}</p>
                        </div>
                      )}
                      {visit.vitals.height && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Height</p>
                          <p className="text-sm font-semibold">{visit.vitals.height}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Workflow Timeline */}
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workflow Timeline</p>
                  <WorkflowStepper
                    currentStage={visit.stage}
                    stages={visit.stages.map(s => ({
                      stage: s.stage,
                      status: s.status,
                      completedAt: s.completedAt ?? undefined,
                      notes: s.notes ?? undefined,
                    }))}
                  />
                </div>

                {/* AI Analyses */}
                {visit.analyses && visit.analyses.length > 0 && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Analyses ({visit.analyses.length})</p>
                    <div className="space-y-2">
                      {visit.analyses.map(analysis => (
                        <div key={analysis.id} className="flex items-center justify-between rounded-md bg-purple-50 dark:bg-purple-900/20 p-2.5">
                          <div className="flex items-center gap-2">
                            <Brain className="h-3.5 w-3.5 text-purple-500" />
                            <span className="text-xs font-medium">{analysis.type}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {visit.notes && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</p>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{visit.notes}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

// ─── Discharge Dialog ────────────────────────────────────────────────────────

function DischargeDialog({
  open,
  onOpenChange,
  visitId,
  patientName,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  visitId: string
  patientName: string
  onSuccess?: () => void
}) {
  const { toast } = useToast()
  const [dischargeNotes, setDischargeNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDischargeNotes('')
       
      setIsSubmitting(false)
    }
  }, [open])

  const handleDischarge = async () => {
    setIsSubmitting(true)
    try {
      await apiPost(`/patient-visits/${visitId}/complete`, {
        dischargeNotes: dischargeNotes.trim() || undefined,
      })
      toast({
        title: 'Patient Discharged',
        description: `${patientName} has been discharged successfully.`,
      })
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({
          title: 'Discharge Failed',
          description: err.message || 'Something went wrong.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Complete & Discharge
          </DialogTitle>
          <DialogDescription>
            Discharge {patientName} and mark all remaining stages as completed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="discharge-notes">Discharge Notes</Label>
            <Textarea
              id="discharge-notes"
              placeholder="Add discharge instructions or summary..."
              value={dischargeNotes}
              onChange={e => setDischargeNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-700 dark:text-amber-300">
            <strong>Note:</strong> This will skip all remaining workflow stages (Lab, Prescription, Billing, Payment) and mark the visit as completed.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleDischarge}
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Discharging...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-2" />Discharge Patient</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Discharge Summary Dialog ────────────────────────────────────────────────

function DischargeSummaryDialog({
  open,
  onOpenChange,
  visitId,
  patientName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  visitId: string
  patientName: string
}) {
  const [summary, setSummary] = useState<DischargeSummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async (vid: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiGet<{ data: DischargeSummaryData }>(`/patient-visits/${vid}/discharge-summary`)
      setSummary(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && visitId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSummary(null)
       
      setError(null)
      fetchSummary(visitId)
    } else {
       
      setSummary(null)
       
      setError(null)
    }
  }, [open, visitId, fetchSummary])

  const handlePrint = () => {
    window.open(`/api/patient-visits/${visitId}/discharge-pdf`, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] print:max-w-none print:max-h-none print:p-0 print:rounded-none print:border-0">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-emerald-600" />
            Discharge Summary
          </DialogTitle>
          <DialogDescription>
            Comprehensive summary for {patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="print:hidden flex gap-2 mb-2">
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-1.5" />
            Print Summary
          </Button>
        </div>

        <ScrollArea className="max-h-[70vh] print:max-h-none">
          {isLoading && (
            <div className="space-y-4 p-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3">
              <AlertCircle className="h-10 w-10 text-red-400" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {summary && !isLoading && (
            <div className="discharge-summary print:p-6 space-y-6">
              {/* Hospital Header */}
              <div className="text-center border-b-2 border-emerald-600 pb-4 print:border-b-2">
                <h1 className="text-xl font-bold text-emerald-700 print:text-black">
                  MediBill Pro Hospital
                </h1>
                <p className="text-xs text-muted-foreground print:text-gray-600">
                  Multi-Specialty Hospital & Research Center
                </p>
                <p className="text-sm font-semibold mt-2 text-emerald-600 print:text-black">
                  DISCHARGE SUMMARY
                </p>
              </div>

              {/* Patient & Visit Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3 space-y-1.5 print:border print:rounded-none">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 print:text-black border-b pb-1">Patient Details</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div><span className="text-muted-foreground print:text-gray-600">Name:</span> <strong>{summary.patient.name}</strong></div>
                    <div><span className="text-muted-foreground print:text-gray-600">ID:</span> {summary.patient.patientId}</div>
                    {summary.patient.age && <div><span className="text-muted-foreground print:text-gray-600">Age:</span> {summary.patient.age} yrs</div>}
                    {summary.patient.gender && <div><span className="text-muted-foreground print:text-gray-600">Gender:</span> {summary.patient.gender}</div>}
                    {summary.patient.bloodGroup && <div><span className="text-muted-foreground print:text-gray-600">Blood:</span> {summary.patient.bloodGroup}</div>}
                    <div><span className="text-muted-foreground print:text-gray-600">Phone:</span> {summary.patient.phone}</div>
                    {summary.patient.address && <div className="col-span-2"><span className="text-muted-foreground print:text-gray-600">Address:</span> {summary.patient.address}</div>}
                  </div>
                </div>
                <div className="rounded-lg border p-3 space-y-1.5 print:border print:rounded-none">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 print:text-black border-b pb-1">Visit Details</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div><span className="text-muted-foreground print:text-gray-600">Visit ID:</span> {summary.visit.visitId}</div>
                    <div><span className="text-muted-foreground print:text-gray-600">Type:</span> {summary.visit.visitType}</div>
                    <div><span className="text-muted-foreground print:text-gray-600">Dept:</span> {summary.visit.department}</div>
                    <div><span className="text-muted-foreground print:text-gray-600">Doctor:</span> {summary.visit.doctorName}</div>
                    <div><span className="text-muted-foreground print:text-gray-600">Admission:</span> {summary.visit.admissionDate}</div>
                    <div><span className="text-muted-foreground print:text-gray-600">Discharge:</span> {summary.visit.dischargeDate || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Diagnosis */}
              <div className="rounded-lg border p-3 print:border print:rounded-none">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 print:text-black border-b pb-1">Diagnosis</p>
                <p className="text-sm mt-1 font-medium">{summary.diagnosis}</p>
              </div>

              {/* Vitals */}
              {(summary.vitals.temperature || summary.vitals.bloodPressure || summary.vitals.pulse || summary.vitals.oxygenLevel || summary.vitals.weight || summary.vitals.height) && (
                <div className="rounded-lg border p-3 print:border print:rounded-none">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 print:text-black border-b pb-1">Vitals at Admission</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-2">
                    {summary.vitals.temperature && (
                      <div className="text-center">
                        <Thermometer className="h-4 w-4 mx-auto text-orange-500 mb-1" />
                        <p className="text-xs text-muted-foreground">Temp</p>
                        <p className="text-sm font-semibold">{summary.vitals.temperature}</p>
                      </div>
                    )}
                    {summary.vitals.bloodPressure && (
                      <div className="text-center">
                        <Heart className="h-4 w-4 mx-auto text-red-500 mb-1" />
                        <p className="text-xs text-muted-foreground">BP</p>
                        <p className="text-sm font-semibold">{summary.vitals.bloodPressure}</p>
                      </div>
                    )}
                    {summary.vitals.pulse && (
                      <div className="text-center">
                        <Activity className="h-4 w-4 mx-auto text-purple-500 mb-1" />
                        <p className="text-xs text-muted-foreground">Pulse</p>
                        <p className="text-sm font-semibold">{summary.vitals.pulse}</p>
                      </div>
                    )}
                    {summary.vitals.oxygenLevel && (
                      <div className="text-center">
                        <Droplets className="h-4 w-4 mx-auto text-sky-500 mb-1" />
                        <p className="text-xs text-muted-foreground">O₂</p>
                        <p className="text-sm font-semibold">{summary.vitals.oxygenLevel}</p>
                      </div>
                    )}
                    {summary.vitals.weight && (
                      <div className="text-center">
                        <Scale className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
                        <p className="text-xs text-muted-foreground">Weight</p>
                        <p className="text-sm font-semibold">{summary.vitals.weight}</p>
                      </div>
                    )}
                    {summary.vitals.height && (
                      <div className="text-center">
                        <UserRound className="h-4 w-4 mx-auto text-gray-500 mb-1" />
                        <p className="text-xs text-muted-foreground">Height</p>
                        <p className="text-sm font-semibold">{summary.vitals.height}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Treatments */}
              {summary.treatments.length > 0 && (
                <div className="rounded-lg border p-3 print:border print:rounded-none">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 print:text-black border-b pb-1">Treatments & Procedures</p>
                  <ul className="mt-2 space-y-1">
                    {summary.treatments.map((t, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-emerald-600 print:text-black mt-0.5">•</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Medications */}
              {summary.medications.length > 0 && (
                <div className="rounded-lg border p-3 print:border print:rounded-none">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 print:text-black border-b pb-1">
                    <Pill className="h-3.5 w-3.5 inline mr-1" />
                    Medications Prescribed
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b print:border-b">
                          <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground print:text-gray-600">Medicine</th>
                          <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground print:text-gray-600">Dosage</th>
                          <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground print:text-gray-600">Frequency</th>
                          <th className="text-left py-1.5 font-medium text-muted-foreground print:text-gray-600">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.medications.map((med, i) => (
                          <tr key={i} className="border-b last:border-b-0 print:border-b">
                            <td className="py-1.5 pr-3 font-medium">{med.name || med.dosage}</td>
                            <td className="py-1.5 pr-3">{med.dosage}</td>
                            <td className="py-1.5 pr-3">{med.frequency}</td>
                            <td className="py-1.5">{med.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Lab Results */}
              {summary.labResults.length > 0 && (
                <div className="rounded-lg border p-3 print:border print:rounded-none">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 print:text-black border-b pb-1">
                    <TestTube2 className="h-3.5 w-3.5 inline mr-1" />
                    Lab Results
                  </p>
                  <ul className="mt-2 space-y-1">
                    {summary.labResults.map((r, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="mt-0.5">•</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Invoices & Payments */}
              {(summary.invoices.length > 0 || summary.payments.length > 0) && (
                <div className="rounded-lg border p-3 print:border print:rounded-none">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 print:text-black border-b pb-1">
                    <Banknote className="h-3.5 w-3.5 inline mr-1" />
                    Billing Summary
                  </p>
                  {summary.invoices.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {summary.invoices.map((inv, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>{inv.invoiceNumber}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{formatCurrency(inv.grandTotal)}</span>
                            <Badge variant="secondary" className={cn(
                              'text-[10px]',
                              inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            )}>
                              {inv.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Workflow Timeline */}
              {summary.workflowTimeline.length > 0 && (
                <div className="rounded-lg border p-3 print:border print:rounded-none">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 print:text-black border-b pb-1">Workflow Timeline</p>
                  <div className="mt-2 space-y-1.5">
                    {summary.workflowTimeline.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className={cn(
                          'h-2 w-2 rounded-full shrink-0',
                          step.status === 'Completed' && 'bg-emerald-500',
                          step.status === 'Active' && 'bg-emerald-400 ring-2 ring-emerald-200',
                          step.status === 'Skipped' && 'bg-gray-300',
                          step.status === 'Pending' && 'bg-gray-200'
                        )} />
                        <span className="flex-1">{step.stage}</span>
                        <span className="text-xs text-muted-foreground print:text-gray-600">
                          {step.completedAt ? format(new Date(step.completedAt), 'MMM d, HH:mm') : step.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discharge Notes */}
              <div className="rounded-lg border p-3 print:border print:rounded-none">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 print:text-black border-b pb-1">Discharge Notes</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{summary.dischargeNotes}</p>
              </div>

              {/* Follow-Up Instructions */}
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 p-3 print:border print:rounded-none print:bg-amber-50">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 print:text-black border-b border-amber-200 dark:border-amber-800 pb-1">Follow-Up Instructions</p>
                <div className="text-sm mt-1.5 whitespace-pre-wrap">{summary.followUpInstructions}</div>
              </div>

              {/* Footer */}
              <div className="border-t pt-4 print:border-t print:pt-4">
                <div className="grid grid-cols-3 gap-8 text-center text-sm">
                  <div>
                    <div className="border-b-2 border-gray-400 dark:border-gray-600 mb-1 h-10" />
                    <p className="text-xs text-muted-foreground print:text-gray-600">Attending Doctor</p>
                  </div>
                  <div>
                    <div className="border-b-2 border-gray-400 dark:border-gray-600 mb-1 h-10" />
                    <p className="text-xs text-muted-foreground print:text-gray-600">Patient / Guardian</p>
                  </div>
                  <div>
                    <div className="border-b-2 border-gray-400 dark:border-gray-600 mb-1 h-10" />
                    <p className="text-xs text-muted-foreground print:text-gray-600">Hospital Seal</p>
                  </div>
                </div>
                <p className="text-center text-[10px] text-muted-foreground mt-4 print:text-gray-400">
                  Generated by MediBill Pro Hospital Management System — {format(new Date(), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ─── Visit List Skeleton ────────────────────────────────────────────────────

function VisitListSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="rounded-xl border">
          <CardContent className="p-4 lg:p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function PatientWorkflowPage() {
  const { toast } = useToast()
  const [visits, setVisits] = useState<PatientVisit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<StatsData>({ activeVisits: 0, todayRegistrations: 0, inConsultation: 0, awaitingPayment: 0, waitingCount: 0, labPendingCount: 0 })

  // Quick stats filter state
  const [quickFilter, setQuickFilter] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [stageFilter, setStageFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Dialog states
  const [startVisitOpen, setStartVisitOpen] = useState(false)
  const [advanceStageVisit, setAdvanceStageVisit] = useState<PatientVisit | null>(null)
  const [dischargeVisit, setDischargeVisit] = useState<PatientVisit | null>(null)
  const [detailVisitId, setDetailVisitId] = useState<string | null>(null)
  const [summaryVisit, setSummaryVisit] = useState<PatientVisit | null>(null)

  const fetchVisits = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (statusFilter) params.status = statusFilter
      if (stageFilter) params.stage = stageFilter

      const res = await apiGet<PaginatedResponse<PatientVisit>>('/patient-visits', params)
      setVisits(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)

      // Calculate stats from the full dataset (first page is a reasonable approximation)
      // For accurate stats, fetch all active visits
      const allActiveRes = await apiGet<PaginatedResponse<PatientVisit>>('/patient-visits', { status: 'Active', limit: 1 })
      const allTodayRes = await apiGet<PaginatedResponse<PatientVisit>>('/patient-visits', { stage: 'Registration', limit: 1 })
      const consultationRes = await apiGet<PaginatedResponse<PatientVisit>>('/patient-visits', { stage: 'In-Consultation', limit: 1 })
      const billingRes = await apiGet<PaginatedResponse<PatientVisit>>('/patient-visits', { stage: 'Billed', limit: 1 })
      const waitingRes = await apiGet<PaginatedResponse<PatientVisit>>('/patient-visits', { stage: 'Waiting', limit: 1 })
      const labOrderedRes = await apiGet<PaginatedResponse<PatientVisit>>('/patient-visits', { stage: 'Lab-Ordered', limit: 1 })

      setStats({
        activeVisits: allActiveRes.total,
        todayRegistrations: allTodayRes.total,
        inConsultation: consultationRes.total,
        awaitingPayment: billingRes.total,
        waitingCount: waitingRes.total,
        labPendingCount: labOrderedRes.total,
      })
    } catch (err) {
      if (err instanceof ApiError) {
        toast({
          title: 'Error',
          description: 'Failed to load patient visits',
          variant: 'destructive',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter, stageFilter, toast])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVisits()
  }, [fetchVisits])

  // Filter visits by search query (client-side)
  const filteredVisits = visits.filter(v => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      v.patient?.name?.toLowerCase().includes(q) ||
      v.visitId.toLowerCase().includes(q) ||
      v.chiefComplaint?.toLowerCase().includes(q) ||
      v.doctorName?.toLowerCase().includes(q)
    )
  })

  const handleAdvanceStage = (visit: PatientVisit) => {
    setAdvanceStageVisit(visit)
  }

  const handleQuickAdvance = async (visit: PatientVisit) => {
    const currentIndex = WORKFLOW_STAGES.findIndex(s => s.key === visit.stage)
    const nextStage = WORKFLOW_STAGES[currentIndex + 1]
    if (!nextStage) return

    try {
      await apiPost(`/patient-visits/${visit.id}/advance-stage`, {
        stage: nextStage.key,
      })
      toast({
        title: 'Stage Advanced',
        description: `${visit.patient?.name} moved to "${nextStage.label}" stage.`,
      })
      fetchVisits()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({
          title: 'Quick Advance Failed',
          description: err.message || 'This stage requires a form. Use the ⋯ menu to open the advance dialog.',
          variant: 'destructive',
        })
      }
    }
  }

  const handleDischarge = (visit: PatientVisit) => {
    setDischargeVisit(visit)
  }

  const handleQuickAI = async (visit: PatientVisit) => {
    try {
      await apiPost('/ai/analyze', {
        patientId: visit.patientId,
        symptoms: visit.chiefComplaint || 'General health checkup',
        type: 'Health Analysis',
        visitId: visit.id,
        vitals: visit.temperature ? {
          temperature: visit.temperature,
          bloodPressure: visit.bloodPressure,
          pulse: visit.pulse,
          oxygenLevel: visit.oxygenLevel,
        } : undefined,
        additionalContext: visit.doctorName ? `Assigned doctor: ${visit.doctorName}` : undefined,
      })
      toast({
        title: 'AI Analysis Started',
        description: `Analyzing visit for ${visit.patient?.name}...`,
      })
    } catch (err) {
      if (err instanceof ApiError) {
        toast({
          title: 'AI Analysis Failed',
          description: err.message,
          variant: 'destructive',
        })
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-7 w-7 text-emerald-600" />
            Patient Workflow
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track patient journey from registration to discharge
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchVisits} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setStartVisitOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Visit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
          <Card
            className={cn('rounded-xl border shadow-sm cursor-pointer transition-all hover:shadow-md', quickFilter === 'active' && 'ring-2 ring-emerald-500')}
            onClick={() => { setQuickFilter(quickFilter === 'active' ? null : 'active'); setStatusFilter(quickFilter === 'active' ? '' : 'Active'); setStageFilter(''); setPage(1) }}
          >
            <CardContent className="p-3 lg:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Visits</p>
                  <p className="text-xl lg:text-2xl font-bold mt-0.5">{stats.activeVisits}</p>
                </div>
                <div className={cn('flex items-center justify-center rounded-lg p-2 shrink-0', 'bg-emerald-50 dark:bg-emerald-950')}>
                  <Users className="h-4 w-4 lg:h-5 lg:w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('rounded-xl border shadow-sm cursor-pointer transition-all hover:shadow-md', quickFilter === 'consultation' && 'ring-2 ring-emerald-500')}
            onClick={() => { setQuickFilter(quickFilter === 'consultation' ? null : 'consultation'); setStageFilter(quickFilter === 'consultation' ? '' : 'In-Consultation'); setPage(1) }}
          >
            <CardContent className="p-3 lg:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider">In Consultation</p>
                  <p className="text-xl lg:text-2xl font-bold mt-0.5">{stats.inConsultation}</p>
                </div>
                <div className={cn('flex items-center justify-center rounded-lg p-2 shrink-0', 'bg-emerald-50 dark:bg-emerald-950')}>
                  <Stethoscope className="h-4 w-4 lg:h-5 lg:w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('rounded-xl border shadow-sm cursor-pointer transition-all hover:shadow-md', quickFilter === 'waiting' && 'ring-2 ring-emerald-500')}
            onClick={() => { setQuickFilter(quickFilter === 'waiting' ? null : 'waiting'); setStageFilter(quickFilter === 'waiting' ? '' : 'Waiting'); setPage(1) }}
          >
            <CardContent className="p-3 lg:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider">Waiting</p>
                  <p className="text-xl lg:text-2xl font-bold mt-0.5">{stats.waitingCount}</p>
                </div>
                <div className={cn('flex items-center justify-center rounded-lg p-2 shrink-0', 'bg-yellow-50 dark:bg-yellow-950')}>
                  <Clock className="h-4 w-4 lg:h-5 lg:w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('rounded-xl border shadow-sm cursor-pointer transition-all hover:shadow-md', quickFilter === 'lab' && 'ring-2 ring-emerald-500')}
            onClick={() => { setQuickFilter(quickFilter === 'lab' ? null : 'lab'); setStageFilter(quickFilter === 'lab' ? '' : 'Lab-Ordered'); setPage(1) }}
          >
            <CardContent className="p-3 lg:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider">Lab Pending</p>
                  <p className="text-xl lg:text-2xl font-bold mt-0.5">{stats.labPendingCount}</p>
                </div>
                <div className={cn('flex items-center justify-center rounded-lg p-2 shrink-0', 'bg-blue-50 dark:bg-blue-950')}>
                  <TestTube2 className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('rounded-xl border shadow-sm cursor-pointer transition-all hover:shadow-md', quickFilter === 'registration' && 'ring-2 ring-emerald-500')}
            onClick={() => { setQuickFilter(quickFilter === 'registration' ? null : 'registration'); setStageFilter(quickFilter === 'registration' ? '' : 'Registration'); setPage(1) }}
          >
            <CardContent className="p-3 lg:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider">Registration</p>
                  <p className="text-xl lg:text-2xl font-bold mt-0.5">{stats.todayRegistrations}</p>
                </div>
                <div className={cn('flex items-center justify-center rounded-lg p-2 shrink-0', 'bg-sky-50 dark:bg-sky-950')}>
                  <ClipboardList className="h-4 w-4 lg:h-5 lg:w-5 text-sky-600 dark:text-sky-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('rounded-xl border shadow-sm cursor-pointer transition-all hover:shadow-md', quickFilter === 'billing' && 'ring-2 ring-emerald-500')}
            onClick={() => { setQuickFilter(quickFilter === 'billing' ? null : 'billing'); setStageFilter(quickFilter === 'billing' ? '' : 'Billed'); setPage(1) }}
          >
            <CardContent className="p-3 lg:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider">Awaiting Payment</p>
                  <p className="text-xl lg:text-2xl font-bold mt-0.5">{stats.awaitingPayment}</p>
                </div>
                <div className={cn('flex items-center justify-center rounded-lg p-2 shrink-0', 'bg-amber-50 dark:bg-amber-950')}>
                  <Receipt className="h-4 w-4 lg:h-5 lg:w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-[140px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {WORKFLOW_STAGES.map(s => (
              <SelectItem key={s.key} value={s.key}>
                {s.icon} {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient name, visit ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total > 0 ? `Showing ${filteredVisits.length} of ${total} visits` : 'No visits found'}
        </p>
      </div>

      {/* Visit Cards */}
      {isLoading ? (
        <VisitListSkeleton />
      ) : filteredVisits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
          <Activity className="h-12 w-12 opacity-20" />
          <div className="text-center">
            <p className="text-sm font-medium">No visits found</p>
            <p className="text-xs mt-1">
              {searchQuery || statusFilter || stageFilter
                ? 'Try adjusting your filters'
                : 'Start a new patient visit to begin tracking'}
            </p>
          </div>
          {!searchQuery && !statusFilter && !stageFilter && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setStartVisitOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Start New Visit
            </Button>
          )}
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Visit Cards Grid */}
          <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-4', detailVisitId && 'lg:grid-cols-1')}>
            {filteredVisits.map(visit => (
              <VisitCard
                key={visit.id}
                visit={visit}
                onViewDetails={() => setDetailVisitId(visit.id)}
                onAdvanceStage={() => handleAdvanceStage(visit)}
                onQuickAdvance={() => handleQuickAdvance(visit)}
                onDischarge={() => handleDischarge(visit)}
                onQuickAI={() => handleQuickAI(visit)}
                onPrintSummary={() => setSummaryVisit(visit)}
              />
            ))}
          </div>

          {/* Detail Panel */}
          {detailVisitId && (
            <div className="hidden lg:block">
              <VisitDetailPanel
                visitId={detailVisitId}
                onClose={() => setDetailVisitId(null)}
              />
            </div>
          )}

          {/* Mobile Detail Overlay */}
          {detailVisitId && (
            <div className="block lg:hidden">
              <VisitDetailPanel
                visitId={detailVisitId}
                onClose={() => setDetailVisitId(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <StartVisitDialog
        open={startVisitOpen}
        onOpenChange={setStartVisitOpen}
        onSuccess={fetchVisits}
      />

      {advanceStageVisit && (
        <AdvanceStageDialog
          open={!!advanceStageVisit}
          onOpenChange={open => { if (!open) setAdvanceStageVisit(null) }}
          visitId={advanceStageVisit.id}
          currentStage={advanceStageVisit.stage}
          patientId={advanceStageVisit.patientId}
          patientName={advanceStageVisit.patient?.name ?? 'Unknown'}
          onSuccess={fetchVisits}
        />
      )}

      {summaryVisit && (
        <DischargeSummaryDialog
          open={!!summaryVisit}
          onOpenChange={(open) => { if (!open) setSummaryVisit(null) }}
          visitId={summaryVisit.id}
          patientName={summaryVisit.patient?.name ?? ''}
        />
      )}

      {dischargeVisit && (
        <DischargeDialog
          open={!!dischargeVisit}
          onOpenChange={open => { if (!open) setDischargeVisit(null) }}
          visitId={dischargeVisit.id}
          patientName={dischargeVisit.patient?.name ?? 'Unknown'}
          onSuccess={fetchVisits}
        />
      )}
    </div>
  )
}



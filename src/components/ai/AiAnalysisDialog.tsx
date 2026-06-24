'use client'

import React, { useState } from 'react'
import {
  Brain,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Stethoscope,
  FileText,
  Loader2,
  Thermometer,
  HeartPulse,
  Wind,
  Scale,
  ChevronRight,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiPost, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ==================== TYPES ====================

interface AiAnalysisDialogProps {
  patientId: string
  patientName: string
  patientContext?: {
    age?: string
    gender?: string
    bloodGroup?: string
    allergies?: string
    pastTreatments?: string
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface AnalysisResult {
  possibleConditions: string[]
  recommendedActions: string[]
  suggestedTests: string[]
  urgency: 'Low' | 'Medium' | 'High' | 'Emergency'
  followUp: string
  summary: string
}

// ==================== URGENCY BADGE ====================

function UrgencyBadge({ urgency }: { urgency: string }) {
  const config: Record<string, { className: string; icon: React.ElementType }> = {
    Low: {
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
    },
    Medium: {
      className: 'bg-amber-100 text-amber-700 border-amber-200',
      icon: AlertTriangle,
    },
    High: {
      className: 'bg-orange-100 text-orange-700 border-orange-200',
      icon: AlertTriangle,
    },
    Emergency: {
      className: 'bg-red-100 text-red-700 border-red-200',
      icon: AlertTriangle,
    },
  }
  const c = config[urgency] || config.Low
  const Icon = c.icon
  return (
    <Badge variant="outline" className={`gap-1 ${c.className}`}>
      <Icon className="size-3" />
      {urgency}
    </Badge>
  )
}

// ==================== RESULTS DISPLAY ====================

function AnalysisResults({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-4">
      {/* Urgency */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-emerald-600" />
          <span className="text-sm font-semibold text-muted-foreground">Assessment Urgency</span>
        </div>
        <UrgencyBadge urgency={result.urgency} />
      </div>

      {/* Summary */}
      {result.summary && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <p className="text-sm font-medium text-emerald-800 leading-relaxed">{result.summary}</p>
        </div>
      )}

      <Separator />

      {/* Possible Conditions */}
      {result.possibleConditions && result.possibleConditions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Stethoscope className="size-4 text-emerald-600" />
            Possible Conditions
          </h4>
          <ul className="space-y-1">
            {result.possibleConditions.map((condition, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span>{condition}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Actions */}
      {result.recommendedActions && result.recommendedActions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            Recommended Actions
          </h4>
          <ul className="space-y-1">
            {result.recommendedActions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Tests */}
      {result.suggestedTests && result.suggestedTests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="size-4 text-emerald-600" />
            Suggested Tests
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {result.suggestedTests.map((test, i) => (
              <Badge key={i} variant="outline" className="bg-muted/50 text-foreground text-xs">
                {test}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Follow-Up */}
      {result.followUp && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="size-4 text-emerald-600" />
              Follow-Up
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{result.followUp}</p>
          </div>
        </>
      )}

      <Separator />

      {/* Disclaimer */}
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-2.5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-700 leading-relaxed">
            <span className="font-semibold">Disclaimer:</span> AI-generated preliminary analysis. Always consult a qualified healthcare professional.
          </p>
        </div>
      </div>
    </div>
  )
}

// ==================== MAIN DIALOG ====================

export function AiAnalysisDialog({
  patientId,
  patientName,
  patientContext,
  open,
  onOpenChange,
}: AiAnalysisDialogProps) {
  const { toast } = useToast()

  // Form state
  const [analysisType, setAnalysisType] = useState('Health Analysis')
  const [symptoms, setSymptoms] = useState('')
  const [temperature, setTemperature] = useState('')
  const [bloodPressure, setBloodPressure] = useState('')
  const [pulse, setPulse] = useState('')
  const [oxygenLevel, setOxygenLevel] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setAnalysisType('Health Analysis')
      setSymptoms('')
      setTemperature('')
      setBloodPressure('')
      setPulse('')
      setOxygenLevel('')
      setResult(null)

      // Auto-fill additional context from patient data
      if (patientContext) {
        const parts: string[] = []
        if (patientContext.age) parts.push(`Age: ${patientContext.age}`)
        if (patientContext.gender) parts.push(`Gender: ${patientContext.gender}`)
        if (patientContext.bloodGroup) parts.push(`Blood group: ${patientContext.bloodGroup}`)
        if (patientContext.allergies) parts.push(`Allergies: ${patientContext.allergies}`)
        if (patientContext.pastTreatments) parts.push(`Past treatments: ${patientContext.pastTreatments}`)
        if (parts.length > 0) {
          setAdditionalContext(parts.join('\n'))
        }
      }
    }
  }, [open, patientContext])

  const handleAnalyze = async () => {
    if (!symptoms.trim()) {
      toast({ title: 'Symptoms Required', description: 'Please enter symptoms to analyze.', variant: 'destructive' })
      return
    }

    setAnalyzing(true)
    setResult(null)

    const hasVitals = temperature || bloodPressure || pulse || oxygenLevel

    try {
      const body: Record<string, unknown> = {
        patientId,
        type: analysisType,
        symptoms: symptoms.trim(),
      }

      if (hasVitals) {
        body.vitals = {}
        if (temperature) (body.vitals as Record<string, string>).temperature = temperature
        if (bloodPressure) (body.vitals as Record<string, string>).bloodPressure = bloodPressure
        if (pulse) (body.vitals as Record<string, string>).pulse = pulse
        if (oxygenLevel) (body.vitals as Record<string, string>).oxygenLevel = oxygenLevel
      }

      if (additionalContext.trim()) {
        body.additionalContext = additionalContext.trim()
      }

      const res = await apiPost<{ result: AnalysisResult }>('/ai/analyze', body)
      setResult(res.result)
      toast({ title: 'Analysis Complete', description: 'Health analysis generated successfully.' })
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Analysis Failed', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Analysis Failed', description: 'Failed to complete analysis. Please try again.', variant: 'destructive' })
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Brain className="size-4" />
            </div>
            AI Health Analysis
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            Quick analysis for <span className="font-medium text-foreground">{patientName}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-2">
            {/* Patient Context Banner */}
            {patientContext && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 border px-3 py-2 text-xs text-muted-foreground flex-wrap">
                {patientContext.age && (
                  <span className="flex items-center gap-1">
                    Age: <span className="font-medium text-foreground">{patientContext.age}</span>
                  </span>
                )}
                {patientContext.gender && (
                  <span className="flex items-center gap-1">
                    Gender: <span className="font-medium text-foreground">{patientContext.gender}</span>
                  </span>
                )}
                {patientContext.bloodGroup && (
                  <span className="flex items-center gap-1">
                    Blood: <span className="font-medium text-foreground">{patientContext.bloodGroup}</span>
                  </span>
                )}
                {patientContext.allergies && (
                  <span className="flex items-center gap-1 text-red-600">
                    Allergies: <span className="font-medium">{patientContext.allergies}</span>
                  </span>
                )}
              </div>
            )}

            {/* Analysis Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Analysis Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'Health Analysis', label: 'Health Analysis', icon: Stethoscope },
                  { value: 'Symptom Check', label: 'Symptom Check', icon: Activity },
                  { value: 'Drug Interaction', label: 'Drug Interaction', icon: FileText },
                  { value: 'Diagnosis Suggestion', label: 'Diagnosis', icon: Brain },
                ].map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      onClick={() => setAnalysisType(type.value)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all ${
                        analysisType === type.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                          : 'border-border bg-card hover:border-emerald-300 hover:bg-emerald-50/50'
                      }`}
                    >
                      <Icon className="size-3.5" />
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Symptoms */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Symptoms *</Label>
              <Textarea
                placeholder="Enter symptoms separated by commas (e.g., headache, fever, sore throat)"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>

            {/* Quick Vitals */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <HeartPulse className="size-3.5 text-emerald-500" />
                Vitals <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="relative">
                  <Thermometer className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Temp °F"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="h-8 text-xs pl-7"
                  />
                </div>
                <div className="relative">
                  <HeartPulse className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="BP 120/80"
                    value={bloodPressure}
                    onChange={(e) => setBloodPressure(e.target.value)}
                    className="h-8 text-xs pl-7"
                  />
                </div>
                <div className="relative">
                  <Activity className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Pulse"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    className="h-8 text-xs pl-7"
                  />
                </div>
                <div className="relative">
                  <Wind className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="SpO2 %"
                    value={oxygenLevel}
                    onChange={(e) => setOxygenLevel(e.target.value)}
                    className="h-8 text-xs pl-7"
                  />
                </div>
              </div>
            </div>

            {/* Additional Context */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Additional Context <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="Allergies, current medications, past treatments..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>

            <Separator />

            {/* Analyze Button */}
            <Button
              onClick={handleAnalyze}
              disabled={analyzing || !symptoms.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 font-semibold"
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="mr-2 size-4" />
                  Run AI Analysis
                </>
              )}
            </Button>

            {/* Loading Skeleton */}
            {analyzing && (
              <div className="space-y-3 mt-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Separator />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            )}

            {/* Results */}
            {!analyzing && result && (
              <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50/30 to-transparent p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <Brain className="size-3.5" />
                  </div>
                  <span className="text-sm font-semibold">Analysis Results</span>
                </div>
                <AnalysisResults result={result} />
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={analyzing}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

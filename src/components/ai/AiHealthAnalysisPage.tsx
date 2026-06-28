'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Brain,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Stethoscope,
  FileText,
  History,
  ChevronDown,
  ChevronUp,
  Loader2,
  Thermometer,
  HeartPulse,
  Wind,
  Scale,
  User,
  ChevronRight,
  ShieldAlert,
  Lightbulb,
  ArrowLeftRight,
  Droplets,
  Eye,
  Frown,
  Zap,
  Wind as WindIconAlias,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, ApiError, type PaginatedResponse, type SingleResponse } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ==================== TYPES ====================

interface PatientOption {
  id: string
  patientId: string
  name: string
  phone: string
  gender?: string | null
  age?: number | null
  bloodGroup?: string | null
  allergies?: string[] | null
  pastTreatments?: string[] | null
}

// Matches the EXACT JSON shape returned by the Grok AI prompt (see /api/ai/analyze route)
interface AnalysisResult {
  summary: string
  disclaimer?: string
  possibleConditions: Array<{
    name: string
    likelihood?: string
    description?: string
    reasoning?: string
  }>
  recommendedActions: string[]
  suggestedTests: string[]
  urgencyLevel: string
  urgencyReason?: string
  followUpRecommendations: string[]
  lifestyleAdvice?: string[]
  redFlags?: string[]
  // Fallback fields when AI response parsing fails
  error?: string
  rawResponse?: string
}

// Matches the EXACT shape returned by /api/ai/history (see history route)
interface AnalysisHistoryInput {
  patientId?: string
  visitId?: string
  type?: string
  symptoms?: string
  vitals?: Record<string, string | null> | null
  additionalContext?: string | null
  patientContext?: Record<string, unknown>
}

interface AnalysisHistoryItem {
  id: string
  analysisId: string
  type: string
  input: AnalysisHistoryInput
  result: AnalysisResult
  model?: string
  patientName?: string
  createdAt: string
}

// Shape of the data field inside the analyze POST response
interface AnalyzeResponseData {
  id: string
  analysisId: string
  type: string
  input: AnalysisHistoryInput
  result: AnalysisResult
  model: string
  createdAt: string
}

interface Vitals {
  temperature: string
  bloodPressure: string
  pulse: string
  oxygenLevel: string
  weight: string
  height: string
}

const DEFAULT_VITALS: Vitals = {
  temperature: '',
  bloodPressure: '',
  pulse: '',
  oxygenLevel: '',
  weight: '',
  height: '',
}

const ANALYSIS_TYPES = [
  { value: 'Health Analysis', label: 'Health Analysis', icon: Stethoscope },
  { value: 'Symptom Check', label: 'Symptom Check', icon: Activity },
  { value: 'Drug Interaction', label: 'Drug Interaction', icon: FileText },
  { value: 'Diagnosis Suggestion', label: 'Diagnosis Suggestion', icon: Brain },
]

// Quick symptom buttons
const QUICK_SYMPTOMS = [
  { label: 'Fever', icon: Thermometer, color: 'text-red-500 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950/30' },
  { label: 'Headache', icon: Brain, color: 'text-purple-500 hover:bg-purple-50 hover:border-purple-200 dark:hover:bg-purple-950/30' },
  { label: 'Cough', icon: WindIconAlias, color: 'text-amber-500 hover:bg-amber-50 hover:border-amber-200 dark:hover:bg-amber-950/30' },
  { label: 'Fatigue', icon: Zap, color: 'text-gray-500 hover:bg-gray-50 hover:border-gray-200 dark:hover:bg-gray-950/30' },
  { label: 'Nausea', icon: Frown, color: 'text-green-500 hover:bg-green-50 hover:border-green-200 dark:hover:bg-green-950/30' },
  { label: 'Chest Pain', icon: HeartPulse, color: 'text-rose-500 hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-950/30' },
  { label: 'Shortness of Breath', icon: Wind, color: 'text-sky-500 hover:bg-sky-50 hover:border-sky-200 dark:hover:bg-sky-950/30' },
  { label: 'Dizziness', icon: Eye, color: 'text-indigo-500 hover:bg-indigo-50 hover:border-indigo-200 dark:hover:bg-indigo-950/30' },
]

/**
 * Safely extract the urgencyLevel from a potentially malformed AI result.
 */
function getUrgency(result: AnalysisResult): string {
  return result.urgencyLevel || 'Medium'
}

/**
 * Safely parse an AI result, providing defaults for missing/malformed fields.
 */
function safeResult(raw: unknown): AnalysisResult {
  const r = raw as Record<string, unknown>
  return {
    summary: typeof r.summary === 'string' ? r.summary : '',
    disclaimer: typeof r.disclaimer === 'string' ? r.disclaimer : undefined,
    possibleConditions: Array.isArray(r.possibleConditions)
      ? r.possibleConditions.map((c: unknown) => {
          const obj = c as Record<string, unknown>
          return {
            name: typeof obj.name === 'string' ? obj.name : String(obj),
            likelihood: typeof obj.likelihood === 'string' ? obj.likelihood : undefined,
            description: typeof obj.description === 'string' ? obj.description : undefined,
            reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : undefined,
          }
        })
      : [],
    recommendedActions: Array.isArray(r.recommendedActions)
      ? r.recommendedActions.map((a: unknown) => String(a))
      : [],
    suggestedTests: Array.isArray(r.suggestedTests)
      ? r.suggestedTests.map((t: unknown) => String(t))
      : [],
    urgencyLevel: typeof r.urgencyLevel === 'string' ? r.urgencyLevel : 'Medium',
    urgencyReason: typeof r.urgencyReason === 'string' ? r.urgencyReason : undefined,
    followUpRecommendations: Array.isArray(r.followUpRecommendations)
      ? r.followUpRecommendations.map((f: unknown) => String(f))
      : [],
    lifestyleAdvice: Array.isArray(r.lifestyleAdvice)
      ? r.lifestyleAdvice.map((l: unknown) => String(l))
      : [],
    redFlags: Array.isArray(r.redFlags)
      ? r.redFlags.map((rf: unknown) => String(rf))
      : [],
    error: typeof r.error === 'string' ? r.error : undefined,
    rawResponse: typeof r.rawResponse === 'string' ? r.rawResponse : undefined,
  }
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

// ==================== RESULTS CARD ====================

function AnalysisResultsCard({ result }: { result: AnalysisResult }) {
  const urgency = getUrgency(result)

  return (
    <div className="space-y-4">
      {/* Urgency */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-emerald-600" />
          <span className="text-sm font-semibold text-muted-foreground">Assessment Urgency</span>
        </div>
        <UrgencyBadge urgency={urgency} />
      </div>

      {/* Urgency Reason */}
      {result.urgencyReason && (
        <p className="text-xs text-muted-foreground leading-relaxed">{result.urgencyReason}</p>
      )}

      {/* Red Flags */}
      {result.redFlags && result.redFlags.length > 0 && (
        <div className="space-y-2 rounded-lg bg-red-50 border border-red-200 p-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-red-700">
            <ShieldAlert className="size-4" />
            Red Flags
          </h4>
          <ul className="space-y-1">
            {result.redFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      {result.summary && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
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
          <ul className="space-y-2">
            {result.possibleConditions.map((condition, i) => (
              <li key={i} className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="size-3.5 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium">{condition.name}</span>
                  </div>
                  {condition.likelihood && (
                    <Badge
                      variant="outline"
                      className={
                        condition.likelihood === 'High'
                          ? 'bg-red-50 text-red-700 border-red-200 text-[10px]'
                          : condition.likelihood === 'Medium'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                      }
                    >
                      {condition.likelihood}
                    </Badge>
                  )}
                </div>
                {condition.reasoning && (
                  <p className="text-xs text-muted-foreground ml-5.5 leading-relaxed">{condition.reasoning}</p>
                )}
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
          <ul className="space-y-1.5">
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
          <div className="flex flex-wrap gap-2">
            {result.suggestedTests.map((test, i) => (
              <Badge key={i} variant="outline" className="bg-muted/50 text-foreground">
                {test}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Lifestyle Advice */}
      {result.lifestyleAdvice && result.lifestyleAdvice.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="size-4 text-emerald-600" />
            Lifestyle Advice
          </h4>
          <ul className="space-y-1.5">
            {result.lifestyleAdvice.map((advice, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Lightbulb className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span>{advice}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Follow-Up Recommendations */}
      {result.followUpRecommendations && result.followUpRecommendations.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="size-4 text-emerald-600" />
              Follow-Up Recommendations
            </h4>
            <ul className="space-y-1.5">
              {result.followUpRecommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Clock className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* AI Error / Raw Response Fallback */}
      {result.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">
            <span className="font-semibold">AI Error:</span> {result.error}
          </p>
          {result.rawResponse && (
            <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-words">{result.rawResponse}</pre>
          )}
        </div>
      )}

      <Separator />

      {/* Disclaimer */}
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <span className="font-semibold">Disclaimer:</span>{' '}
            {result.disclaimer
              ? result.disclaimer
              : 'This is AI-generated preliminary analysis. Always consult a qualified healthcare professional for diagnosis and treatment.'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ==================== HISTORY ITEM ====================

function HistoryItem({ item, onCompare }: { item: AnalysisHistoryItem; onCompare: (item: AnalysisHistoryItem) => void }) {
  const [expanded, setExpanded] = useState(false)
  const date = new Date(item.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Symptoms come from item.input.symptoms (matches the history API shape)
  const symptoms = item.input?.symptoms || ''
  const urgency = getUrgency(item.result)

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:bg-muted/50 hover:shadow-sm">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Brain className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{item.type}</p>
              <UrgencyBadge urgency={urgency} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {date} · {symptoms.length > 60 ? `${symptoms.substring(0, 60)}...` : symptoms || 'No symptoms recorded'}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-12 rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onCompare(item) }} className="gap-1.5">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Compare with Previous
            </Button>
          </div>
          <AnalysisResultsCard result={item.result} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ==================== ANALYSIS COMPARISON DIALOG ====================

function ComparisonDialog({
  current,
  previous,
  open,
  onOpenChange,
}: {
  current: AnalysisHistoryItem
  previous: AnalysisHistoryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const currentSymptoms = (current.input?.symptoms || '').split(',').map(s => s.trim()).filter(Boolean)
  const previousSymptoms = previous ? (previous.input?.symptoms || '').split(',').map(s => s.trim()).filter(Boolean) : []

  const currentConditions = current.result.possibleConditions.map(c => c.name)
  const previousConditions = previous ? previous.result.possibleConditions.map(c => c.name) : []

  const newConditions = currentConditions.filter(c => !previousConditions.includes(c))
  const resolvedConditions = previousConditions.filter(c => !currentConditions.includes(c))
  const persistentConditions = currentConditions.filter(c => previousConditions.includes(c))

  const newSymptoms = currentSymptoms.filter(s => !previousSymptoms.includes(s))
  const resolvedSymptoms = previousSymptoms.filter(s => !currentSymptoms.includes(s))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
            Analysis Comparison
          </DialogTitle>
          <DialogDescription>Compare current analysis with the previous one</DialogDescription>
        </DialogHeader>

        {previous ? (
          <div className="space-y-6">
            {/* Summary Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">PREVIOUS</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(previous.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <UrgencyBadge urgency={getUrgency(previous.result)} />
                {previous.result.summary && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-4">{previous.result.summary}</p>
                )}
              </div>
              <div className="rounded-lg border p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">CURRENT</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(current.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <UrgencyBadge urgency={getUrgency(current.result)} />
                {current.result.summary && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-4">{current.result.summary}</p>
                )}
              </div>
            </div>

            {/* Symptom Changes */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="size-4 text-emerald-600" />
                Symptom Changes
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {newSymptoms.length > 0 ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">New Symptoms</p>
                    {newSymptoms.map((s, i) => (
                      <Badge key={i} variant="outline" className="mr-1 mb-1 text-[10px] border-red-200 text-red-700 bg-red-50">{s}</Badge>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">New Symptoms</p>
                    <p className="text-xs text-muted-foreground">No new symptoms</p>
                  </div>
                )}
                {resolvedSymptoms.length > 0 ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Resolved Symptoms</p>
                    {resolvedSymptoms.map((s, i) => (
                      <Badge key={i} variant="outline" className="mr-1 mb-1 text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">{s}</Badge>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Resolved Symptoms</p>
                    <p className="text-xs text-muted-foreground">No resolved symptoms</p>
                  </div>
                )}
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Current Symptoms</p>
                  {currentSymptoms.length > 0 ? currentSymptoms.map((s, i) => (
                    <Badge key={i} variant="secondary" className="mr-1 mb-1 text-[10px]">{s}</Badge>
                  )) : <p className="text-xs text-muted-foreground">None</p>}
                </div>
              </div>
            </div>

            {/* Condition Changes */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Stethoscope className="size-4 text-emerald-600" />
                Condition Changes
              </h4>
              <div className="space-y-2">
                {newConditions.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">New Conditions Detected</p>
                    {newConditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <ArrowLeftRight className="size-3.5 text-red-500" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}
                {resolvedConditions.length > 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Resolved Conditions</p>
                    {resolvedConditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}
                {persistentConditions.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Ongoing Conditions</p>
                    {persistentConditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Activity className="size-3.5 text-amber-500" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Urgency Comparison */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Urgency:</span>
              <div className="flex items-center gap-2">
                <UrgencyBadge urgency={getUrgency(previous.result)} />
                <ChevronRight className="size-4 text-muted-foreground" />
                <UrgencyBadge urgency={getUrgency(current.result)} />
              </div>
              <span className="text-xs text-muted-foreground">
                {getUrgency(current.result) === getUrgency(previous.result)
                  ? 'No change'
                  : getUrgency(current.result) === 'Low' || getUrgency(current.result) === 'Medium'
                    ? '✅ Improved'
                    : '⚠️ Worsened'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <History className="h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No previous analysis found for comparison</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ==================== VITALS INPUT SECTION ====================

function VitalsInput({
  vitals,
  onChange,
}: {
  vitals: Vitals
  onChange: (field: keyof Vitals, value: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Thermometer className="size-3" />
          Temperature
        </Label>
        <Input
          placeholder="e.g., 98.6°F"
          value={vitals.temperature}
          onChange={(e) => onChange('temperature', e.target.value)}
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <HeartPulse className="size-3" />
          Blood Pressure
        </Label>
        <Input
          placeholder="e.g., 120/80"
          value={vitals.bloodPressure}
          onChange={(e) => onChange('bloodPressure', e.target.value)}
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Activity className="size-3" />
          Pulse (bpm)
        </Label>
        <Input
          placeholder="e.g., 72"
          value={vitals.pulse}
          onChange={(e) => onChange('pulse', e.target.value)}
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Wind className="size-3" />
          Oxygen Level (%)
        </Label>
        <Input
          placeholder="e.g., 98"
          value={vitals.oxygenLevel}
          onChange={(e) => onChange('oxygenLevel', e.target.value)}
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Scale className="size-3" />
          Weight (kg)
        </Label>
        <Input
          placeholder="e.g., 70"
          value={vitals.weight}
          onChange={(e) => onChange('weight', e.target.value)}
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <User className="size-3" />
          Height (cm)
        </Label>
        <Input
          placeholder="e.g., 170"
          value={vitals.height}
          onChange={(e) => onChange('height', e.target.value)}
          className="h-9 text-sm"
        />
      </div>
    </div>
  )
}

// ==================== PATIENT CONTEXT PANEL ====================

function PatientContextPanel({ patient }: { patient: PatientOption }) {
  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="size-4 text-emerald-600" />
          Patient Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="text-sm font-medium">{patient.name}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Patient ID</p>
            <p className="text-sm font-mono font-medium">{patient.patientId}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Age</p>
            <p className="text-sm font-medium">{patient.age || '-'} years</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Gender</p>
            <p className="text-sm font-medium">{patient.gender || '-'}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Blood Group</p>
            <div className="flex items-center gap-2">
              <Droplets className="size-3.5 text-red-500" />
              <p className="text-sm font-medium">{patient.bloodGroup || '-'}</p>
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="text-sm font-medium">{patient.phone || '-'}</p>
          </div>
        </div>

        {/* Allergies */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="size-3.5 text-red-500" />
            Active Allergies
          </h4>
          {patient.allergies && patient.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {patient.allergies.map((allergy, i) => (
                <Badge key={i} variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                  <AlertTriangle className="mr-1 size-3" />
                  {allergy}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No known allergies</p>
          )}
        </div>

        {/* Past Treatments */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <History className="size-3.5 text-emerald-600" />
            Past Treatments
          </h4>
          {patient.pastTreatments && patient.pastTreatments.length > 0 ? (
            <div className="space-y-1.5">
              {patient.pastTreatments.map((treatment, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{treatment}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No past treatments recorded</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== MAIN PAGE COMPONENT ====================

export function AiHealthAnalysisPage() {
  const { toast } = useToast()

  // Form state
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [analysisType, setAnalysisType] = useState('Health Analysis')
  const [symptoms, setSymptoms] = useState('')
  const [vitals, setVitals] = useState<Vitals>(DEFAULT_VITALS)
  const [vitalsOpen, setVitalsOpen] = useState(false)
  const [additionalContext, setAdditionalContext] = useState('')

  // Loading / result state
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)

  // History state
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Comparison state
  const [comparisonItem, setComparisonItem] = useState<AnalysisHistoryItem | null>(null)
  const [comparisonPrevious, setComparisonPrevious] = useState<AnalysisHistoryItem | null>(null)
  const [comparisonOpen, setComparisonOpen] = useState(false)

  // Fetch patients
  const fetchPatients = useCallback(async () => {
    setLoadingPatients(true)
    try {
      const res = await apiGet<PaginatedResponse<PatientOption>>('/patients', { limit: 100 })
      setPatients(res.data || [])
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setLoadingPatients(false)
    }
  }, [toast])

  // Fetch analysis history for selected patient
  const fetchHistory = useCallback(async (patientId: string) => {
    if (!patientId) {
      setHistory([])
      return
    }
    setLoadingHistory(true)
    try {
      const res = await apiGet<PaginatedResponse<AnalysisHistoryItem>>('/ai/history', {
        patientId,
        limit: 20,
      })
      setHistory((res.data || []) as AnalysisHistoryItem[])
    } catch {
      // History endpoint may not exist yet, silently handle
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPatients()
  }, [fetchPatients])

  // When patient changes, fetch their history
    
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHistory(selectedPatientId)
  }, [selectedPatientId, fetchHistory])

  // Update a vitals field
  const handleVitalChange = (field: keyof Vitals, value: string) => {
    setVitals((prev) => ({ ...prev, [field]: value }))
  }

  // Quick symptom handler
  const handleQuickSymptom = (symptom: string) => {
    const currentSymptoms = symptoms
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    if (!currentSymptoms.includes(symptom)) {
      setSymptoms(prev => prev.trim() ? `${prev.trim()}, ${symptom}` : symptom)
    }
  }

  // Run analysis
  const handleAnalyze = async () => {
    if (!selectedPatientId) {
      toast({ title: 'Patient Required', description: 'Please select a patient first.', variant: 'destructive' })
      return
    }
    if (!symptoms.trim()) {
      toast({ title: 'Symptoms Required', description: 'Please enter symptoms to analyze.', variant: 'destructive' })
      return
    }

    setAnalyzing(true)
    setResult(null)

    const hasVitals = Object.values(vitals).some((v) => v.trim() !== '')

    try {
      const body: Record<string, unknown> = {
        patientId: selectedPatientId,
        type: analysisType,
        symptoms: symptoms.trim(),
      }

      if (hasVitals) {
        body.vitals = {
          ...(vitals.temperature && { temperature: vitals.temperature }),
          ...(vitals.bloodPressure && { bloodPressure: vitals.bloodPressure }),
          ...(vitals.pulse && { pulse: vitals.pulse }),
          ...(vitals.oxygenLevel && { oxygenLevel: vitals.oxygenLevel }),
          ...(vitals.weight && { weight: vitals.weight }),
          ...(vitals.height && { height: vitals.height }),
        }
      }

      if (additionalContext.trim()) {
        body.additionalContext = additionalContext.trim()
      }

      // FIX: apiPost returns { data: { id, analysisId, type, input, result, model, createdAt } }
      // so we must access res.data.result, NOT res.result
      const res = await apiPost<SingleResponse<AnalyzeResponseData>>('/ai/analyze', body)

      // Safely parse the AI result in case it's malformed
      const parsedResult = safeResult(res.data.result)
      setResult(parsedResult)
      toast({ title: 'Analysis Complete', description: 'Health analysis generated successfully.' })

      // Refresh history after successful analysis
      fetchHistory(selectedPatientId)
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

  // Handle comparison
  const handleCompare = (item: AnalysisHistoryItem) => {
    const itemIndex = history.findIndex(h => h.id === item.id)
    if (itemIndex > 0) {
      setComparisonItem(item)
      setComparisonPrevious(history[itemIndex - 1])
    } else {
      setComparisonItem(item)
      setComparisonPrevious(null)
    }
    setComparisonOpen(true)
  }

  // Auto-fill additional context from patient data
  const selectedPatient = patients.find((p) => p.id === selectedPatientId)

  const getAutoContext = () => {
    if (!selectedPatient) return ''
    const parts: string[] = []
    if (selectedPatient.allergies && selectedPatient.allergies.length > 0) {
      parts.push(`Allergies: ${selectedPatient.allergies.join(', ')}`)
    }
    if (selectedPatient.pastTreatments && selectedPatient.pastTreatments.length > 0) {
      parts.push(`Past treatments: ${selectedPatient.pastTreatments.join(', ')}`)
    }
    return parts.join('\n')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Brain className="size-5" />
          </div>
          AI Health Analysis
        </h1>
        <p className="text-sm text-muted-foreground">
          Grok-powered preliminary health assessments to assist clinical decision-making
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Input Form */}
        <div className="space-y-4">
          {/* Patient Selection */}
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="size-4 text-emerald-600" />
                Patient Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingPatients ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select a patient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{patient.name}</span>
                          <span className="text-muted-foreground text-xs">({patient.patientId})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Selected Patient Info */}
              {selectedPatient && (
                <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-800">{selectedPatient.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700">
                      <span>{selectedPatient.patientId}</span>
                      {selectedPatient.gender && <span>· {selectedPatient.gender}</span>}
                      {selectedPatient.bloodGroup && <span>· Blood: {selectedPatient.bloodGroup}</span>}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis Type */}
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="size-4 text-emerald-600" />
                Analysis Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {ANALYSIS_TYPES.map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      onClick={() => setAnalysisType(type.value)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                        analysisType === type.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                          : 'border-border bg-card hover:border-emerald-300 hover:bg-emerald-50/50'
                      }`}
                    >
                      <Icon className="size-4" />
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Symptoms Input */}
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="size-4 text-emerald-600" />
                Symptoms
              </CardTitle>
              <CardDescription>Enter symptoms or use quick-select buttons</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Quick Symptom Buttons */}
              <div className="flex flex-wrap gap-2">
                {QUICK_SYMPTOMS.map((sym) => {
                  const Icon = sym.icon
                  const currentSymptoms = symptoms.split(',').map(s => s.trim()).filter(Boolean)
                  const isActive = currentSymptoms.includes(sym.label)
                  return (
                    <button
                      key={sym.label}
                      type="button"
                      onClick={() => handleQuickSymptom(sym.label)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : `border-border bg-card ${sym.color}`
                      }`}
                    >
                      <Icon className="size-3.5" />
                      {sym.label}
                    </button>
                  )
                })}
              </div>

              <Textarea
                placeholder="Enter symptoms separated by commas (e.g., headache, fever, sore throat, body pain)"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="resize-none min-h-[100px]"
                rows={4}
              />

              {/* Vitals Collapsible */}
              <Collapsible open={vitalsOpen} onOpenChange={setVitalsOpen}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50">
                    <span className="flex items-center gap-2">
                      <HeartPulse className="size-4 text-emerald-500" />
                      Vitals & Measurements
                      {Object.values(vitals).some((v) => v.trim() !== '') && (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Filled</Badge>
                      )}
                    </span>
                    {vitalsOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 rounded-lg border bg-muted/20 p-4">
                    <VitalsInput vitals={vitals} onChange={handleVitalChange} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Additional Context */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Additional Context <span className="font-normal">(optional)</span>
                </Label>
                <Textarea
                  placeholder="Allergies, past treatments, current medications..."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
                {selectedPatient && !additionalContext.trim() && getAutoContext() && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-emerald-600"
                    onClick={() => setAdditionalContext(getAutoContext())}
                  >
                    Auto-fill from patient records
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={analyzing || !selectedPatientId || !symptoms.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 text-base font-semibold shadow-sm"
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="mr-2 size-5" />
                Run AI Analysis
              </>
            )}
          </Button>
        </div>

        {/* Right: Results + Patient Context */}
        <div className="space-y-4">
          {/* Patient Context Panel */}
          {selectedPatient && (
            <PatientContextPanel patient={selectedPatient} />
          )}

          {/* Loading Skeleton */}
          {analyzing && (
            <Card className="rounded-xl border shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Separator />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Separator />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          )}

          {/* Results Card */}
          {!analyzing && result && (
            <Card className="rounded-xl border border-emerald-200 shadow-sm bg-gradient-to-br from-emerald-50/30 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                    <Brain className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Analysis Results</CardTitle>
                    <CardDescription>
                      {analysisType} · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <AnalysisResultsCard result={result} />
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!analyzing && !result && (
            <Card className="rounded-xl border shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
                  <Brain className="size-8 text-emerald-600" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-semibold text-foreground">No Analysis Yet</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Select a patient, enter symptoms, and run an AI analysis to see results here
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* History Section */}
      {selectedPatientId && (
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="size-5 text-emerald-600" />
                <div>
                  <CardTitle className="text-base">Analysis History</CardTitle>
                  <CardDescription>Recent AI analyses for this patient</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchHistory(selectedPatientId)}
                disabled={loadingHistory}
              >
                {loadingHistory ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8">
                <History className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No analysis history found for this patient</p>
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {history.map((item) => (
                    <HistoryItem key={item.id} item={item} onCompare={handleCompare} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comparison Dialog */}
      {comparisonItem && (
        <ComparisonDialog
          current={comparisonItem}
          previous={comparisonPrevious}
          open={comparisonOpen}
          onOpenChange={setComparisonOpen}
        />
      )}
    </div>
  )
}

'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Check, X } from 'lucide-react'

// ─── Workflow Stage Constants ──────────────────────────────────────────────

export const WORKFLOW_STAGES = [
  { key: 'Registration', label: 'Registration', icon: '📋' },
  { key: 'Triage', label: 'Triage', icon: '🩺' },
  { key: 'Waiting', label: 'Waiting', icon: '⏳' },
  { key: 'In-Consultation', label: 'Consultation', icon: '👨‍⚕️' },
  { key: 'Lab-Ordered', label: 'Lab Ordered', icon: '🧪' },
  { key: 'Lab-Done', label: 'Lab Done', icon: '🔬' },
  { key: 'Prescribed', label: 'Prescribed', icon: '💊' },
  { key: 'Billed', label: 'Billed', icon: '🧾' },
  { key: 'Paid', label: 'Paid', icon: '💳' },
  { key: 'Discharged', label: 'Discharged', icon: '✅' },
] as const

export interface StageInfo {
  stage: string
  status: 'Pending' | 'Active' | 'Completed' | 'Skipped'
  completedAt?: string
  notes?: string
}

interface WorkflowStepperProps {
  currentStage: string
  stages: StageInfo[]
  compact?: boolean
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d ago`
}

// ─── Stepper Node ───────────────────────────────────────────────────────────

function StepperNode({
  stageInfo,
  index: _index,
  isLast,
  compact,
}: {
  stageInfo: StageInfo
  index: number
  isLast: boolean
  compact: boolean
}) {
  const stageMeta = WORKFLOW_STAGES.find(s => s.key === stageInfo.stage)
  const label = stageMeta?.label ?? stageInfo.stage

  const isCompleted = stageInfo.status === 'Completed'
  const isActive = stageInfo.status === 'Active'
  const isSkipped = stageInfo.status === 'Skipped'
  const isPending = stageInfo.status === 'Pending'

  const nodeClasses = cn(
    'relative flex items-center justify-center shrink-0 rounded-full border-2 transition-all',
    compact ? 'h-5 w-5 text-[10px]' : 'h-8 w-8 text-xs',
    isCompleted && 'bg-emerald-500 border-emerald-500 text-white',
    isActive && 'bg-emerald-100 border-emerald-500 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 ring-2 ring-emerald-500/30',
    isSkipped && 'bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-500',
    isPending && 'bg-background border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-500'
  )

  const lineClasses = cn(
    'flex-1 h-0.5 transition-all min-w-[12px] max-w-[40px]',
    isLast && 'opacity-0',
    isCompleted && 'bg-emerald-500',
    isActive && 'bg-emerald-500/40 border-dashed',
    (isPending || isSkipped) && 'bg-gray-200 dark:bg-gray-700'
  )

  // Previous node determines line color, so check next node
  // The line between this node and next is determined by this node's completion
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-0 cursor-default">
          <div className={nodeClasses}>
            {isCompleted && <Check className={compact ? 'h-2.5 w-2.5' : 'h-4 w-4'} />}
            {isActive && (
              <span className={cn(
                'absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping',
              )} />
            )}
            {isSkipped && <X className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />}
            {isPending && !compact && <span className="text-[10px]">•</span>}
          </div>
          {!isLast && <div className={lineClasses} />}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px]">
        <p className="font-semibold text-xs">{label}</p>
        {isCompleted && stageInfo.completedAt && (
          <p className="text-[10px] opacity-80">Completed {formatRelativeTime(stageInfo.completedAt)} ({formatTime(stageInfo.completedAt)})</p>
        )}
        {isSkipped && <p className="text-[10px] opacity-80">Skipped</p>}
        {isActive && <p className="text-[10px] opacity-80">In Progress</p>}
        {isPending && <p className="text-[10px] opacity-80">Pending</p>}
        {stageInfo.notes && <p className="text-[10px] opacity-70 mt-0.5 italic">{stageInfo.notes}</p>}
      </TooltipContent>
    </Tooltip>
  )
}

// ─── Horizontal Stepper ────────────────────────────────────────────────────

function HorizontalStepper({ currentStage: _currentStage, stages, compact }: WorkflowStepperProps) {
  return (
    <div className="flex items-center w-full overflow-x-auto py-1">
      {stages.map((stageInfo, index) => (
        <StepperNode
          key={stageInfo.stage}
          stageInfo={stageInfo}
          index={index}
          isLast={index === stages.length - 1}
          compact={compact ?? false}
        />
      ))}
    </div>
  )
}

// ─── Vertical Stepper (mobile) ──────────────────────────────────────────────

function VerticalStepper({ currentStage: _currentStage, stages, compact }: WorkflowStepperProps) {
  return (
    <div className="flex flex-col gap-0 w-full">
      {stages.map((stageInfo, index) => {
        const stageMeta = WORKFLOW_STAGES.find(s => s.key === stageInfo.stage)
        const label = stageMeta?.label ?? stageInfo.stage
        const isLast = index === stages.length - 1

        const isCompleted = stageInfo.status === 'Completed'
        const isActive = stageInfo.status === 'Active'
        const isSkipped = stageInfo.status === 'Skipped'

        const nodeClasses = cn(
          'relative flex items-center justify-center shrink-0 rounded-full border-2 transition-all',
          compact ? 'h-5 w-5 text-[10px]' : 'h-7 w-7 text-xs',
          isCompleted && 'bg-emerald-500 border-emerald-500 text-white',
          isActive && 'bg-emerald-100 border-emerald-500 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
          isSkipped && 'bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600',
          stageInfo.status === 'Pending' && 'bg-background border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600'
        )

        const lineClasses = cn(
          'w-0.5 self-stretch transition-all',
          isLast && 'opacity-0',
          isCompleted && 'bg-emerald-500',
          isActive && 'bg-emerald-500/40',
          (stageInfo.status === 'Pending' || isSkipped) && 'bg-gray-200 dark:bg-gray-700'
        )

        return (
          <div key={stageInfo.stage} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={nodeClasses}>
                {isCompleted && <Check className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />}
                {isActive && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                )}
                {isSkipped && <X className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />}
                {stageInfo.status === 'Pending' && <span className="text-[10px]">•</span>}
              </div>
              {!isLast && <div className={lineClasses} />}
            </div>
            <div className="flex-1 pb-4 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn(
                  'text-sm font-medium',
                  isCompleted && 'text-emerald-700 dark:text-emerald-300',
                  isActive && 'text-emerald-700 dark:text-emerald-300 font-semibold',
                  isSkipped && 'text-gray-400 line-through',
                  stageInfo.status === 'Pending' && 'text-muted-foreground',
                )}>
                  {label}
                </p>
                {!compact && isCompleted && stageInfo.completedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(stageInfo.completedAt)}
                  </span>
                )}
              </div>
              {stageInfo.notes && (
                <p className="text-xs text-muted-foreground mt-0.5 italic truncate">
                  {stageInfo.notes}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Compact Dots View ──────────────────────────────────────────────────────

function CompactDots({ stages }: { stages: StageInfo[] }) {
  return (
    <div className="flex items-center gap-1">
      {stages.map((stageInfo, index) => {
        const isCompleted = stageInfo.status === 'Completed'
        const isActive = stageInfo.status === 'Active'
        const isSkipped = stageInfo.status === 'Skipped'

        const dotClasses = cn(
          'h-2 w-2 rounded-full transition-all',
          isCompleted && 'bg-emerald-500',
          isActive && 'bg-emerald-500 ring-2 ring-emerald-500/40 animate-pulse',
          isSkipped && 'bg-gray-300 dark:bg-gray-600',
          stageInfo.status === 'Pending' && 'bg-gray-200 dark:bg-gray-700'
        )

        return (
          <React.Fragment key={stageInfo.stage}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={dotClasses} />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs font-medium">
                  {WORKFLOW_STAGES.find(s => s.key === stageInfo.stage)?.label ?? stageInfo.stage}
                </p>
              </TooltipContent>
            </Tooltip>
            {index < stages.length - 1 && (
              <div className={cn(
                'w-1.5 h-px',
                isCompleted ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'
              )} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Main Export ───────────────────────────────────────────────────────────

export function WorkflowStepper({
  currentStage,
  stages,
  compact = false,
}: WorkflowStepperProps) {
  if (compact) {
    return <CompactDots stages={stages} />
  }

  return (
    <div className="w-full">
      {/* Desktop: Horizontal */}
      <div className="hidden md:block">
        <HorizontalStepper
          currentStage={currentStage}
          stages={stages}
          compact={false}
        />
      </div>
      {/* Mobile: Vertical */}
      <div className="block md:hidden">
        <VerticalStepper
          currentStage={currentStage}
          stages={stages}
          compact={false}
        />
      </div>
    </div>
  )
}

// ─── Stage Badge Helper ─────────────────────────────────────────────────────

export function StageBadge({ stage }: { stage: string }) {
  const stageMeta = WORKFLOW_STAGES.find(s => s.key === stage)
  const label = stageMeta?.label ?? stage

  const colorMap: Record<string, string> = {
    'Registration': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    'Triage': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'Waiting': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    'In-Consultation': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'Lab-Ordered': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'Lab-Done': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    'Prescribed': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    'Billed': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    'Paid': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    'Discharged': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        colorMap[stage] ?? 'bg-gray-100 text-gray-700'
      )}
    >
      {stage === stageMeta?.key && (
        <span className="text-[10px]">{stageMeta?.icon ?? ''}</span>
      )}
      {label}
    </span>
  )
}

// ─── Get Next Available Stages ─────────────────────────────────────────────

export function getNextStages(currentStage: string): string[] {
  const currentIndex = WORKFLOW_STAGES.findIndex(s => s.key === currentStage)
  if (currentIndex === -1) return []
  return WORKFLOW_STAGES.slice(currentIndex + 1).map(s => s.key)
}

'use client'

import { ClinicalNotesSection } from './ClinicalNotesSection'
import { ProblemListSection } from './ProblemListSection'
import { MedicationListSection } from './MedicationListSection'
import { Separator } from '@/components/ui/separator'

interface Props { patientId: string }

export function EhrTab({ patientId }: Props) {
  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-card p-1">
        <div className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          EHR / EMR — Full Electronic Health Record
        </div>
      </div>

      <ProblemListSection patientId={patientId} />
      <Separator />
      <MedicationListSection patientId={patientId} />
      <Separator />
      <ClinicalNotesSection patientId={patientId} />
    </div>
  )
}

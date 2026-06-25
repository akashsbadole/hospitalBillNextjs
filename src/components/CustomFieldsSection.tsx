'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface CustomFieldDef {
  id: string
  label: string
  fieldType: string
  options: string | null
  required: boolean
  placeholder: string | null
}

interface CustomFieldsSectionProps {
  entityType: 'Patient' | 'Visit' | 'Medicine' | 'Invoice' | 'Appointment'
  entityId?: string | null
  values: Record<string, string | null>
  onChange: (fieldId: string, value: string | null) => void
  showTitle?: boolean
}

export function CustomFieldsSection({
  entityType, entityId, values, onChange, showTitle = true,
}: CustomFieldsSectionProps) {
  const [fields, setFields] = useState<CustomFieldDef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await apiGet<{ data: CustomFieldDef[] }>(`/custom-fields?entityType=${entityType}&activeOnly=true`)
        if (!cancelled) setFields(res.data.sort((a, b) => a.label.localeCompare(b.label)))
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [entityType])

  if (loading) return null
  if (fields.length === 0) return null

  const parsedOptions = (opt: string | null): string[] => {
    if (!opt) return []
    try { return JSON.parse(opt) } catch { return opt.split('\n').filter(Boolean) }
  }

  return (
    <div className="space-y-4">
      {showTitle && (
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Additional Fields
        </h3>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map(field => {
          const val = values[field.id] || ''

          if (field.fieldType === 'boolean') {
            return (
              <div key={field.id} className="flex items-center gap-2">
                <Switch
                  checked={val === 'true'}
                  onCheckedChange={c => onChange(field.id, c ? 'true' : 'false')}
                />
                <Label>{field.label}</Label>
              </div>
            )
          }

          if (field.fieldType === 'checkbox') {
            return (
              <div key={field.id} className="flex items-center gap-2">
                <Checkbox
                  checked={val === 'true'}
                  onCheckedChange={c => onChange(field.id, c ? 'true' : 'false')}
                />
                <Label>{field.label}</Label>
              </div>
            )
          }

          if (field.fieldType === 'select') {
            return (
              <div key={field.id} className="space-y-1.5">
                <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
                <Select
                  value={val}
                  onValueChange={v => onChange(field.id, v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {parsedOptions(field.options).map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          }

          if (field.fieldType === 'multi_select') {
            const selected = val ? val.split(',').map(s => s.trim()).filter(Boolean) : []
            const options = parsedOptions(field.options)
            return (
              <div key={field.id} className="space-y-1.5">
                <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
                <div className="flex flex-wrap gap-2">
                  {options.map(opt => {
                    const isSelected = selected.includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                        }`}
                        onClick={() => {
                          const next = isSelected ? selected.filter(s => s !== opt) : [...selected, opt]
                          onChange(field.id, next.length > 0 ? next.join(', ') : null)
                        }}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          }

          if (field.fieldType === 'textarea') {
            return (
              <div key={field.id} className="space-y-1.5 sm:col-span-2">
                <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
                <Textarea
                  value={val}
                  onChange={e => onChange(field.id, e.target.value || null)}
                  placeholder={field.placeholder || ''}
                  rows={3}
                />
              </div>
            )
          }

          if (field.fieldType === 'number') {
            return (
              <div key={field.id} className="space-y-1.5">
                <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
                <Input
                  type="number"
                  value={val}
                  onChange={e => onChange(field.id, e.target.value || null)}
                  placeholder={field.placeholder || ''}
                />
              </div>
            )
          }

          if (field.fieldType === 'date') {
            return (
              <div key={field.id} className="space-y-1.5">
                <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
                <Input
                  type="date"
                  value={val}
                  onChange={e => onChange(field.id, e.target.value || null)}
                />
              </div>
            )
          }

          return (
            <div key={field.id} className="space-y-1.5">
              <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
              <Input
                value={val}
                onChange={e => onChange(field.id, e.target.value || null)}
                placeholder={field.placeholder || ''}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export async function saveCustomFieldValues(
  entityType: string,
  entityId: string,
  values: Record<string, string | null>,
): Promise<void> {
  if (Object.keys(values).length === 0) return
  await apiPost('/custom-field-values', { entityType, entityId, values })
}

export async function loadCustomFieldValues(
  entityType: string,
  entityId: string,
): Promise<Record<string, string | null>> {
  try {
    const res = await apiGet<{ data: Record<string, { value: string | null }> }>(
      `/custom-field-values?entityType=${entityType}&entityId=${entityId}`,
    )
    const result: Record<string, string | null> = {}
    for (const [fieldId, val] of Object.entries(res.data)) {
      result[fieldId] = val.value
    }
    return result
  } catch {
    return {}
  }
}

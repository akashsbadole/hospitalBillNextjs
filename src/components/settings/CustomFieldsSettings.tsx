'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface CustomField {
  id: string
  entityType: string
  label: string
  fieldType: string
  options: string | null
  required: boolean
  placeholder: string | null
  sortOrder: number
  isActive: boolean
}

const ENTITY_TYPES = ['Patient', 'Visit', 'Medicine', 'Invoice', 'Appointment']
const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (Dropdown)' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'boolean', label: 'Yes/No' },
]

export function CustomFieldsSettings() {
  const { toast } = useToast()
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchFields = async () => {
    try {
      const params = entityFilter !== 'all' ? `?entityType=${entityFilter}` : ''
      const res = await apiGet<{ data: CustomField[] }>(`/custom-fields${params}`)
      setFields(res.data)
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load custom fields', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFields() }, [entityFilter])

  const handleSave = async (formData: Partial<CustomField>) => {
    setSaving(true)
    try {
      if (editingField) {
        await apiPut(`/custom-fields/${editingField.id}`, formData)
        toast({ title: 'Field Updated' })
      } else {
        await apiPost('/custom-fields', formData)
        toast({ title: 'Field Created' })
      }
      setDialogOpen(false)
      setEditingField(null)
      fetchFields()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to save', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom field? All associated values will be removed.')) return
    try {
      await apiDelete(`/custom-fields/${id}`)
      toast({ title: 'Field Deleted' })
      fetchFields()
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleToggleActive = async (field: CustomField) => {
    try {
      await apiPut(`/custom-fields/${field.id}`, { isActive: !field.isActive })
      fetchFields()
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle', variant: 'destructive' })
    }
  }

  const filtered = entityFilter === 'all' ? fields : fields.filter(f => f.entityType === entityFilter)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Custom Fields</CardTitle>
            <CardDescription>
              Add custom data fields to patient, visit, medicine, invoice, and appointment records.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {ENTITY_TYPES.map(et => <SelectItem key={et} value={et}>{et}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingField(null); setDialogOpen(true) }}>
              <Plus className="mr-2 size-4" /> Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No custom fields configured yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(field => (
                  <TableRow key={field.id}>
                    <TableCell><Badge variant="outline">{field.entityType}</Badge></TableCell>
                    <TableCell className="font-medium">{field.label}</TableCell>
                    <TableCell>{FIELD_TYPES.find(ft => ft.value === field.fieldType)?.label || field.fieldType}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{field.options || '-'}</TableCell>
                    <TableCell>{field.required ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <Switch checked={field.isActive} onCheckedChange={() => handleToggleActive(field)} />
                    </TableCell>
                    <TableCell>{field.sortOrder}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingField(field); setDialogOpen(true) }}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(field.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FieldDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        field={editingField}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}

function FieldDialog({
  open, onOpenChange, field, onSave, saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  field: CustomField | null
  onSave: (data: Partial<CustomField>) => Promise<void>
  saving: boolean
}) {
  const [entityType, setEntityType] = useState('Patient')
  const [label, setLabel] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [options, setOptions] = useState('')
  const [required, setRequired] = useState(false)
  const [placeholder, setPlaceholder] = useState('')
  const [sortOrder, setSortOrder] = useState(0)

  useEffect(() => {
    if (field) {
      setEntityType(field.entityType)
      setLabel(field.label)
      setFieldType(field.fieldType)
      setOptions(field.options || '')
      setRequired(field.required)
      setPlaceholder(field.placeholder || '')
      setSortOrder(field.sortOrder)
    } else {
      setEntityType('Patient')
      setLabel('')
      setFieldType('text')
      setOptions('')
      setRequired(false)
      setPlaceholder('')
      setSortOrder(0)
    }
  }, [field, open])

  const needsOptions = fieldType === 'select' || fieldType === 'multi_select'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    onSave({
      entityType: entityType as CustomField['entityType'],
      label: label.trim(),
      fieldType: fieldType as CustomField['fieldType'],
      options: needsOptions ? options : null,
      required,
      placeholder: placeholder || null,
      sortOrder,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{field ? 'Edit Custom Field' : 'Add Custom Field'}</DialogTitle>
          <DialogDescription>
            Configure a new field that will appear on the {entityType.toLowerCase()} form.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Entity Type</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(et => <SelectItem key={et} value={et}>{et}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Field Label</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Fever, Smoking Status" />
          </div>
          <div className="space-y-2">
            <Label>Field Type</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {needsOptions && (
            <div className="space-y-2">
              <Label>Options (one per line)</Label>
              <Textarea
                value={options}
                onChange={e => setOptions(e.target.value)}
                placeholder={`Option 1\nOption 2\nOption 3`}
                rows={4}
              />
            </div>
          )}
          {fieldType === 'text' && (
            <div className="space-y-2">
              <Label>Placeholder</Label>
              <Input value={placeholder} onChange={e => setPlaceholder(e.target.value)} placeholder="Placeholder text" />
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={required} onCheckedChange={setRequired} />
              <Label>Required</Label>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Label>Sort Order</Label>
              <Input
                type="number"
                className="w-20"
                value={sortOrder}
                onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !label.trim()}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {field ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

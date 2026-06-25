'use client'

import { useState, useEffect } from 'react'
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react'

interface Department {
  id: string; name: string; description: string | null
  code: string | null; isActive: boolean; sortOrder: number
}

export function DepartmentSettings() {
  const { toast } = useToast()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const [sortOrder, setSortOrder] = useState(0)

  const fetch = async () => {
    try {
      const res = await apiGet<{ data: Department[] }>('/departments')
      setDepartments(res.data)
    } catch { toast({ title: 'Error', description: 'Failed to load departments', variant: 'destructive' })
    } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  const reset = () => { setName(''); setDescription(''); setCode(''); setSortOrder(0); setEditing(null) }

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const payload = { name: name.trim(), description: description || null, code: code || null, sortOrder }
      if (editing) {
        await apiPut(`/departments/${editing.id}`, payload)
        toast({ title: 'Department Updated' })
      } else {
        await apiPost('/departments', payload)
        toast({ title: 'Department Created' })
      }
      setDialogOpen(false); reset(); fetch()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to save', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this department?')) return
    try {
      await apiDelete(`/departments/${id}`)
      toast({ title: 'Department Deleted' }); fetch()
    } catch { toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }) }
  }

  const handleToggle = async (dept: Department) => {
    try {
      await apiPut(`/departments/${dept.id}`, { isActive: !dept.isActive })
      fetch()
    } catch { toast({ title: 'Error', description: 'Failed to toggle', variant: 'destructive' }) }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Departments</CardTitle>
          <CardDescription>Manage hospital departments used in visits, queue, and appointments.</CardDescription>
        </div>
        <Button onClick={() => { reset(); setDialogOpen(true) }}>
          <Plus className="mr-2 size-4" />Add Department
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin" /></div>
        ) : departments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No departments configured. Add one to get started.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell><Badge variant="outline">{d.code || '—'}</Badge></TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{d.description || '—'}</TableCell>
                  <TableCell><Switch checked={d.isActive} onCheckedChange={() => handleToggle(d)} /></TableCell>
                  <TableCell>{d.sortOrder}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon"
                        onClick={() => { setEditing(d); setName(d.name); setDescription(d.description || ''); setCode(d.code || ''); setSortOrder(d.sortOrder); setDialogOpen(true) }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
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

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) reset(); setDialogOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Department' : 'Add Department'}</DialogTitle>
            <DialogDescription>Departments are used across the system for visits, queue, and filtering.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cardiology" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. CARD" />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); reset() }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

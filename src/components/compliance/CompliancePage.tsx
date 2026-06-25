'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, type SingleResponse, type PaginatedResponse, ApiError } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
  RefreshCw,
  AlertCircle,
  Search,
  Loader2,
} from 'lucide-react'

interface ComplianceStandard {
  id: string
  standardId: string
  authority: string
  chapter: string
  code: string
  title: string
  description: string | null
  isMandatory: boolean
  createdAt: string
  updatedAt: string
}

interface ChecklistItem {
  id: string
  checklistId: string
  standardId: string
  standardCode: string
  title: string
  description: string | null
  status: 'Pending' | 'In-Progress' | 'Compliant' | 'Non-Compliant' | 'N/A'
  score: number | null
  targetDate: string | null
  evidenceUrl: string | null
  assignedTo: string | null
  createdAt: string
  updatedAt: string
}

interface ComplianceAudit {
  id: string
  auditId: string
  title: string
  auditDate: string
  auditor: string
  department: string
  score: number | null
  status: 'Scheduled' | 'In-Progress' | 'Completed' | 'Closed'
  strengths: string | null
  improvements: string | null
  findings: string | null
  createdAt: string
  updatedAt: string
}

const AUTHORITIES = ['NABH', 'JCI', 'ISO']
const CHAPTERS = ['General', 'Patient Care', 'Facility Management', 'Infection Control', 'Medication Management', 'Emergency Services', 'HR Management', 'Information Management', 'Quality Improvement', 'Safety']
const CHECKLIST_STATUSES = ['Pending', 'In-Progress', 'Compliant', 'Non-Compliant', 'N/A'] as const
const AUDIT_STATUSES = ['Scheduled', 'In-Progress', 'Completed', 'Closed'] as const

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'Pending': return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
    case 'In-Progress': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
    case 'Compliant': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800'
    case 'Non-Compliant': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
    case 'N/A': return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
    case 'Scheduled': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
    case 'Completed': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800'
    case 'Closed': return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
    default: return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
  }
}

function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

function EmptyState({ message, icon: Icon = ClipboardList }: { message: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-3">
      <Icon className="h-12 w-12 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <AlertCircle className="h-12 w-12 text-red-400" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />Retry
      </Button>
    </div>
  )
}

export function CompliancePage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('standards')

  const [standards, setStandards] = useState<ComplianceStandard[]>([])
  const [standardsLoading, setStandardsLoading] = useState(false)
  const [standardsError, setStandardsError] = useState<string | null>(null)
  const [stdFilterAuthority, setStdFilterAuthority] = useState('all')
  const [stdFilterChapter, setStdFilterChapter] = useState('all')
  const [stdAddOpen, setStdAddOpen] = useState(false)
  const [stdForm, setStdForm] = useState({ authority: '', chapter: '', code: '', title: '', description: '', isMandatory: false })
  const [stdSubmitting, setStdSubmitting] = useState(false)

  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [checklistError, setChecklistError] = useState<string | null>(null)
  const [clFilterStandard, setClFilterStandard] = useState('all')
  const [clFilterStatus, setClFilterStatus] = useState('all')
  const [clAddOpen, setClAddOpen] = useState(false)
  const [clForm, setClForm] = useState({ standardId: '', title: '', description: '', targetDate: '' })
  const [clSubmitting, setClSubmitting] = useState(false)

  const [audits, setAudits] = useState<ComplianceAudit[]>([])
  const [auditsLoading, setAuditsLoading] = useState(false)
  const [auditsError, setAuditsError] = useState<string | null>(null)
  const [auditAddOpen, setAuditAddOpen] = useState(false)
  const [auditForm, setAuditForm] = useState({ title: '', auditDate: '', auditor: '', department: '', strengths: '', improvements: '', findings: '' })
  const [auditSubmitting, setAuditSubmitting] = useState(false)
  const [viewAudit, setViewAudit] = useState<ComplianceAudit | null>(null)

  const fetchStandards = useCallback(async (authority: string, chapter: string) => {
    setStandardsLoading(true)
    setStandardsError(null)
    try {
      const params: Record<string, string> = {}
      if (authority !== 'all') params.authority = authority
      if (chapter !== 'all') params.chapter = chapter
      const res = await apiGet<PaginatedResponse<ComplianceStandard>>('/compliance/standards', params)
      setStandards(res.data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load standards'
      setStandardsError(msg)
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setStandardsLoading(false)
    }
  }, [toast])

  const fetchChecklist = useCallback(async (standardId: string, status: string) => {
    setChecklistLoading(true)
    setChecklistError(null)
    try {
      const params: Record<string, string> = {}
      if (standardId !== 'all') params.standardId = standardId
      if (status !== 'all') params.status = status
      const res = await apiGet<PaginatedResponse<ChecklistItem>>('/compliance/checklist', params)
      setChecklist(res.data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load checklist'
      setChecklistError(msg)
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setChecklistLoading(false)
    }
  }, [toast])

  const fetchAudits = useCallback(async () => {
    setAuditsLoading(true)
    setAuditsError(null)
    try {
      const res = await apiGet<PaginatedResponse<ComplianceAudit>>('/compliance/audits')
      setAudits(res.data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load audits'
      setAuditsError(msg)
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setAuditsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (activeTab === 'standards') fetchStandards(stdFilterAuthority, stdFilterChapter)
  }, [activeTab, stdFilterAuthority, stdFilterChapter, fetchStandards])

  useEffect(() => {
    if (activeTab === 'checklist') fetchChecklist(clFilterStandard, clFilterStatus)
  }, [activeTab, clFilterStandard, clFilterStatus, fetchChecklist])

  useEffect(() => {
    if (activeTab === 'audits') fetchAudits()
  }, [activeTab, fetchAudits])

  const handleAddStandard = async () => {
    if (!stdForm.authority || !stdForm.chapter || !stdForm.code || !stdForm.title) {
      toast({ title: 'Validation Error', description: 'Authority, Chapter, Code, and Title are required', variant: 'destructive' })
      return
    }
    setStdSubmitting(true)
    try {
      await apiPost<SingleResponse<ComplianceStandard>>('/compliance/standards', {
        authority: stdForm.authority,
        chapter: stdForm.chapter,
        code: stdForm.code,
        title: stdForm.title,
        description: stdForm.description || null,
        isMandatory: stdForm.isMandatory,
      })
      toast({ title: 'Standard Added', description: 'Compliance standard created successfully' })
      setStdAddOpen(false)
      setStdForm({ authority: '', chapter: '', code: '', title: '', description: '', isMandatory: false })
      fetchStandards(stdFilterAuthority, stdFilterChapter)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to add standard', variant: 'destructive' })
    } finally {
      setStdSubmitting(false)
    }
  }

  const handleAddChecklist = async () => {
    if (!clForm.standardId || !clForm.title) {
      toast({ title: 'Validation Error', description: 'Standard and Title are required', variant: 'destructive' })
      return
    }
    setClSubmitting(true)
    try {
      await apiPost<SingleResponse<ChecklistItem>>('/compliance/checklist', {
        standardId: clForm.standardId,
        title: clForm.title,
        description: clForm.description || null,
        targetDate: clForm.targetDate || null,
      })
      toast({ title: 'Checklist Item Added', description: 'Checklist item created successfully' })
      setClAddOpen(false)
      setClForm({ standardId: '', title: '', description: '', targetDate: '' })
      fetchChecklist(clFilterStandard, clFilterStatus)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to add checklist item', variant: 'destructive' })
    } finally {
      setClSubmitting(false)
    }
  }

  const handleUpdateChecklistStatus = async (item: ChecklistItem, newStatus: string) => {
    try {
      await apiPut<SingleResponse<ChecklistItem>>(`/compliance/checklist/${item.id}`, { status: newStatus })
      toast({ title: 'Status Updated', description: `Checklist item marked as ${newStatus}` })
      fetchChecklist(clFilterStandard, clFilterStatus)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to update status', variant: 'destructive' })
    }
  }

  const handleUpdateEvidence = async (item: ChecklistItem, evidenceUrl: string) => {
    try {
      await apiPut<SingleResponse<ChecklistItem>>(`/compliance/checklist/${item.id}`, { evidenceUrl })
      toast({ title: 'Evidence Updated', description: 'Evidence URL saved successfully' })
      fetchChecklist(clFilterStandard, clFilterStatus)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to save evidence', variant: 'destructive' })
    }
  }

  const handleNewAudit = async () => {
    if (!auditForm.title || !auditForm.auditDate || !auditForm.auditor || !auditForm.department) {
      toast({ title: 'Validation Error', description: 'Title, Date, Auditor, and Department are required', variant: 'destructive' })
      return
    }
    setAuditSubmitting(true)
    try {
      await apiPost<SingleResponse<ComplianceAudit>>('/compliance/audits', {
        title: auditForm.title,
        auditDate: auditForm.auditDate,
        auditor: auditForm.auditor,
        department: auditForm.department,
        strengths: auditForm.strengths || null,
        improvements: auditForm.improvements || null,
        findings: auditForm.findings || null,
      })
      toast({ title: 'Audit Created', description: 'New compliance audit scheduled' })
      setAuditAddOpen(false)
      setAuditForm({ title: '', auditDate: '', auditor: '', department: '', strengths: '', improvements: '', findings: '' })
      fetchAudits()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to create audit', variant: 'destructive' })
    } finally {
      setAuditSubmitting(false)
    }
  }

  const handleDeleteStandard = async (id: string) => {
    try {
      await apiDelete(`/compliance/standards/${id}`)
      toast({ title: 'Standard Deleted', description: 'Compliance standard removed' })
      fetchStandards(stdFilterAuthority, stdFilterChapter)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to delete standard', variant: 'destructive' })
    }
  }

  const handleDeleteChecklist = async (id: string) => {
    try {
      await apiDelete(`/compliance/checklist/${id}`)
      toast({ title: 'Checklist Item Deleted', description: 'Checklist item removed' })
      fetchChecklist(clFilterStandard, clFilterStatus)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to delete checklist item', variant: 'destructive' })
    }
  }

  const handleDeleteAudit = async (id: string) => {
    try {
      await apiDelete(`/compliance/audits/${id}`)
      toast({ title: 'Audit Deleted', description: 'Compliance audit removed' })
      fetchAudits()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to delete audit', variant: 'destructive' })
    }
  }

  const renderStandards = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={stdFilterAuthority} onValueChange={setStdFilterAuthority}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Authority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Authorities</SelectItem>
              {AUTHORITIES.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stdFilterChapter} onValueChange={setStdFilterChapter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Chapter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chapters</SelectItem>
              {CHAPTERS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={stdAddOpen} onOpenChange={setStdAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0">
              <Plus className="mr-2 h-4 w-4" />Add Standard
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Compliance Standard</DialogTitle>
              <DialogDescription>Create a new NABH/JCI/ISO compliance standard</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Authority</Label>
                  <Select value={stdForm.authority} onValueChange={(v) => setStdForm((p) => ({ ...p, authority: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {AUTHORITIES.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chapter</Label>
                  <Select value={stdForm.chapter} onValueChange={(v) => setStdForm((p) => ({ ...p, chapter: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {CHAPTERS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={stdForm.code} onChange={(e) => setStdForm((p) => ({ ...p, code: e.target.value }))} placeholder="e.g. NABH.1.1" />
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={stdForm.title} onChange={(e) => setStdForm((p) => ({ ...p, title: e.target.value }))} placeholder="Standard title" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={stdForm.description} onChange={(e) => setStdForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="mandatory" checked={stdForm.isMandatory} onCheckedChange={(v) => setStdForm((p) => ({ ...p, isMandatory: v === true }))} />
                <Label htmlFor="mandatory" className="cursor-pointer">Mandatory Standard</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStdAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddStandard} disabled={stdSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {stdSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Standard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {standardsLoading ? (
            <div className="p-6"><SkeletonTable rows={5} cols={6} /></div>
          ) : standardsError ? (
            <div className="p-6"><ErrorState message={standardsError} onRetry={() => fetchStandards(stdFilterAuthority, stdFilterChapter)} /></div>
          ) : standards.length === 0 ? (
            <EmptyState message="No compliance standards found" icon={ClipboardList} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Standard ID</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Chapter</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="min-w-[200px]">Title</TableHead>
                  <TableHead>Mandatory</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standards.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-medium">{s.standardId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        s.authority === 'NABH' ? 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300' :
                        s.authority === 'JCI' ? 'border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-300' :
                        'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300'
                      }>
                        {s.authority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{s.chapter}</TableCell>
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell className="text-sm font-medium">{s.title}</TableCell>
                    <TableCell>
                      {s.isMandatory ? (
                        <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-300">Yes</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteStandard(s.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderChecklist = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={clFilterStandard} onValueChange={setClFilterStandard}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Standards</SelectItem>
              {standards.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.code} - {s.title.slice(0, 30)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clFilterStatus} onValueChange={setClFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {CHECKLIST_STATUSES.map((st) => (
                <SelectItem key={st} value={st}>{st}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={clAddOpen} onOpenChange={setClAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0">
              <Plus className="mr-2 h-4 w-4" />Add Checklist Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Checklist Item</DialogTitle>
              <DialogDescription>Create a new compliance checklist item</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Standard</Label>
                <Select value={clForm.standardId} onValueChange={(v) => setClForm((p) => ({ ...p, standardId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select standard" /></SelectTrigger>
                  <SelectContent>
                    {standards.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.code} - {s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={clForm.title} onChange={(e) => setClForm((p) => ({ ...p, title: e.target.value }))} placeholder="Checklist item title" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={clForm.description} onChange={(e) => setClForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
              </div>
              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input type="date" value={clForm.targetDate} onChange={(e) => setClForm((p) => ({ ...p, targetDate: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddChecklist} disabled={clSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {clSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {checklistLoading ? (
            <div className="p-6"><SkeletonTable rows={5} cols={7} /></div>
          ) : checklistError ? (
            <div className="p-6"><ErrorState message={checklistError} onRetry={() => fetchChecklist(clFilterStandard, clFilterStatus)} /></div>
          ) : checklist.length === 0 ? (
            <EmptyState message="No checklist items found" icon={CheckCircle2} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Checklist ID</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead className="min-w-[180px]">Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checklist.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-medium">{item.checklistId}</TableCell>
                    <TableCell className="font-mono text-xs">{item.standardCode}</TableCell>
                    <TableCell className="text-sm font-medium">{item.title}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="p-0 h-auto">
                            <Badge variant="outline" className={statusBadgeClass(item.status)}>{item.status}</Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {CHECKLIST_STATUSES.map((st) => (
                            <DropdownMenuItem key={st} onClick={() => handleUpdateChecklistStatus(item, st)}>
                              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                st === 'Pending' ? 'bg-gray-400' :
                                st === 'In-Progress' ? 'bg-blue-500' :
                                st === 'Compliant' ? 'bg-green-500' :
                                st === 'Non-Compliant' ? 'bg-red-500' : 'bg-slate-400'
                              }`} />
                              {st}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <Progress value={item.score ?? 0} className="h-2 w-16" />
                        <span className="text-xs text-muted-foreground w-8">{item.score ?? '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{item.targetDate || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.status === 'Compliant' && (
                          <div className="flex items-center gap-1">
                            <Input
                              placeholder="Evidence URL"
                              className="h-7 w-[120px] text-xs"
                              defaultValue={item.evidenceUrl || ''}
                              onBlur={(e) => {
                                if (e.target.value !== item.evidenceUrl) handleUpdateEvidence(item, e.target.value)
                              }}
                            />
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteChecklist(item.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const parseFindings = (findings: string | null): string[] => {
    if (!findings) return []
    try {
      const parsed = JSON.parse(findings)
      return Array.isArray(parsed) ? parsed : [findings]
    } catch {
      return findings.split('\n').filter(Boolean)
    }
  }

  const renderAudits = () => (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={auditAddOpen} onOpenChange={setAuditAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <Plus className="mr-2 h-4 w-4" />New Audit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Schedule New Audit</DialogTitle>
              <DialogDescription>Create a compliance audit record</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={auditForm.title} onChange={(e) => setAuditForm((p) => ({ ...p, title: e.target.value }))} placeholder="Audit title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Audit Date</Label>
                  <Input type="date" value={auditForm.auditDate} onChange={(e) => setAuditForm((p) => ({ ...p, auditDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Auditor</Label>
                  <Input value={auditForm.auditor} onChange={(e) => setAuditForm((p) => ({ ...p, auditor: e.target.value }))} placeholder="Auditor name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={auditForm.department} onChange={(e) => setAuditForm((p) => ({ ...p, department: e.target.value }))} placeholder="Department" />
              </div>
              <div className="space-y-2">
                <Label>Strengths</Label>
                <Textarea value={auditForm.strengths} onChange={(e) => setAuditForm((p) => ({ ...p, strengths: e.target.value }))} placeholder="Key strengths identified" />
              </div>
              <div className="space-y-2">
                <Label>Improvements</Label>
                <Textarea value={auditForm.improvements} onChange={(e) => setAuditForm((p) => ({ ...p, improvements: e.target.value }))} placeholder="Areas for improvement" />
              </div>
              <div className="space-y-2">
                <Label>Findings</Label>
                <Textarea value={auditForm.findings} onChange={(e) => setAuditForm((p) => ({ ...p, findings: e.target.value }))} placeholder="JSON array of findings or one per line" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAuditAddOpen(false)}>Cancel</Button>
              <Button onClick={handleNewAudit} disabled={auditSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {auditSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Audit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {auditsLoading ? (
            <div className="p-6"><SkeletonTable rows={5} cols={7} /></div>
          ) : auditsError ? (
            <div className="p-6"><ErrorState message={auditsError} onRetry={fetchAudits} /></div>
          ) : audits.length === 0 ? (
            <EmptyState message="No audits found" icon={FileText} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Audit ID</TableHead>
                  <TableHead className="min-w-[150px]">Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs font-medium">{a.auditId}</TableCell>
                    <TableCell className="text-sm font-medium">{a.title}</TableCell>
                    <TableCell className="text-sm">{a.auditDate}</TableCell>
                    <TableCell className="text-sm">{a.auditor}</TableCell>
                    <TableCell className="text-sm">{a.department}</TableCell>
                    <TableCell>
                      {a.score !== null ? (
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${a.score >= 80 ? 'text-green-600' : a.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {a.score}%
                          </span>
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${a.score >= 80 ? 'bg-green-500' : a.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${a.score}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(a.status)}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setViewAudit(a)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteAudit(a.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewAudit} onOpenChange={(open) => { if (!open) setViewAudit(null) }}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          {viewAudit && (
            <>
              <DialogHeader>
                <DialogTitle>{viewAudit.title}</DialogTitle>
                <DialogDescription>Audit ID: {viewAudit.auditId}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{viewAudit.auditDate}</span></div>
                <div><span className="text-muted-foreground">Auditor:</span> <span className="font-medium">{viewAudit.auditor}</span></div>
                <div><span className="text-muted-foreground">Department:</span> <span className="font-medium">{viewAudit.department}</span></div>
                <div>
                  <span className="text-muted-foreground">Score:</span>{' '}
                  <span className={`font-semibold ${viewAudit.score !== null && viewAudit.score >= 80 ? 'text-green-600' : viewAudit.score !== null && viewAudit.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {viewAudit.score !== null ? `${viewAudit.score}%` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <Badge variant="outline" className={statusBadgeClass(viewAudit.status)}>{viewAudit.status}</Badge>
                </div>
              </div>
              {viewAudit.strengths && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-green-600"><CheckCircle2 className="h-4 w-4" />Strengths</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewAudit.strengths}</p>
                </div>
              )}
              {viewAudit.improvements && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-amber-600"><AlertTriangle className="h-4 w-4" />Areas for Improvement</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewAudit.improvements}</p>
                </div>
              )}
              {viewAudit.findings && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-600"><AlertCircle className="h-4 w-4" />Findings</h4>
                  <ul className="space-y-2">
                    {parseFindings(viewAudit.findings).map((f, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="mt-0.5 inline-block w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          NABH / JCI / ISO compliance standards, checklists, and audit management
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="standards" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Standards</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline">Checklist</span>
          </TabsTrigger>
          <TabsTrigger value="audits" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Audits</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="standards" className="mt-6">{renderStandards()}</TabsContent>
        <TabsContent value="checklist" className="mt-6">{renderChecklist()}</TabsContent>
        <TabsContent value="audits" className="mt-6">{renderAudits()}</TabsContent>
      </Tabs>
    </div>
  )
}

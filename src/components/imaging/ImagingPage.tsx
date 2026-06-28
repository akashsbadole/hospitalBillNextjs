'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, type PaginatedResponse, type SingleResponse } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Scan,
  Microscope,
  FileSearch,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Search as SearchIcon,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react'

const MODALITIES = ['X-Ray', 'MRI', 'CT', 'Ultrasound', 'Mammography', 'PET', 'DEXA', 'Fluoroscopy'] as const
const BODY_PARTS = ['Chest', 'Head', 'Abdomen', 'Spine', 'Pelvis', 'Upper Limb', 'Lower Limb', 'Neck', 'Whole Body'] as const
const STUDY_STATUSES = ['All', 'Ordered', 'Scheduled', 'In-Progress', 'Completed', 'Reviewed', 'Reported'] as const

interface ImagingStudy {
  id: string
  studyId: string
  patientId: string
  doctorId?: string
  visitId?: string
  modality: string
  bodyPart: string
  status: string
  clinicalHistory?: string
  findings?: string
  impression?: string
  technique?: string
  contrastUsed: boolean
  contrastType?: string
  radiologistId?: string
  imagesCount: number
  dicomStudyUid?: string
  accessionNumber?: string
  reportUrl?: string
  imagesUrl?: string
  orderedAt: string
  scheduledAt?: string
  performedAt?: string
  reportedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
  patient: { id: string; patientId: string; name: string; phone: string; gender?: string }
  doctor?: { id: string; doctorId: string; name: string; specialization: string }
  visit?: { id: string; visitId: string; visitType: string; department: string }
}

interface Patient {
  id: string
  patientId: string
  name: string
  phone: string
}

function getModalityIcon(modality: string) {
  switch (modality) {
    case 'X-Ray': return <Scan className="h-5 w-5" />
    case 'MRI': return <Microscope className="h-5 w-5" />
    case 'CT': return <Scan className="h-5 w-5" />
    case 'Ultrasound': return <Microscope className="h-5 w-5" />
    case 'Mammography': return <Scan className="h-5 w-5" />
    case 'PET': return <Microscope className="h-5 w-5" />
    case 'DEXA': return <Scan className="h-5 w-5" />
    case 'Fluoroscopy': return <Scan className="h-5 w-5" />
    default: return <Scan className="h-5 w-5" />
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'Ordered': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    case 'Scheduled': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
    case 'In-Progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 'Completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    case 'Reviewed': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
    case 'Reported': return 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
  }
}

function getModalityBadge(modality: string) {
  switch (modality) {
    case 'X-Ray': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    case 'MRI': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
    case 'CT': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
    case 'Ultrasound': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
    case 'Mammography': return 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'
    case 'PET': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
    case 'DEXA': return 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300'
    case 'Fluoroscopy': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
  }
}

export function ImagingPage() {
  const [activeTab, setActiveTab] = useState('studies')

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="studies">Studies</TabsTrigger>
          <TabsTrigger value="queue">Queue
            <AlertCircle className="h-3.5 w-3.5 ml-1.5 text-amber-500" />
          </TabsTrigger>
        </TabsList>
        <TabsContent value="studies" className="mt-6">
          <StudiesTab />
        </TabsContent>
        <TabsContent value="queue" className="mt-6">
          <QueueTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StudiesTab() {
  const { toast } = useToast()

  const [studies, setStudies] = useState<ImagingStudy[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 10

  const [modalityFilter, setModalityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [patientSearching, setPatientSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [formModality, setFormModality] = useState('')
  const [formBodyPart, setFormBodyPart] = useState('')
  const [formClinicalHistory, setFormClinicalHistory] = useState('')
  const [formContrastUsed, setFormContrastUsed] = useState(false)
  const [formContrastType, setFormContrastType] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const [updateStatus, setUpdateStatus] = useState('')
  const [updateFindings, setUpdateFindings] = useState('')
  const [updateImpression, setUpdateImpression] = useState('')

  const fetchStudies = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = { page, limit }
      if (modalityFilter !== 'all') params.modality = modalityFilter
      if (statusFilter !== 'All') params.status = statusFilter

      const res = await apiGet<PaginatedResponse<ImagingStudy>>('/imaging', params)
      setStudies(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch studies',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [page, modalityFilter, statusFilter, toast])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStudies()
  }, [fetchStudies])

  useEffect(() => {
    if (patientSearch.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPatientResults([])
      return
    }
    const timer = setTimeout(async () => {
      setPatientSearching(true)
      try {
        const res = await apiGet<PaginatedResponse<Patient>>('/patients', { search: patientSearch.trim(), limit: 10 })
        setPatientResults(res.data)
      } catch {
        setPatientResults([])
      } finally {
        setPatientSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [patientSearch])

  const resetAddForm = () => {
    setPatientSearch('')
    setPatientResults([])
    setSelectedPatient(null)
    setFormModality('')
    setFormBodyPart('')
    setFormClinicalHistory('')
    setFormContrastUsed(false)
    setFormContrastType('')
    setFormNotes('')
  }

  const handleAddStudy = async () => {
    if (!selectedPatient || !formModality || !formBodyPart) {
      toast({ title: 'Validation Error', description: 'Patient, modality, and body part are required.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        patientId: selectedPatient.id,
        modality: formModality,
        bodyPart: formBodyPart,
      }
      if (formClinicalHistory.trim()) body.clinicalHistory = formClinicalHistory.trim()
      body.contrastUsed = formContrastUsed
      if (formContrastUsed && formContrastType.trim()) body.contrastType = formContrastType.trim()
      if (formNotes.trim()) body.notes = formNotes.trim()

      await apiPost<SingleResponse<ImagingStudy>>('/imaging', body)
      toast({ title: 'Study Created', description: 'Imaging study has been ordered successfully.' })
      setAddDialogOpen(false)
      resetAddForm()
      fetchStudies()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create study',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openUpdateDialog = (study: ImagingStudy) => {
    setSelectedStudy(study)
    setUpdateStatus(study.status)
    setUpdateFindings(study.findings || '')
    setUpdateImpression(study.impression || '')
    setUpdateDialogOpen(true)
  }

  const handleUpdateStudy = async () => {
    if (!selectedStudy) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {}
      if (updateStatus !== selectedStudy.status) body.status = updateStatus
      if (updateFindings !== (selectedStudy.findings || '')) body.findings = updateFindings
      if (updateImpression !== (selectedStudy.impression || '')) body.impression = updateImpression

      if (Object.keys(body).length === 0) {
        toast({ title: 'No Changes', description: 'No fields were changed.' })
        setSubmitting(false)
        return
      }

      await apiPut<SingleResponse<ImagingStudy>>(`/imaging/${selectedStudy.id}`, body)
      toast({ title: 'Study Updated', description: 'Imaging study has been updated successfully.' })
      setUpdateDialogOpen(false)
      fetchStudies()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update study',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteStudy = async () => {
    if (!selectedStudy) return
    setSubmitting(true)
    try {
      await apiDelete(`/imaging/${selectedStudy.id}`)
      toast({ title: 'Study Deleted', description: 'Imaging study has been deleted.' })
      setDeleteDialogOpen(false)
      fetchStudies()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete study',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const nextStatus = (current: string): string | null => {
    const map: Record<string, string> = {
      Ordered: 'Scheduled',
      Scheduled: 'In-Progress',
      'In-Progress': 'Completed',
      Completed: 'Reviewed',
      Reviewed: 'Reported',
    }
    return map[current] || null
  }

  const handleQuickAdvance = async (study: ImagingStudy) => {
    const next = nextStatus(study.status)
    if (!next) return
    try {
      await apiPut<SingleResponse<ImagingStudy>>(`/imaging/${study.id}`, { status: next })
      toast({ title: 'Status Updated', description: `Study status changed to ${next}.` })
      fetchStudies()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <Scan className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total Studies</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studies.filter(s => s.status === 'Ordered' || s.status === 'Scheduled').length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studies.filter(s => s.status === 'Completed' || s.status === 'Reviewed').length}</p>
              <p className="text-xs text-muted-foreground">Needs Review</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studies.filter(s => s.status === 'Reported').length}</p>
              <p className="text-xs text-muted-foreground">Reported</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search studies..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={modalityFilter} onValueChange={(v) => { setModalityFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Modality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modalities</SelectItem>
                {MODALITIES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STUDY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchStudies}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Study
            </Button>
          </div>
        </div>
      </Card>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Study ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Body Part</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ordered Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : studies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Scan className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No imaging studies found</p>
                  </TableCell>
                </TableRow>
              ) : (
                studies.map((study) => (
                  <TableRow key={study.id}>
                    <TableCell className="font-mono text-xs">{study.studyId}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{study.patient.name}</p>
                        <p className="text-xs text-muted-foreground">{study.patient.patientId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getModalityBadge(study.modality)}>
                        <span className="flex items-center gap-1">
                          {getModalityIcon(study.modality)}
                          {study.modality}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{study.bodyPart}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getStatusBadge(study.status)}>
                        {study.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(study.orderedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedStudy(study); setDetailDialogOpen(true) }} title="View Details">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openUpdateDialog(study)} title="Update">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {nextStatus(study.status) && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleQuickAdvance(study)}>
                            {nextStatus(study.status)}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => { setSelectedStudy(study); setDeleteDialogOpen(true) }} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-44 w-full" /></Card>
          ))
        ) : studies.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Scan className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No imaging studies found</p>
          </Card>
        ) : (
          studies.map((study) => (
            <Card key={study.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    {getModalityIcon(study.modality)}
                  </div>
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{study.studyId}</p>
                    <p className="font-medium">{study.patient.name}</p>
                    <p className="text-sm text-muted-foreground">{study.modality} — {study.bodyPart}</p>
                  </div>
                </div>
                <Badge variant="secondary" className={getStatusBadge(study.status)}>
                  {study.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Ordered</p>
                  <p>{new Date(study.orderedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Patient ID</p>
                  <p className="font-mono text-xs">{study.patient.patientId}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => { setSelectedStudy(study); setDetailDialogOpen(true) }}>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  View
                </Button>
                {nextStatus(study.status) && (
                  <Button size="sm" onClick={() => handleQuickAdvance(study)}>
                    {nextStatus(study.status)}
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {!loading && studies.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} studies)
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetAddForm() }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Imaging Study</DialogTitle>
            <DialogDescription>Create a new radiology/imaging study order.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Patient *</Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between p-2.5 border rounded-lg bg-emerald-50 dark:bg-emerald-950">
                  <div>
                    <p className="font-medium text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPatient.patientId} • {selectedPatient.phone}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedPatient(null); setPatientSearch('') }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search patient..."
                    className="pl-9"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                  {patientSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
              )}
              {patientResults.length > 0 && !selectedPatient && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between border-b last:border-b-0"
                      onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatientResults([]) }}
                    >
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.patientId} • {p.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Modality *</Label>
                <Select value={formModality} onValueChange={setFormModality}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select modality" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALITIES.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Body Part *</Label>
                <Select value={formBodyPart} onValueChange={setFormBodyPart}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select body part" />
                  </SelectTrigger>
                  <SelectContent>
                    {BODY_PARTS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Clinical History</Label>
              <Textarea
                placeholder="Relevant clinical history or indication..."
                value={formClinicalHistory}
                onChange={(e) => setFormClinicalHistory(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="contrastUsed"
                checked={formContrastUsed}
                onChange={(e) => setFormContrastUsed(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="contrastUsed" className="text-sm">Contrast Used</Label>
            </div>

            {formContrastUsed && (
              <div className="space-y-2">
                <Label>Contrast Type</Label>
                <Input
                  placeholder="e.g., Iodinated, Gadolinium, Barium"
                  value={formContrastType}
                  onChange={(e) => setFormContrastType(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddStudy} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Study
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Imaging Study</DialogTitle>
            <DialogDescription>
              {selectedStudy && (
                <>{selectedStudy.studyId} — {selectedStudy.patient.name} ({selectedStudy.modality})</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {['Ordered', 'Scheduled', 'In-Progress', 'Completed', 'Reviewed', 'Reported'].map((s) => {
                    const disabled = selectedStudy ? !canAdvanceTo(selectedStudy.status, s) && s !== selectedStudy.status : s !== 'Ordered'
                    return (
                      <SelectItem key={s} value={s} disabled={disabled}>
                        {s}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {selectedStudy && (
                <p className="text-xs text-muted-foreground">Current: {selectedStudy.status}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Findings</Label>
              <Textarea
                placeholder="Radiologist findings..."
                value={updateFindings}
                onChange={(e) => setUpdateFindings(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Impression / Conclusion</Label>
              <Textarea
                placeholder="Clinical impression..."
                value={updateImpression}
                onChange={(e) => setUpdateImpression(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateStudy} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Study
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Study Details</DialogTitle>
            <DialogDescription>
              {selectedStudy && <>{selectedStudy.studyId} — {selectedStudy.modality} {selectedStudy.bodyPart}</>}
            </DialogDescription>
          </DialogHeader>
          {selectedStudy && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Patient</p>
                  <p className="font-medium">{selectedStudy.patient.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedStudy.patient.patientId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="secondary" className={getStatusBadge(selectedStudy.status)}>
                    {selectedStudy.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Modality</p>
                  <div className="flex items-center gap-2">
                    {getModalityIcon(selectedStudy.modality)}
                    <span className="font-medium">{selectedStudy.modality}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Body Part</p>
                  <p className="font-medium">{selectedStudy.bodyPart}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ordered At</p>
                  <p>{new Date(selectedStudy.orderedAt).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Doctor</p>
                  <p>{selectedStudy.doctor?.name || '—'}</p>
                </div>
                {selectedStudy.contrastUsed && (
                  <div>
                    <p className="text-sm text-muted-foreground">Contrast</p>
                    <p>{selectedStudy.contrastType || 'Used'}</p>
                  </div>
                )}
              </div>

              {selectedStudy.clinicalHistory && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Clinical History</p>
                  <p className="text-sm p-3 bg-muted rounded-lg">{selectedStudy.clinicalHistory}</p>
                </div>
              )}

              {selectedStudy.findings && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Findings</p>
                  <p className="text-sm p-3 bg-muted rounded-lg whitespace-pre-wrap">{selectedStudy.findings}</p>
                </div>
              )}

              {selectedStudy.impression && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Impression</p>
                  <p className="text-sm p-3 bg-muted rounded-lg whitespace-pre-wrap">{selectedStudy.impression}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Imaging Study</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this study? This action cannot be undone.
              {selectedStudy && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedStudy.studyId}</p>
                  <p className="text-sm text-muted-foreground">{selectedStudy.patient.name} — {selectedStudy.modality} {selectedStudy.bodyPart}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteStudy} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function canAdvanceTo(current: string, target: string): boolean {
  const validTransitions: Record<string, string[]> = {
    Ordered: ['Scheduled'],
    Scheduled: ['In-Progress'],
    'In-Progress': ['Completed'],
    Completed: ['Reviewed'],
    Reviewed: ['Reported'],
  }
  return validTransitions[current]?.includes(target) ?? false
}

function QueueTab() {
  const { toast } = useToast()

  const [reviewStudies, setReviewStudies] = useState<ImagingStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [updateFindings, setUpdateFindings] = useState('')
  const [updateImpression, setUpdateImpression] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const [completedRes, reviewedRes] = await Promise.all([
        apiGet<PaginatedResponse<ImagingStudy>>('/imaging', { status: 'Completed', limit: 50 }),
        apiGet<PaginatedResponse<ImagingStudy>>('/imaging', { status: 'Reviewed', limit: 50 }),
      ])
      setReviewStudies([...completedRes.data, ...reviewedRes.data])
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch queue',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQueue()
  }, [fetchQueue])

  const openReviewDialog = (study: ImagingStudy) => {
    setSelectedStudy(study)
    setUpdateFindings(study.findings || '')
    setUpdateImpression(study.impression || '')
    setUpdateDialogOpen(true)
  }

  const handleSubmitReview = async () => {
    if (!selectedStudy) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        findings: updateFindings,
        impression: updateImpression,
        status: selectedStudy.status === 'Completed' ? 'Reviewed' : 'Reported',
      }
      await apiPut<SingleResponse<ImagingStudy>>(`/imaging/${selectedStudy.id}`, body)
      toast({ title: 'Review Submitted', description: 'Study has been updated successfully.' })
      setUpdateDialogOpen(false)
      fetchQueue()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit review',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Pending Review
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchQueue}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : reviewStudies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No studies pending review</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviewStudies.map((study) => (
                <Card key={study.id} className="p-4 border-l-4 border-l-amber-400">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        {getModalityIcon(study.modality)}
                      </div>
                      <div>
                        <p className="font-medium">{study.patient.name}</p>
                        <p className="text-sm text-muted-foreground">{study.modality} — {study.bodyPart}</p>
                        <p className="text-xs text-muted-foreground">{study.studyId}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={getStatusBadge(study.status)}>
                      {study.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Ordered: {new Date(study.orderedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => openReviewDialog(study)}
                  >
                    <FileSearch className="h-3.5 w-3.5 mr-2" />
                    {study.status === 'Completed' ? 'Review & Report' : 'Finalize Report'}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Radiology Report</DialogTitle>
            <DialogDescription>
              {selectedStudy && (
                <>{selectedStudy.patient.name} — {selectedStudy.modality} {selectedStudy.bodyPart} ({selectedStudy.studyId})</>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedStudy && (
            <div className="space-y-4">
              {selectedStudy.clinicalHistory && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Clinical History</p>
                  <p className="text-sm p-3 bg-muted rounded-lg">{selectedStudy.clinicalHistory}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Findings</Label>
                <Textarea
                  placeholder="Describe the radiological findings..."
                  value={updateFindings}
                  onChange={(e) => setUpdateFindings(e.target.value)}
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Impression</Label>
                <Textarea
                  placeholder="Clinical impression / conclusion..."
                  value={updateImpression}
                  onChange={(e) => setUpdateImpression(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitReview} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedStudy?.status === 'Completed' ? 'Review & Advance' : 'Finalize Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

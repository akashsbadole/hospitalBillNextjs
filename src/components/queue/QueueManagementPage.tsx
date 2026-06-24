'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Users,
  Clock,
  SkipForward,
  CheckCheck,
  Phone as PhoneIcon,
  Loader2,
  ArrowRight,
  X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, apiPut, apiDelete, ApiError, type PaginatedResponse, type SingleResponse } from '@/lib/api-client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SPECIALIZATIONS } from '@/lib/constants'

interface Patient {
  id: string
  patientId: string
  name: string
  phone: string
}

interface QueuePatient {
  id: string
  patientId: string
  name: string
  phone: string
  gender?: string | null
  bloodGroup?: string | null
}

interface QueueToken {
  id: string
  tokenId: string
  tokenNumber: number
  department: string
  priority: string
  status: string
  calledAt: string | null
  completedAt: string | null
  callCount: number
  counterNumber: string | null
  issuedAt: string
  patient: QueuePatient
  visit: { id: string; visitId: string; stage: string } | null
}

const PRIORITY_OPTIONS = ['Normal', 'Urgent', 'Emergency', 'VIP'] as const

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  Normal: 'bg-blue-100 text-blue-700 border-blue-200',
  Urgent: 'bg-amber-100 text-amber-700 border-amber-200',
  Emergency: 'bg-red-100 text-red-700 border-red-200',
  VIP: 'bg-purple-100 text-purple-700 border-purple-200',
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  Waiting: 'bg-gray-100 text-gray-600 border-gray-200',
  Called: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'In-Consultation': 'bg-sky-100 text-sky-700 border-sky-200',
  Completed: 'bg-slate-100 text-slate-500 border-slate-200',
  Skipped: 'bg-rose-100 text-rose-600 border-rose-200',
}

function QueueManagementContent() {
  const { toast } = useToast()
  const [tokens, setTokens] = useState<QueueToken[]>([])
  const [loading, setLoading] = useState(true)
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [issueDialogOpen, setIssueDialogOpen] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedPriority, setSelectedPriority] = useState('Normal')
  const [searchPatient, setSearchPatient] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { limit: 100 }
      if (departmentFilter !== 'all') params.department = departmentFilter

      const res = await apiGet<PaginatedResponse<QueueToken>>('/queue', params)
      setTokens(res.data)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }, [departmentFilter, toast])

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 15000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  const fetchPatients = useCallback(async (search: string) => {
    setPatientsLoading(true)
    try {
      const params: Record<string, string | number> = { limit: 20 }
      if (search) params.search = search
      const res = await apiGet<PaginatedResponse<Patient>>('/patients', params)
      setPatients(res.data)
    } catch {
      setPatients([])
    } finally {
      setPatientsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (issueDialogOpen) {
      fetchPatients('')
    }
  }, [issueDialogOpen, fetchPatients])

  const handleSearchPatient = (value: string) => {
    setSearchPatient(value)
    fetchPatients(value)
  }

  const handleIssueToken = async () => {
    if (!selectedPatientId || !selectedDepartment) {
      toast({ title: 'Validation Error', description: 'Please select a patient and department.', variant: 'destructive' })
      return
    }
    setIssuing(true)
    try {
      await apiPost<SingleResponse<QueueToken>>('/queue', {
        patientId: selectedPatientId,
        department: selectedDepartment,
        priority: selectedPriority,
      })
      toast({ title: 'Token Issued', description: 'New queue token has been issued.' })
      setIssueDialogOpen(false)
      setSelectedPatientId('')
      setSelectedDepartment('')
      setSelectedPriority('Normal')
      setSearchPatient('')
      fetchQueue()
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      }
    } finally {
      setIssuing(false)
    }
  }

  const handleAction = async (tokenId: string, action: string) => {
    setActionLoading(tokenId)
    try {
      const statusMap: Record<string, string> = {
        call: 'Called',
        skip: 'Skipped',
        complete: 'Completed',
        recall: 'Called',
      }
      await apiPut<SingleResponse<QueueToken>>(`/queue/${tokenId}`, { status: statusMap[action] })
      toast({ title: 'Updated', description: `Token ${statusMap[action].toLowerCase()}.` })
      fetchQueue()
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Action Failed', description: error.message, variant: 'destructive' })
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (tokenId: string) => {
    setActionLoading(tokenId)
    try {
      await apiDelete(`/queue/${tokenId}`)
      toast({ title: 'Token Removed', description: 'Queue token has been deleted.' })
      fetchQueue()
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' })
      }
    } finally {
      setActionLoading(null)
    }
  }

  const waitingTokens = tokens.filter((t) => t.status === 'Waiting')
  const activeTokens = tokens.filter((t) => t.status === 'Called' || t.status === 'In-Consultation')
  const completedTokens = tokens.filter((t) => t.status === 'Completed' || t.status === 'Skipped')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Queue Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage patient queue, issue tokens, and track consultations
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={departmentFilter}
            onValueChange={(val) => {
              setDepartmentFilter(val)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {SPECIALIZATIONS.map((dept) => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                <Plus className="size-4 mr-2" />
                Issue New Token
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Issue New Queue Token</DialogTitle>
                <DialogDescription>
                  Select a patient and department to issue a new token.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="patient-search">Search Patient</Label>
                  <Input
                    id="patient-search"
                    placeholder="Search by name, ID, or phone..."
                    value={searchPatient}
                    onChange={(e) => handleSearchPatient(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patient">Select Patient</Label>
                  <Select
                    value={selectedPatientId}
                    onValueChange={setSelectedPatientId}
                  >
                    <SelectTrigger id="patient">
                      <SelectValue placeholder="Choose a patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patientsLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="size-4 animate-spin" />
                        </div>
                      ) : patients.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No patients found
                        </div>
                      ) : (
                        patients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.patientId}) - {p.phone}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={selectedDepartment}
                    onValueChange={setSelectedDepartment}
                  >
                    <SelectTrigger id="department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALIZATIONS.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={selectedPriority}
                    onValueChange={setSelectedPriority}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleIssueToken}
                  disabled={issuing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {issuing && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Issue Token
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-xl border shadow-sm py-4">
          <CardContent className="flex items-center gap-4 px-4 py-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 shrink-0">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Waiting</p>
              <p className="text-2xl font-bold text-foreground">{waitingTokens.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm py-4">
          <CardContent className="flex items-center gap-4 px-4 py-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-foreground">{activeTokens.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm py-4">
          <CardContent className="flex items-center gap-4 px-4 py-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
              <CheckCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed Today</p>
              <p className="text-2xl font-bold text-foreground">{completedTokens.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Queue */}
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="size-5 text-emerald-600" />
              Active Queue
              <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                {tokens.length}
              </Badge>
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : tokens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No tokens in the queue.
                  </TableCell>
                </TableRow>
              ) : (
                tokens.map((token) => (
                  <TableRow
                    key={token.id}
                    className={
                      token.status === 'Called' || token.status === 'In-Consultation'
                        ? 'bg-emerald-50/50'
                        : ''
                    }
                  >
                    <TableCell className="font-mono font-bold text-foreground">
                      {String(token.tokenNumber).padStart(2, '0')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold shrink-0">
                          {token.patient.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{token.patient.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <PhoneIcon className="size-3" />
                            {token.patient.phone}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{token.department}</TableCell>
                    <TableCell>
                      <Badge
                        className={`${PRIORITY_BADGE_COLORS[token.priority] || PRIORITY_BADGE_COLORS.Normal}`}
                        variant="outline"
                      >
                        {token.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${STATUS_BADGE_COLORS[token.status] || STATUS_BADGE_COLORS.Waiting}`}
                        variant="outline"
                      >
                        {token.status === 'In-Consultation' ? 'In Consult' : token.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {token.status === 'Waiting' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handleAction(token.id, 'call')}
                              disabled={actionLoading === token.id}
                            >
                              {actionLoading === token.id ? (
                                <Loader2 className="size-3 animate-spin mr-1" />
                              ) : (
                                <ArrowRight className="size-3 mr-1" />
                              )}
                              Call
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-amber-600"
                              onClick={() => handleAction(token.id, 'skip')}
                              disabled={actionLoading === token.id}
                            >
                              <SkipForward className="size-3 mr-1" />
                              Skip
                            </Button>
                          </>
                        )}
                        {token.status === 'Called' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-emerald-600"
                              onClick={() => handleAction(token.id, 'complete')}
                              disabled={actionLoading === token.id}
                            >
                              {actionLoading === token.id ? (
                                <Loader2 className="size-3 animate-spin mr-1" />
                              ) : (
                                <CheckCheck className="size-3 mr-1" />
                              )}
                              Complete
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handleAction(token.id, 'recall')}
                              disabled={actionLoading === token.id}
                            >
                              <ArrowRight className="size-3 mr-1" />
                              Recall
                            </Button>
                          </>
                        )}
                        {token.status === 'In-Consultation' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs text-emerald-600"
                            onClick={() => handleAction(token.id, 'complete')}
                            disabled={actionLoading === token.id}
                          >
                            {actionLoading === token.id ? (
                              <Loader2 className="size-3 animate-spin mr-1" />
                            ) : (
                              <CheckCheck className="size-3 mr-1" />
                            )}
                            Complete
                          </Button>
                        )}
                        {(token.status === 'Completed' || token.status === 'Skipped') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-red-600"
                            onClick={() => handleDelete(token.id)}
                            disabled={actionLoading === token.id}
                          >
                            {actionLoading === token.id ? (
                              <Loader2 className="size-3 animate-spin mr-1" />
                            ) : (
                              <X className="size-3 mr-1" />
                            )}
                            Remove
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function QueueManagementPage() {
  return (
    <ErrorBoundary name="Queue Management">
      <QueueManagementContent />
    </ErrorBoundary>
  )
}

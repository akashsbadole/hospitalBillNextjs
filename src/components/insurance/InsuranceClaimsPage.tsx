'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, type PaginatedResponse, type SingleResponse } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import {
  Card,
  CardContent,
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
  Edit,
  Trash2,
  X,
  FileText,
  RefreshCw,
  Search as SearchIcon,
  Loader2,
  Building2,
  FileCheck,
  FileX,
  Clock,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// ==================== TYPES ====================

interface InsuranceCompany {
  id: string
  companyId: string
  name: string
  type: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  gstin?: string
  status: string
  createdAt: string
  updatedAt: string
  _count?: { claims: number }
}

interface InsuranceClaim {
  id: string
  claimId: string
  patientId: string
  insuranceCompanyId: string
  invoiceId?: string
  policyNumber: string
  claimType: string
  status: string
  approvedAmount: number
  settledAmount: number
  deductionAmount: number
  remarks?: string
  submittedAt: string
  approvedAt?: string
  settledAt?: string
  createdAt: string
  updatedAt: string
  patient: { id: string; patientId: string; name: string; phone: string }
  insuranceCompany: { id: string; companyId: string; name: string; type: string }
  invoice?: { id: string; invoiceNumber: string; grandTotal: number; status: string }
}

interface Patient {
  id: string
  patientId: string
  name: string
  phone: string
}

// ==================== CONSTANTS ====================

const CLAIM_STATUS_OPTIONS = ['All', 'Submitted', 'Pre-Approved', 'Approved', 'Processed', 'Settled', 'Rejected'] as const
const CLAIM_TYPE_OPTIONS = ['Cashless', 'Reimbursement'] as const
const COMPANY_TYPE_OPTIONS = ['TPA', 'Government', 'Private', 'Corporate'] as const

function getClaimStatusBadge(status: string) {
  switch (status) {
    case 'Submitted': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    case 'Pre-Approved': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
    case 'Approved': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    case 'Processed': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 'Settled': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    case 'Rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
  }
}

function getCompanyTypeBadge(type: string) {
  switch (type) {
    case 'TPA': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
    case 'Government': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 'Private': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    case 'Corporate': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
  }
}

// ==================== MAIN COMPONENT ====================

export function InsuranceClaimsPage() {
  useToast()
  const [activeTab, setActiveTab] = useState('claims')

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="companies">Insurance Companies</TabsTrigger>
        </TabsList>
        <TabsContent value="claims" className="mt-6">
          <ClaimsTab />
        </TabsContent>
        <TabsContent value="companies" className="mt-6">
          <CompaniesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ==================== CLAIMS TAB ====================

function ClaimsTab() {
  const { toast } = useToast()

  // Data state
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [companies, setCompanies] = useState<InsuranceCompany[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 10

  // Filters
  const [statusFilter, setStatusFilter] = useState('All')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<InsuranceClaim | null>(null)

  // Loading
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Add Claim form
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [patientSearching, setPatientSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [formCompanyId, setFormCompanyId] = useState('')
  const [formPolicyNumber, setFormPolicyNumber] = useState('')
  const [formClaimType, setFormClaimType] = useState('Cashless')
  const [formRemarks, setFormRemarks] = useState('')

  // Update Status form
  const [updateStatus, setUpdateStatus] = useState('')
  const [updateApprovedAmount, setUpdateApprovedAmount] = useState('')
  const [updateSettledAmount, setUpdateSettledAmount] = useState('')
  const [updateDeductionAmount, setUpdateDeductionAmount] = useState('')
  const [updateRemarks, setUpdateRemarks] = useState('')

  // Stats
  const [stats, setStats] = useState({ total: 0, submitted: 0, approved: 0, settled: 0, rejected: 0 })

  const fetchClaims = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        limit,
      }
      if (statusFilter !== 'All') params.status = statusFilter
      if (companyFilter !== 'all') params.insuranceCompanyId = companyFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const res = await apiGet<PaginatedResponse<InsuranceClaim>>('/insurance/claims', params)
      setClaims(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)

      // Calculate stats from data
      setStats({
        total: res.total,
        submitted: res.data.filter((c) => c.status === 'Submitted').length,
        approved: res.data.filter((c) => ['Approved', 'Pre-Approved', 'Processed'].includes(c.status)).length,
        settled: res.data.filter((c) => c.status === 'Settled').length,
        rejected: res.data.filter((c) => c.status === 'Rejected').length,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch claims',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, companyFilter, searchQuery, toast])

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await apiGet<PaginatedResponse<InsuranceCompany>>('/insurance/companies', { limit: 100, status: 'Active' })
      setCompanies(res.data)
    } catch {
      // silent
    }
  }, [])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchClaims()
  }, [fetchClaims])

    
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCompanies()
  }, [fetchCompanies])

  // Patient search
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

  const handleAddClaim = async () => {
    if (!selectedPatient || !formCompanyId || !formPolicyNumber.trim()) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await apiPost<SingleResponse<InsuranceClaim>>('/insurance/claims', {
        patientId: selectedPatient.id,
        insuranceCompanyId: formCompanyId,
        policyNumber: formPolicyNumber.trim(),
        claimType: formClaimType,
        remarks: formRemarks || undefined,
      })
      toast({ title: 'Claim Created', description: 'Insurance claim has been created successfully.' })
      setAddDialogOpen(false)
      resetAddForm()
      fetchClaims()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create claim',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateStatus = async () => {
    if (!selectedClaim || !updateStatus) {
      toast({ title: 'Validation Error', description: 'Please select a status.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { status: updateStatus }
      if (updateApprovedAmount) body.approvedAmount = parseFloat(updateApprovedAmount)
      if (updateSettledAmount) body.settledAmount = parseFloat(updateSettledAmount)
      if (updateDeductionAmount) body.deductionAmount = parseFloat(updateDeductionAmount)
      if (updateRemarks) body.remarks = updateRemarks

      await apiPut<SingleResponse<InsuranceClaim>>(`/insurance/claims/${selectedClaim.id}`, body)
      toast({ title: 'Claim Updated', description: `Claim status updated to ${updateStatus}.` })
      setStatusDialogOpen(false)
      fetchClaims()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update claim',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openStatusDialog = (claim: InsuranceClaim) => {
    setSelectedClaim(claim)
    setUpdateStatus(claim.status)
    setUpdateApprovedAmount(claim.approvedAmount ? String(claim.approvedAmount) : '')
    setUpdateSettledAmount(claim.settledAmount ? String(claim.settledAmount) : '')
    setUpdateDeductionAmount(claim.deductionAmount ? String(claim.deductionAmount) : '')
    setUpdateRemarks(claim.remarks || '')
    setStatusDialogOpen(true)
  }

  const resetAddForm = () => {
    setPatientSearch('')
    setPatientResults([])
    setSelectedPatient(null)
    setFormCompanyId('')
    setFormPolicyNumber('')
    setFormClaimType('Cashless')
    setFormRemarks('')
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Claims</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.submitted}</p>
              <p className="text-xs text-muted-foreground">Submitted</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.settled}</p>
              <p className="text-xs text-muted-foreground">Settled</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 col-span-2 md:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <FileX className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.rejected}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters + Actions */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search claims..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {CLAIM_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchClaims}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Claim
            </Button>
          </div>
        </div>
      </Card>

      {/* Claims Table (Desktop) */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Policy #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : claims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No claims found</p>
                  </TableCell>
                </TableRow>
              ) : (
                claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-mono text-xs">{claim.claimId}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{claim.patient.name}</p>
                        <p className="text-xs text-muted-foreground">{claim.patient.patientId}</p>
                      </div>
                    </TableCell>
                    <TableCell>{claim.insuranceCompany.name}</TableCell>
                    <TableCell className="font-mono text-xs">{claim.policyNumber}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {claim.claimType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {claim.invoice ? `₹${claim.invoice.grandTotal.toLocaleString('en-IN')}` : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getClaimStatusBadge(claim.status)}>
                        {claim.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(claim.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openStatusDialog(claim)} title="Update Status">
                          <Edit className="h-3.5 w-3.5" />
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

      {/* Claims Cards (Mobile) */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-32 w-full" /></Card>
          ))
        ) : claims.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No claims found</p>
          </Card>
        ) : (
          claims.map((claim) => (
            <Card key={claim.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{claim.claimId}</p>
                  <p className="font-medium">{claim.patient.name}</p>
                </div>
                <Badge variant="secondary" className={getClaimStatusBadge(claim.status)}>
                  {claim.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Company</p>
                  <p className="font-medium">{claim.insuranceCompany.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium">{claim.claimType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Policy #</p>
                  <p className="font-mono text-xs">{claim.policyNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-medium">{claim.invoice ? `₹${claim.invoice.grandTotal.toLocaleString('en-IN')}` : 'N/A'}</p>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <Button variant="outline" size="sm" onClick={() => openStatusDialog(claim)}>
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Update
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && claims.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} claims)
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

      {/* Add Claim Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetAddForm() }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Insurance Claim</DialogTitle>
            <DialogDescription>Submit a new insurance/TPA claim for a patient.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Patient Search */}
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
                    placeholder="Search patient by name or ID..."
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

            {/* Insurance Company */}
            <div className="space-y-2">
              <Label>Insurance Company *</Label>
              <Select value={formCompanyId} onValueChange={setFormCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Policy Number */}
            <div className="space-y-2">
              <Label>Policy Number *</Label>
              <Input
                placeholder="e.g., POL-12345678"
                value={formPolicyNumber}
                onChange={(e) => setFormPolicyNumber(e.target.value)}
              />
            </div>

            {/* Claim Type */}
            <div className="space-y-2">
              <Label>Claim Type</Label>
              <Select value={formClaimType} onValueChange={setFormClaimType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLAIM_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={formRemarks}
                onChange={(e) => setFormRemarks(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddClaim} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Claim Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Claim Status</DialogTitle>
            <DialogDescription>
              {selectedClaim && (
                <>Claim {selectedClaim.claimId} — {selectedClaim.patient.name}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Status */}
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {CLAIM_STATUS_OPTIONS.filter((s) => s !== 'All').map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Approved Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={updateApprovedAmount}
                  onChange={(e) => setUpdateApprovedAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Settled Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={updateSettledAmount}
                  onChange={(e) => setUpdateSettledAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deduction Amount (₹)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={updateDeductionAmount}
                onChange={(e) => setUpdateDeductionAmount(e.target.value)}
              />
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                placeholder="Additional remarks..."
                value={updateRemarks}
                onChange={(e) => setUpdateRemarks(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== COMPANIES TAB ====================

function CompaniesTab() {
  const { toast } = useToast()

  // Data
  const [companies, setCompanies] = useState<InsuranceCompany[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 10

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<InsuranceCompany | null>(null)

  // Loading
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Add Company form
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('TPA')
  const [formContactPerson, setFormContactPerson] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formGstin, setFormGstin] = useState('')

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = { page, limit }
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (typeFilter !== 'all') params.type = typeFilter

      const res = await apiGet<PaginatedResponse<InsuranceCompany>>('/insurance/companies', params)
      setCompanies(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch companies',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery, typeFilter, toast])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCompanies()
  }, [fetchCompanies])

  const resetCompanyForm = () => {
    setFormName('')
    setFormType('TPA')
    setFormContactPerson('')
    setFormPhone('')
    setFormEmail('')
    setFormAddress('')
    setFormGstin('')
  }

  const handleAddCompany = async () => {
    if (!formName.trim()) {
      toast({ title: 'Validation Error', description: 'Company name is required.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { name: formName.trim(), type: formType }
      if (formContactPerson.trim()) body.contactPerson = formContactPerson.trim()
      if (formPhone.trim()) body.phone = formPhone.trim()
      if (formEmail.trim()) body.email = formEmail.trim()
      if (formAddress.trim()) body.address = formAddress.trim()
      if (formGstin.trim()) body.gstin = formGstin.trim()

      await apiPost<SingleResponse<InsuranceCompany>>('/insurance/companies', body)
      toast({ title: 'Company Added', description: `${formName} has been added.` })
      setAddDialogOpen(false)
      resetCompanyForm()
      fetchCompanies()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add company',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openEditDialog = (company: InsuranceCompany) => {
    setSelectedCompany(company)
    setFormName(company.name)
    setFormType(company.type)
    setFormContactPerson(company.contactPerson || '')
    setFormPhone(company.phone || '')
    setFormEmail(company.email || '')
    setFormAddress(company.address || '')
    setFormGstin(company.gstin || '')
    setEditDialogOpen(true)
  }

  const handleEditCompany = async () => {
    if (!selectedCompany || !formName.trim()) {
      toast({ title: 'Validation Error', description: 'Company name is required.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { name: formName.trim(), type: formType }
      if (formContactPerson.trim()) body.contactPerson = formContactPerson.trim()
      if (formPhone.trim()) body.phone = formPhone.trim()
      if (formEmail.trim()) body.email = formEmail.trim()
      if (formAddress.trim()) body.address = formAddress.trim()
      if (formGstin.trim()) body.gstin = formGstin.trim()

      await apiPut<SingleResponse<InsuranceCompany>>(`/insurance/companies/${selectedCompany.id}`, body)
      toast({ title: 'Company Updated', description: `${formName} has been updated.` })
      setEditDialogOpen(false)
      fetchCompanies()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update company',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteDialog = (company: InsuranceCompany) => {
    setSelectedCompany(company)
    setDeleteDialogOpen(true)
  }

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return
    setSubmitting(true)
    try {
      await apiDelete(`/insurance/companies/${selectedCompany.id}`)
      toast({ title: 'Company Deactivated', description: `${selectedCompany.name} has been deactivated.` })
      setDeleteDialogOpen(false)
      fetchCompanies()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to deactivate company',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters + Actions */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {COMPANY_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchCompanies}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </div>
        </div>
      </Card>

      {/* Companies Table (Desktop) */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No insurance companies found</p>
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-mono text-xs">{company.companyId}</TableCell>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getCompanyTypeBadge(company.type)}>
                        {company.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{company.contactPerson || '—'}</TableCell>
                    <TableCell className="text-sm">{company.phone || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{company.gstin || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={company.status === 'Active' ? 'default' : 'secondary'} className={
                        company.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
                      }>
                        {company.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(company)} title="Edit">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => openDeleteDialog(company)} title="Deactivate">
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

      {/* Companies Cards (Mobile) */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-28 w-full" /></Card>
          ))
        ) : companies.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No insurance companies found</p>
          </Card>
        ) : (
          companies.map((company) => (
            <Card key={company.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{company.companyId}</p>
                  <p className="font-medium">{company.name}</p>
                </div>
                <Badge variant="secondary" className={getCompanyTypeBadge(company.type)}>
                  {company.type}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p>{company.contactPerson || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p>{company.phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <Badge variant={company.status === 'Active' ? 'default' : 'secondary'} className={
                  company.status === 'Active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
                }>
                  {company.status}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(company)}>
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600" onClick={() => openDeleteDialog(company)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && companies.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} companies)
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

      {/* Company Form Dialog (Add/Edit) */}
      <Dialog
        open={addDialogOpen || editDialogOpen}
        onOpenChange={(open) => {
          if (open) return
          setAddDialogOpen(false)
          setEditDialogOpen(false)
          resetCompanyForm()
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialogOpen ? 'Edit Insurance Company' : 'Add Insurance Company'}</DialogTitle>
            <DialogDescription>
              {editDialogOpen ? 'Update company details.' : 'Register a new insurance company or TPA.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                placeholder="e.g., Star Health Insurance"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input placeholder="John Doe" value={formContactPerson} onChange={(e) => setFormContactPerson(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="+91 9876543210" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input placeholder="email@company.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea placeholder="Full address" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>GSTIN</Label>
              <Input placeholder="e.g., 29AAACR1234F1Z5" value={formGstin} onChange={(e) => setFormGstin(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); setEditDialogOpen(false); resetCompanyForm() }}>Cancel</Button>
            <Button onClick={editDialogOpen ? handleEditCompany : handleAddCompany} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editDialogOpen ? 'Update' : 'Add'} Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Company</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {selectedCompany?.name}? This will mark it as inactive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCompany} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

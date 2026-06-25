'use client'

import React, { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
} from '@/components/ui/dialog'
import {
  Shield,
  ShieldCheck,
  Plus,
  Eye,
  Trash2,
  Loader2,
  Calendar,
  IndianRupee,
  User,
  Building2,
  Ban,
} from 'lucide-react'

interface InsuranceCompany {
  id: string
  companyId: string
  name: string
  type: string
}

interface InsurancePolicy {
  id: string
  policyId: string
  patientId: string
  companyId: string
  policyNumber: string
  type: string
  coverageAmount: number
  premiumAmount: number
  startDate: string
  endDate: string
  deductible: number
  copayPercent: number
  isActive: boolean
  nomineeName: string | null
  nomineeRelation: string | null
  notes: string | null
  company: InsuranceCompany
}

interface Props {
  patientId: string
  patientName: string
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function InsurancePolicySection({ patientId, patientName }: Props) {
  const { toast } = useToast()
  const [policies, setPolicies] = useState<InsurancePolicy[]>([])
  const [companies, setCompanies] = useState<InsuranceCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [companyId, setCompanyId] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [policyType, setPolicyType] = useState('Individual')
  const [coverageAmount, setCoverageAmount] = useState(0)
  const [premiumAmount, setPremiumAmount] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [deductible, setDeductible] = useState(0)
  const [copayPercent, setCopayPercent] = useState(0)
  const [nomineeName, setNomineeName] = useState('')
  const [nomineeRelation, setNomineeRelation] = useState('')
  const [notes, setNotes] = useState('')

  const fetchPolicies = async () => {
    try {
      const res = await apiGet(`/api/insurance/policies?patientId=${patientId}&limit=20`) as { data: InsurancePolicy[] }
      setPolicies(res.data || [])
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        console.error('[POLICIES_FETCH]', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanies = async () => {
    try {
      const res = await apiGet('/api/insurance/companies?limit=50') as { data: InsuranceCompany[] }
      setCompanies(res.data || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchPolicies()
    fetchCompanies()
  }, [patientId])

  const resetForm = () => {
    setCompanyId('')
    setPolicyNumber('')
    setPolicyType('Individual')
    setCoverageAmount(0)
    setPremiumAmount(0)
    setStartDate('')
    setEndDate('')
    setDeductible(0)
    setCopayPercent(0)
    setNomineeName('')
    setNomineeRelation('')
    setNotes('')
  }

  const handleAdd = async () => {
    if (!companyId || !policyNumber || !startDate || !endDate || coverageAmount <= 0) {
      toast({ title: 'Validation Error', description: 'Company, policy number, dates, and coverage are required.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await apiPost('/api/insurance/policies', {
        patientId,
        companyId,
        policyNumber,
        type: policyType,
        coverageAmount,
        premiumAmount,
        startDate,
        endDate,
        deductible,
        copayPercent,
        nomineeName: nomineeName || undefined,
        nomineeRelation: nomineeRelation || undefined,
        notes: notes || undefined,
      })
      toast({ title: 'Policy Added', description: 'Insurance policy has been added successfully.' })
      setDialogOpen(false)
      resetForm()
      fetchPolicies()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to add policy', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (policyId: string) => {
    try {
      await apiDelete(`/api/insurance/policies/${policyId}`)
      toast({ title: 'Policy Deleted', description: 'Policy has been removed.' })
      fetchPolicies()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' })
    }
  }

  const activePolicies = policies.filter(p => p.isActive)
  const totalCoverage = activePolicies.reduce((sum, p) => sum + p.coverageAmount, 0)

  return (
    <>
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-emerald-600" />
                Insurance Policies
              </CardTitle>
              <CardDescription>
                {loading ? 'Loading...' : `${activePolicies.length} active policy(ies) · ${formatCurrency(totalCoverage)} total coverage`}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
              <Plus className="mr-1 h-4 w-4" />Add Policy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}
          {!loading && policies.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No insurance policies on record. Add one to get started.</p>
          )}
          {!loading && policies.length > 0 && (
            <div className="space-y-3">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className={`rounded-lg border p-4 ${policy.isActive ? 'bg-muted/10' : 'bg-muted/5 opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{policy.policyNumber}</p>
                        <Badge variant="outline" className="text-xs">{policy.type}</Badge>
                        {policy.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <Building2 className="inline h-3 w-3 mr-1" />
                        {policy.company?.name || 'Unknown'} · {policy.company?.type || ''}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                        <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" />Coverage: {formatCurrency(policy.coverageAmount)}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(policy.startDate)} → {formatDate(policy.endDate)}</span>
                        {policy.deductible > 0 && <span>Deductible: {formatCurrency(policy.deductible)}</span>}
                        {policy.copayPercent > 0 && <span>Copay: {policy.copayPercent}%</span>}
                        {policy.nomineeName && <span className="flex items-center gap-1"><User className="h-3 w-3" />{policy.nomineeName} ({policy.nomineeRelation || 'Nominated'})</span>}
                      </div>
                      {policy.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{policy.notes}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600" onClick={() => handleDelete(policy.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              Add Insurance Policy
            </DialogTitle>
            <DialogDescription>Add a new insurance policy for {patientName}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Insurance Company *</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Policy Number *</Label>
              <Input value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="e.g., POL-123456789" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={policyType} onValueChange={setPolicyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Individual', 'Family Floater', 'Group', 'Corporate'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Premium Amount</Label>
                <Input type="number" min={0} value={premiumAmount || ''} onChange={e => setPremiumAmount(Number(e.target.value))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Coverage Amount *</Label>
                <Input type="number" min={0} value={coverageAmount || ''} onChange={e => setCoverageAmount(Number(e.target.value))} placeholder="500000" />
              </div>
              <div className="grid gap-2">
                <Label>Deductible</Label>
                <Input type="number" min={0} value={deductible || ''} onChange={e => setDeductible(Number(e.target.value))} placeholder="10000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Start Date *</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>End Date *</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Copay %</Label>
              <Input type="number" min={0} max={100} value={copayPercent || ''} onChange={e => setCopayPercent(Number(e.target.value))} placeholder="0" />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Nominee Name</Label>
                <Input value={nomineeName} onChange={e => setNomineeName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="grid gap-2">
                <Label>Relation</Label>
                <Input value={nomineeRelation} onChange={e => setNomineeRelation(e.target.value)} placeholder="Spouse, Child..." />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional policy notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Add Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

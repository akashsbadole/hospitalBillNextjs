'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPut, type PaginatedResponse, type SingleResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Droplets,
  Heart,
  Users,
  AlertTriangle,
  Check,
  Plus,
  Search,
  X,
  Loader2,
  CalendarDays,
  Activity,
  Syringe,
  FlaskConical,
  Clock,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const

interface BloodInventoryItem {
  id: string
  bloodGroup: string
  unitsAvailable: number
  minStock: number
  updatedAt: string
}

interface BloodDonor {
  id: string
  donorId: string
  name: string
  phone: string
  email: string | null
  bloodGroup: string
  gender: string | null
  dateOfBirth: string | null
  weight: number | null
  lastDonation: string | null
  totalDonations: number
  status: string
  medicalNotes: string | null
  createdAt: string
}

interface BloodDonation {
  id: string
  donationId: string
  donorId: string
  donationDate: string
  bloodGroup: string
  quantity: number
  hemoglobin: number | null
  bloodBagId: string | null
  status: string
  expiryDate: string | null
  donor: { name: string; donorId: string; bloodGroup: string; phone: string } | null
}

interface BloodRequest {
  id: string
  requestId: string
  patientId: string
  doctorId: string
  bloodGroup: string
  unitsRequired: number
  urgency: string
  reason: string | null
  crossMatchType: string
  status: string
  approvedBy: string | null
  issuedBy: string | null
  issuedAt: string | null
  notes: string | null
  createdAt: string
  patient: { name: string; patientId: string; bloodGroup: string } | null
  doctor: { name: string; doctorId: string; specialization: string } | null
}

function BloodGroupBadge({ group, size = 'sm' }: { group: string; size?: 'sm' | 'lg' }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono font-bold',
        size === 'lg' ? 'text-base px-3 py-1' : 'text-xs px-2',
        group.endsWith('+') ? 'border-red-300 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-300 dark:bg-red-950/50' : 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:bg-blue-950/50'
      )}
    >
      {group}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
    Inactive: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
    Deferred: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
    Pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
    Approved: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300',
    Crossmatched: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
    Issued: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
    'Partially-Issued': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
    Cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
    Donated: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
    Screened: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300',
    Quarantined: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
    Discarded: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
    Used: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
    Normal: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
    Urgent: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
    Emergency: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
  }

  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', styles[status] ?? 'bg-gray-100 text-gray-700')}
    >
      {status}
    </Badge>
  )
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  return <StatusBadge status={urgency} />
}

function InventoryCard({
  item,
  onUpdateStock,
}: {
  item: BloodInventoryItem
  onUpdateStock: (group: string, units: number) => void
}) {
  const isLow = item.unitsAvailable <= item.minStock
  const isCriticallyLow = item.unitsAvailable === 0

  return (
    <Card className={cn(
      'rounded-xl border shadow-sm transition-shadow duration-200',
      isCriticallyLow && 'border-red-300 dark:border-red-800 ring-1 ring-red-200 dark:ring-red-900',
      isLow && !isCriticallyLow && 'border-amber-300 dark:border-amber-800'
    )}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <BloodGroupBadge group={item.bloodGroup} size="lg" />
          {isCriticallyLow ? (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          ) : isLow ? (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          ) : (
            <Droplets className="h-5 w-5 text-emerald-500" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold">{item.unitsAvailable}</p>
          <p className="text-xs text-muted-foreground">Units Available</p>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Min: {item.minStock} units
          </span>
          <span className="text-muted-foreground">
            Updated {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
          </span>
        </div>
        {isLow && (
          <Alert variant="default" className="mt-3 p-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            <AlertTitle className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              {isCriticallyLow ? 'Out of Stock' : 'Low Stock'}
            </AlertTitle>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function AddDonorDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [bloodGroup, setBloodGroup] = useState('')
  const [gender, setGender] = useState('')
  const [weight, setWeight] = useState('')
  const [medicalNotes, setMedicalNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setName('')
    setPhone('')
    setEmail('')
    setBloodGroup('')
    setGender('')
    setWeight('')
    setMedicalNotes('')
  }

  useEffect(() => {
    if (open) resetForm()
  }, [open])

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !bloodGroup) {
      toast({ title: 'Validation Error', description: 'Name, phone, and blood group are required', variant: 'destructive' })
      return
    }
    setIsSubmitting(true)
    try {
      await apiPost('/blood-bank/donors', {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        bloodGroup,
        gender: gender || undefined,
        weight: weight ? parseFloat(weight) : undefined,
        medicalNotes: medicalNotes.trim() || undefined,
      })
      toast({ title: 'Donor Added', description: `${name} has been registered as a donor.` })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Register New Donor
          </DialogTitle>
          <DialogDescription>Add a new blood donor to the registry</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="donor-name">Full Name *</Label>
              <Input id="donor-name" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="donor-phone">Phone *</Label>
              <Input id="donor-phone" placeholder="+91 9876543210" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="donor-email">Email</Label>
              <Input id="donor-email" type="email" placeholder="john@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="donor-blood">Blood Group *</Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger id="donor-blood"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map(bg => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="donor-gender">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="donor-gender"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="donor-weight">Weight (kg)</Label>
              <Input id="donor-weight" type="number" placeholder="65" value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="donor-notes">Medical Notes</Label>
            <Textarea id="donor-notes" placeholder="Any relevant medical history..." value={medicalNotes} onChange={e => setMedicalNotes(e.target.value)} rows={2} className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
            {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Heart className="h-4 w-4 mr-2" />Register Donor</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateRequestDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [bloodGroup, setBloodGroup] = useState('')
  const [unitsRequired, setUnitsRequired] = useState('1')
  const [urgency, setUrgency] = useState('Normal')
  const [reason, setReason] = useState('')
  const [crossMatchType, setCrossMatchType] = useState('Type & Screen')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setPatientId('')
      setDoctorId('')
      setBloodGroup('')
      setUnitsRequired('1')
      setUrgency('Normal')
      setReason('')
      setCrossMatchType('Type & Screen')
      setNotes('')
    }
  }, [open])

  const handleSubmit = async () => {
    if (!patientId.trim() || !doctorId.trim() || !bloodGroup) {
      toast({ title: 'Validation Error', description: 'Patient, doctor, and blood group are required', variant: 'destructive' })
      return
    }
    setIsSubmitting(true)
    try {
      await apiPost('/blood-bank/requests', {
        patientId: patientId.trim(),
        doctorId: doctorId.trim(),
        bloodGroup,
        unitsRequired: parseInt(unitsRequired, 10),
        urgency,
        reason: reason.trim() || undefined,
        crossMatchType,
        notes: notes.trim() || undefined,
      })
      toast({ title: 'Request Created', description: 'Blood request has been submitted.' })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-red-500" />
            New Blood Request
          </DialogTitle>
          <DialogDescription>Create a blood transfusion request</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="req-patient">Patient ID *</Label>
              <Input id="req-patient" placeholder="PAT-0001" value={patientId} onChange={e => setPatientId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-doctor">Doctor ID *</Label>
              <Input id="req-doctor" placeholder="DOC-0001" value={doctorId} onChange={e => setDoctorId(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="req-blood">Blood Group *</Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger id="req-blood"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map(bg => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-units">Units *</Label>
              <Input id="req-units" type="number" min={1} value={unitsRequired} onChange={e => setUnitsRequired(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-urgency">Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger id="req-urgency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="req-crossmatch">Crossmatch Type</Label>
            <Select value={crossMatchType} onValueChange={setCrossMatchType}>
              <SelectTrigger id="req-crossmatch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Type & Screen">Type & Screen</SelectItem>
                <SelectItem value="Type & Crossmatch">Type & Crossmatch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="req-reason">Reason</Label>
            <Input id="req-reason" placeholder="e.g., Surgery, Accident, Anemia" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req-notes">Notes</Label>
            <Textarea id="req-notes" placeholder="Additional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : <><Droplets className="h-4 w-4 mr-2" />Create Request</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RecordDonationDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [donorId, setDonorId] = useState('')
  const [bloodGroup, setBloodGroup] = useState('')
  const [quantity, setQuantity] = useState('350')
  const [hemoglobin, setHemoglobin] = useState('')
  const [bloodBagId, setBloodBagId] = useState('')
  const [status, setStatus] = useState('Donated')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setDonorId('')
      setBloodGroup('')
      setQuantity('350')
      setHemoglobin('')
      setBloodBagId('')
      setStatus('Donated')
    }
  }, [open])

  const handleSubmit = async () => {
    if (!donorId.trim() || !bloodGroup) {
      toast({ title: 'Validation Error', description: 'Donor and blood group are required', variant: 'destructive' })
      return
    }
    setIsSubmitting(true)
    try {
      await apiPost('/blood-bank/donations', {
        donorId: donorId.trim(),
        bloodGroup,
        quantity: parseInt(quantity, 10),
        hemoglobin: hemoglobin ? parseFloat(hemoglobin) : undefined,
        bloodBagId: bloodBagId.trim() || undefined,
        status,
      })
      toast({ title: 'Donation Recorded', description: 'Blood donation has been recorded.' })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-emerald-500" />
            Record Blood Donation
          </DialogTitle>
          <DialogDescription>Record a new blood donation from a registered donor</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dona-donor">Donor ID *</Label>
              <Input id="dona-donor" placeholder="DON-0001" value={donorId} onChange={e => setDonorId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dona-blood">Blood Group *</Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger id="dona-blood"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map(bg => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dona-quantity">Quantity (ml)</Label>
              <Input id="dona-quantity" type="number" min={50} max={500} value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dona-hemoglobin">Hb (g/dL)</Label>
              <Input id="dona-hemoglobin" type="number" step="0.1" placeholder="13.5" value={hemoglobin} onChange={e => setHemoglobin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dona-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="dona-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Donated">Donated</SelectItem>
                  <SelectItem value="Screened">Screened</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dona-bag">Blood Bag ID</Label>
            <Input id="dona-bag" placeholder="BAG-001" value={bloodBagId} onChange={e => setBloodBagId(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
            {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Syringe className="h-4 w-4 mr-2" />Record Donation</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DashboardTab({ inventory }: { inventory: BloodInventoryItem[] }) {
  const totalUnits = inventory.reduce((sum, i) => sum + i.unitsAvailable, 0)
  const lowCount = inventory.filter(i => i.unitsAvailable <= i.minStock).length
  const outOfStock = inventory.filter(i => i.unitsAvailable === 0).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-50 dark:bg-red-950 shrink-0">
                <Droplets className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Units</p>
                <p className="text-xl font-bold">{totalUnits}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 shrink-0">
                <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Blood Groups</p>
                <p className="text-xl font-bold">{BLOOD_GROUPS.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-950 shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Low Stock</p>
                <p className={cn('text-xl font-bold', lowCount > 0 && 'text-amber-600 dark:text-amber-400')}>{lowCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-50 dark:bg-red-950 shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Out of Stock</p>
                <p className={cn('text-xl font-bold', outOfStock > 0 && 'text-red-600 dark:text-red-400')}>{outOfStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {outOfStock > 0 && (
        <Alert variant="default" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-sm font-semibold text-red-700 dark:text-red-300">Critical Stock Alert</AlertTitle>
          <AlertDescription className="text-xs text-red-600/80 dark:text-red-400/80">
            {outOfStock} blood group{outOfStock > 1 ? 's are' : ' is'} completely out of stock. {lowStockMessage(inventory)}
          </AlertDescription>
        </Alert>
      )}

      {lowCount > 0 && outOfStock === 0 && (
        <Alert variant="default" className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm font-semibold text-amber-700 dark:text-amber-300">Low Stock Alert</AlertTitle>
          <AlertDescription className="text-xs text-amber-600/80 dark:text-amber-400/80">
            {lowCount} blood group{lowCount > 1 ? 's have' : ' has'} low inventory levels. Consider contacting donors.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {inventory.map(item => (
          <InventoryCard key={item.id} item={item} onUpdateStock={() => {}} />
        ))}
      </div>
    </div>
  )
}

function lowStockMessage(inventory: BloodInventoryItem[]): string {
  const lowItems = inventory.filter(i => i.unitsAvailable <= i.minStock && i.unitsAvailable > 0)
  if (lowItems.length === 0) return ''
  return `${lowItems.map(i => `${i.bloodGroup} (${i.unitsAvailable} units)`).join(', ')} ${lowItems.length > 1 ? 'are' : 'is'} running low.`
}

function DonorsTab() {
  const { toast } = useToast()
  const [donors, setDonors] = useState<BloodDonor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)

  const fetchDonors = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string | number | boolean | undefined | null> = { limit: 100 }
      if (search) params.search = search
      const res = await apiGet<PaginatedResponse<BloodDonor>>('/blood-bank/donors', params)
      setDonors(res.data ?? [])
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [search, toast])

  useEffect(() => { fetchDonors() }, [fetchDonors])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search donors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />Add Donor
        </Button>
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : donors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Heart className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No donors found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donor ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Blood Group</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Total Donations</TableHead>
                  <TableHead>Last Donation</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donors.map(donor => (
                  <TableRow key={donor.id}>
                    <TableCell className="font-mono text-xs">{donor.donorId}</TableCell>
                    <TableCell className="font-medium">{donor.name}</TableCell>
                    <TableCell><BloodGroupBadge group={donor.bloodGroup} /></TableCell>
                    <TableCell>{donor.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{donor.gender || '-'}</TableCell>
                    <TableCell>{donor.totalDonations}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {donor.lastDonation ? format(new Date(donor.lastDonation), 'MMM d, yyyy') : 'Never'}
                    </TableCell>
                    <TableCell><StatusBadge status={donor.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddDonorDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={fetchDonors} />
    </div>
  )
}

function RequestsTab() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<BloodRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string | number | boolean | undefined | null> = { limit: 100 }
      if (statusFilter) params.status = statusFilter
      const res = await apiGet<PaginatedResponse<BloodRequest>>('/blood-bank/requests', params)
      setRequests(res.data ?? [])
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, toast])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const handleApprove = async (id: string) => {
    try {
      await apiPut(`/blood-bank/requests/${id}`, { status: 'Approved' })
      toast({ title: 'Approved', description: 'Blood request has been approved.' })
      fetchRequests()
    } catch (err) {
      if (err instanceof ApiError) toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const handleIssue = async (id: string) => {
    try {
      await apiPut(`/blood-bank/requests/${id}`, { status: 'Issued' })
      toast({ title: 'Issued', description: 'Blood has been issued.' })
      fetchRequests()
    } catch (err) {
      if (err instanceof ApiError) toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await apiPut(`/blood-bank/requests/${id}`, { status: 'Cancelled' })
      toast({ title: 'Cancelled', description: 'Blood request has been cancelled.' })
      fetchRequests()
    } catch (err) {
      if (err instanceof ApiError) toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const filterTabs = ['', 'Pending', 'Approved', 'Issued', 'Cancelled']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {filterTabs.map(f => (
            <Button
              key={f}
              variant={statusFilter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(f)}
              className={cn(
                'text-xs',
                statusFilter === f && f === '' && 'bg-red-600 hover:bg-red-700',
                statusFilter === f && f === 'Pending' && 'bg-amber-600 hover:bg-amber-700',
                statusFilter === f && f === 'Approved' && 'bg-sky-600 hover:bg-sky-700',
                statusFilter === f && f === 'Issued' && 'bg-emerald-600 hover:bg-emerald-700',
                statusFilter === f && f === 'Cancelled' && 'bg-gray-600 hover:bg-gray-700',
              )}
            >
              {f || 'All'}
            </Button>
          ))}
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />New Request
        </Button>
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Droplets className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No blood requests found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Blood Group</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-xs">{req.requestId}</TableCell>
                    <TableCell className="font-medium">{req.patient?.name || 'Unknown'}</TableCell>
                    <TableCell><BloodGroupBadge group={req.bloodGroup} /></TableCell>
                    <TableCell>{req.unitsRequired}</TableCell>
                    <TableCell><UrgencyBadge urgency={req.urgency} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{req.doctor?.name || '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell><StatusBadge status={req.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {req.status === 'Pending' && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-emerald-600" onClick={() => handleApprove(req.id)}>
                              <Check className="h-3 w-3 mr-1" />Approve
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-600" onClick={() => handleCancel(req.id)}>
                              <X className="h-3 w-3 mr-1" />Cancel
                            </Button>
                          </>
                        )}
                        {req.status === 'Approved' && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-emerald-600" onClick={() => handleIssue(req.id)}>
                            <Check className="h-3 w-3 mr-1" />Issue
                          </Button>
                        )}
                        {(req.status === 'Issued' || req.status === 'Cancelled') && (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateRequestDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onSuccess={fetchRequests} />
    </div>
  )
}

function DonationsTab() {
  const { toast } = useToast()
  const [donations, setDonations] = useState<BloodDonation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showRecordDialog, setShowRecordDialog] = useState(false)

  const fetchDonations = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<BloodDonation>>('/blood-bank/donations', { limit: 100 })
      setDonations(res.data ?? [])
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchDonations() }, [fetchDonations])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{donations.length} donation records</p>
        <Button onClick={() => setShowRecordDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />Record Donation
        </Button>
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : donations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Syringe className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No donations recorded yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donation ID</TableHead>
                  <TableHead>Donor</TableHead>
                  <TableHead>Blood Group</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Hb (g/dL)</TableHead>
                  <TableHead>Bag ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donations.map(dona => (
                  <TableRow key={dona.id}>
                    <TableCell className="font-mono text-xs">{dona.donationId}</TableCell>
                    <TableCell className="font-medium">{dona.donor?.name || 'Unknown'}</TableCell>
                    <TableCell><BloodGroupBadge group={dona.bloodGroup} /></TableCell>
                    <TableCell>{dona.quantity} ml</TableCell>
                    <TableCell>{dona.hemoglobin ?? '-'}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{dona.bloodBagId || '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(dona.donationDate), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell><StatusBadge status={dona.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RecordDonationDialog open={showRecordDialog} onOpenChange={setShowRecordDialog} onSuccess={fetchDonations} />
    </div>
  )
}

export function BloodBankPage() {
  const [inventory, setInventory] = useState<BloodInventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInventory = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiGet<{ data: BloodInventoryItem[]; stats: Record<string, unknown> }>('/blood-bank/inventory')
      setInventory(res.data ?? [])
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Droplets className="h-6 w-6 text-red-500" />
            Blood Bank
          </h1>
          <p className="text-sm text-muted-foreground">Manage blood donors, inventory, requests, and donations</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="donors" className="flex items-center gap-1.5">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Donors</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-1.5">
            <Droplets className="h-4 w-4" />
            <span className="hidden sm:inline">Requests</span>
          </TabsTrigger>
          <TabsTrigger value="donations" className="flex items-center gap-1.5">
            <Syringe className="h-4 w-4" />
            <span className="hidden sm:inline">Donations</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="outline-none">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="rounded-xl border shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-10 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Alert variant="default" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-sm font-semibold text-red-700">Failed to load inventory</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          ) : (
            <DashboardTab inventory={inventory} />
          )}
        </TabsContent>

        <TabsContent value="donors" className="outline-none">
          <DonorsTab />
        </TabsContent>

        <TabsContent value="requests" className="outline-none">
          <RequestsTab />
        </TabsContent>

        <TabsContent value="donations" className="outline-none">
          <DonationsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

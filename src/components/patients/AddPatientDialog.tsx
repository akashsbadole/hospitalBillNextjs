'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiPost, apiPut, ApiError, type SingleResponse } from '@/lib/api-client'
import { createPatientSchema } from '@/lib/validations'
import { BLOOD_GROUPS, GENDER_OPTIONS, INDIAN_STATES, MARITAL_STATUS_OPTIONS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { z } from 'zod'

type PatientFormValues = z.infer<typeof createPatientSchema>

interface Patient {
  id: string
  patientId: string
  name: string
  phone: string
  email?: string | null
  gender?: string | null
  bloodGroup?: string | null
  dateOfBirth?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  aadhaarNumber?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
  allergies?: string[] | null
  pastTreatments?: string[] | null
  insuranceProvider?: string | null
  insuranceNumber?: string | null
  maritalStatus?: string | null
  occupation?: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface AddPatientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient?: Patient
  onSuccess: () => void
}

export function AddPatientDialog({ open, onOpenChange, patient, onSuccess }: AddPatientDialogProps) {
  const isEditing = !!patient
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      dateOfBirth: '',
      gender: undefined,
      bloodGroup: undefined,
      address: '',
      city: '',
      state: '',
      pincode: '',
      aadhaarNumber: '',
      emergencyContact: '',
      emergencyPhone: '',
      insuranceProvider: '',
      insuranceNumber: '',
      allergies: [],
      pastTreatments: [],
      maritalStatus: undefined,
      occupation: '',
    },
  })

  useEffect(() => {
    if (open && patient) {
      form.reset({
        name: patient.name,
        phone: patient.phone,
        email: patient.email || '',
        dateOfBirth: patient.dateOfBirth || '',
        gender: (patient.gender as 'Male' | 'Female' | 'Other') || undefined,
        bloodGroup: (patient.bloodGroup as typeof BLOOD_GROUPS[number]) || undefined,
        address: patient.address || '',
        city: patient.city || '',
        state: patient.state || '',
        pincode: patient.pincode || '',
        aadhaarNumber: patient.aadhaarNumber || '',
        emergencyContact: patient.emergencyContact || '',
        emergencyPhone: patient.emergencyPhone || '',
        insuranceProvider: patient.insuranceProvider || '',
        insuranceNumber: patient.insuranceNumber || '',
        allergies: patient.allergies || [],
        pastTreatments: patient.pastTreatments || [],
        maritalStatus: (patient.maritalStatus as typeof MARITAL_STATUS_OPTIONS[number]) || undefined,
        occupation: patient.occupation || '',
      })
    } else if (open && !patient) {
      form.reset({
        name: '',
        phone: '',
        email: '',
        dateOfBirth: '',
        gender: undefined,
        bloodGroup: undefined,
        address: '',
        city: '',
        state: '',
        pincode: '',
        aadhaarNumber: '',
        emergencyContact: '',
        emergencyPhone: '',
        insuranceProvider: '',
        insuranceNumber: '',
        allergies: [],
        pastTreatments: [],
        maritalStatus: undefined,
        occupation: '',
      })
    }
  }, [open, patient, form])

  const handleSubmit = async (data: PatientFormValues) => {
    setSubmitting(true)
    try {
      const payload = {
        ...data,
        email: data.email || undefined,
        gender: data.gender || undefined,
        bloodGroup: data.bloodGroup || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        pincode: data.pincode || undefined,
        aadhaarNumber: data.aadhaarNumber || undefined,
        emergencyContact: data.emergencyContact || undefined,
        emergencyPhone: data.emergencyPhone || undefined,
        insuranceProvider: data.insuranceProvider || undefined,
        insuranceNumber: data.insuranceNumber || undefined,
        allergies: data.allergies && data.allergies.length > 0 ? data.allergies : undefined,
        pastTreatments: data.pastTreatments && data.pastTreatments.length > 0 ? data.pastTreatments : undefined,
        maritalStatus: data.maritalStatus || undefined,
        occupation: data.occupation || undefined,
      }

      if (isEditing && patient) {
        await apiPut<SingleResponse<Patient>>(`/patients/${patient.id}`, payload)
        toast({ title: 'Patient Updated', description: `${data.name}'s details have been updated.` })
      } else {
        await apiPost<SingleResponse<Patient>>('/patients', payload)
        toast({ title: 'Patient Added', description: `${data.name} has been registered successfully.` })
      }
      onSuccess()
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Error', description: isEditing ? 'Failed to update patient' : 'Failed to add patient', variant: 'destructive' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">
            {isEditing ? 'Edit Patient' : 'Add New Patient'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update patient information below.'
              : 'Fill in the details to register a new patient.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-10rem)] px-6">
          <Form {...form}>
            <form
              id="patient-form"
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-5 pb-2"
            >
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Full Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter patient name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Phone Number <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="+91 98765 43210" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="patient@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GENDER_OPTIONS.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bloodGroup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Blood Group</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select blood group" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BLOOD_GROUPS.map((bg) => (
                              <SelectItem key={bg} value={bg}>
                                {bg}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maritalStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marital Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MARITAL_STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="occupation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Occupation</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Engineer, Teacher, Retired" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Address */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Address
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="House/Flat No., Street Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60">
                            {INDIAN_STATES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pincode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pincode</FormLabel>
                        <FormControl>
                          <Input placeholder="6-digit pincode" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Identity & Emergency */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Identity & Emergency Contact
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="aadhaarNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aadhaar Number</FormLabel>
                        <FormControl>
                          <Input placeholder="1234 5678 9012" {...field} />
                        </FormControl>
                        <FormDescription>12-digit Aadhaar number (optional)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emergencyContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Contact Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Contact person name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emergencyPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Contact Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 98765 43210" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Insurance */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Insurance Details
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="insuranceProvider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance Provider</FormLabel>
                        <FormControl>
                          <Input placeholder="Insurance company name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="insuranceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Policy Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Policy/Insurance number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Medical & Notes */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Medical Information
                </h3>
                <FormField
                  control={form.control}
                  name="allergies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allergies</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter known allergies separated by commas (e.g., Penicillin, Sulfa drugs, Latex)"
                          className="min-h-20"
                          value={field.value?.join(', ') || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            field.onChange(val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [])
                          }}
                        />
                      </FormControl>
                      <FormDescription>Comma-separated list of known allergies</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pastTreatments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Past Treatments</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter past treatments separated by commas (e.g., Appendectomy, Knee Surgery)"
                          className="min-h-20"
                          value={field.value?.join(', ') || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            field.onChange(val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [])
                          }}
                        />
                      </FormControl>
                      <FormDescription>Comma-separated list of past medical treatments/procedures</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-2 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="patient-form"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={submitting}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {isEditing ? 'Update Patient' : 'Add Patient'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

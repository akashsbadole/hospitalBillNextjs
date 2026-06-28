'use client'

import React, { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiPost, ApiError, type SingleResponse } from '@/lib/api-client'
import { SPECIALIZATIONS } from '@/lib/constants'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

// ==================== SCHEMA ====================

const doctorSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  phone: z.string().trim().min(10, 'Enter a valid phone number'),
  email: z.string().email('Enter a valid email address').optional().or(z.literal('')),
  specialization: z.string().trim().min(1, 'Select a specialization'),
  qualification: z.string().trim().min(2, 'Enter qualification details'),
  experience: z.coerce.number().min(0, 'Experience must be 0 or more').max(60, 'Experience seems too high'),
  consultationFee: z.coerce.number().min(0, 'Fee must be 0 or more'),
  bio: z.string().optional(),
})

type DoctorFormValues = z.infer<typeof doctorSchema>

// ==================== PROPS ====================

interface AddDoctorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// ==================== COMPONENT ====================

export function AddDoctorDialog({ open, onOpenChange, onSuccess }: AddDoctorDialogProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorSchema) as Resolver<DoctorFormValues>,
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      specialization: '',
      qualification: '',
      experience: 0,
      consultationFee: 0,
      bio: '',
    },
  })

  const resetForm = () => {
    form.reset({
      name: '',
      phone: '',
      email: '',
      specialization: '',
      qualification: '',
      experience: 0,
      consultationFee: 0,
      bio: '',
    })
  }

  async function onSubmit(data: DoctorFormValues) {
    setSubmitting(true)
    try {
      const payload = {
        ...data,
        email: data.email || undefined,
        bio: data.bio || undefined,
      }
      await apiPost<SingleResponse<{ id: string }>>('/doctors', payload)
      toast({ title: 'Doctor Added', description: `${data.name} has been registered successfully.` })
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Error', description: 'Failed to add doctor', variant: 'destructive' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm()
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100">
              <svg className="size-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </span>
            Add New Doctor
          </DialogTitle>
          <DialogDescription>
            Fill in the details below to register a new doctor in the system.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Full Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Phone <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="+91 98765 43210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="doctor@hospital.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Specialization */}
              <FormField
                control={form.control}
                name="specialization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Specialization <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select specialization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPECIALIZATIONS.map((spec) => (
                          <SelectItem key={spec} value={spec}>
                            {spec}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Qualification */}
              <FormField
                control={form.control}
                name="qualification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Qualification <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="MBBS, MD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Experience */}
              <FormField
                control={form.control}
                name="experience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Experience (years) <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={60} placeholder="0" {...field} />
                    </FormControl>
                    <FormDescription>Years of medical practice</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Consultation Fee */}
              <FormField
                control={form.control}
                name="consultationFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Consultation Fee (₹) <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                        <Input type="number" min={0} placeholder="0" className="pl-7" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Bio */}
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Brief professional bio..." className="min-h-[80px] resize-none" {...field} />
                  </FormControl>
                  <FormDescription>A brief description of the doctor&apos;s expertise</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm()
                  onOpenChange(false)
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={submitting}>
                {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                Add Doctor
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

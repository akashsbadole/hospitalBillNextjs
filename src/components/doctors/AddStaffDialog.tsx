'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiPost, ApiError, type SingleResponse } from '@/lib/api-client'
import { STAFF_ROLES } from '@/lib/constants'
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

const staffSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  phone: z.string().trim().min(10, 'Enter a valid phone number'),
  email: z.string().email('Enter a valid email address').optional().or(z.literal('')),
  role: z.string().min(1, 'Select a role'),
})

type StaffFormValues = z.infer<typeof staffSchema>

// ==================== PROPS ====================

interface AddStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// ==================== COMPONENT ====================

export function AddStaffDialog({ open, onOpenChange, onSuccess }: AddStaffDialogProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      role: '',
    },
  })

  const resetForm = () => {
    form.reset({
      name: '',
      phone: '',
      email: '',
      role: '',
    })
  }

  async function onSubmit(data: StaffFormValues) {
    setSubmitting(true)
    try {
      const payload = {
        ...data,
        email: data.email || undefined,
      }
      await apiPost<SingleResponse<{ id: string }>>('/staff', payload)
      toast({ title: 'Staff Added', description: `${data.name} has been added successfully.` })
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Error', description: 'Failed to add staff member', variant: 'destructive' })
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
      <DialogContent className="sm:max-w-[500px]">
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
            Add New Staff Member
          </DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new staff member to the system.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <Input placeholder="Full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      <Input placeholder="+91 98765 50001" {...field} />
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
                    <FormLabel>
                      Email <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="staff@hospital.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Role */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Role <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STAFF_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Select the staff member&apos;s designated role</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
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
                Add Staff
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

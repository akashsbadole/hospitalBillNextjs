'use client'

import { useBillingStore } from '@/stores/billing'
import { formatCurrency, calculateGST } from '@/lib/utils'
import { QUICK_SERVICES, GST_SLABS } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Trash2,
  Zap,
  User,
  ShoppingCart,
  FileText,
  Search,
  X,
  Loader2,
  Percent,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'

const ITEM_TYPES = ['Service', 'Medicine', 'Lab Test', 'Room Charge', 'Package']

export function CreateInvoiceDialog() {
  const { toast } = useToast()

  // All state from billing store
  const {
    createForm,
    closeCreateDialog,
    setPatientSearch,
    selectPatient,
    setPatientPopoverOpen,
    addFormItem,
    updateFormItem,
    removeFormItem,
    addQuickService,
    updateFormField,
    getGstCalculation,
    submitInvoice,
    resetCreateForm,
  } = useBillingStore()

  const {
    dialogOpen,
    patientSearch,
    selectedPatient,
    patientPopoverOpen,
    patientResults,
    patientLoading,
    items,
    discount,
    discountType,
    roundOff,
    dueDate,
    notes,
    isInterstate,
    submitting,
    formErrors,
  } = createForm

  // GST calculations from store
  const calculations = getGstCalculation()

  const isDisabled = !selectedPatient || submitting

  const handleSubmit = async () => {
    const patientName = selectedPatient?.name
    const success = await submitInvoice()
    if (success) {
      toast({
        title: 'Invoice Created',
        description: `Invoice created successfully for ${patientName}`,
      })
    } else {
      const { formErrors: latestErrors } = useBillingStore.getState().createForm
      const firstError = Object.values(latestErrors)[0]
      if (firstError) {
        toast({ title: 'Error', description: firstError as string, variant: 'destructive' })
      }
    }
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(v) => {
        if (!v) closeCreateDialog()
      }}
    >
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Create New Invoice
          </DialogTitle>
          <DialogDescription>
            Create a GST-compliant invoice with itemized billing and tax breakdown.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-180px)]">
          <div className="px-6 py-4 space-y-6">
            {/* Patient Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Patient
              </Label>
              {selectedPatient ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedPatient.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedPatient.patientId} &middot; {selectedPatient.phone}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      selectPatient(null)
                      setPatientSearch('')
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Popover open={patientPopoverOpen} onOpenChange={setPatientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={patientPopoverOpen}
                      className="w-full justify-start text-muted-foreground font-normal"
                    >
                      <Search className="mr-2 h-4 w-4" />
                      Search patient by name, ID, or phone...
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search patients..."
                        value={patientSearch}
                        onValueChange={setPatientSearch}
                      />
                      <CommandList>
                        {patientLoading ? (
                          <div className="p-4 space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-3/4" />
                            <Skeleton className="h-8 w-5/6" />
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>No patient found.</CommandEmpty>
                            <CommandGroup className="max-h-64 overflow-y-auto">
                              {patientResults.map((patient) => (
                                <CommandItem
                                  key={patient.id}
                                  value={patient.id}
                                  onSelect={() => {
                                    selectPatient(patient)
                                    setPatientPopoverOpen(false)
                                  }}
                                >
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold mr-2 shrink-0">
                                    {patient.name.charAt(0)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{patient.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {patient.patientId} &middot; {patient.phone}
                                    </p>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Quick Add Items */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Quick Add Services
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SERVICES.map((service, index) => (
                  <Button
                    key={service.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-normal"
                    onClick={() => addQuickService(index)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {service.name} ({formatCurrency(service.price)})
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  Invoice Items ({items.length})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFormItem}
                  className="h-7"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const lineBase = item.unitPrice * item.quantity
                  const lineGst = calculateGST(lineBase, item.gstRate, isInterstate)
                  const lineTotal = lineGst.grandTotal

                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border bg-muted/20 p-3 space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground mt-0.5">
                          {index + 1}
                        </span>
                        <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {/* Description */}
                          <div className="sm:col-span-2">
                            <Input
                              placeholder="Item description *"
                              value={item.description}
                              onChange={(e) => updateFormItem(item.id, 'description', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>

                          {/* Type & HSN */}
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={item.type}
                              onValueChange={(v) => updateFormItem(item.id, 'type', v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ITEM_TYPES.map((t) => (
                                  <SelectItem key={t} value={t} className="text-xs">
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="HSN"
                              value={item.hsnCode}
                              onChange={(e) => updateFormItem(item.id, 'hsnCode', e.target.value)}
                              className="h-8 text-xs font-mono"
                            />
                          </div>

                          {/* Qty, Unit Price, GST Rate */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="relative">
                              <Input
                                type="number"
                                placeholder="Qty"
                                value={item.quantity || ''}
                                onChange={(e) =>
                                  updateFormItem(item.id, 'quantity', parseInt(e.target.value) || 0)
                                }
                                className="h-8 text-xs pr-7"
                                min={1}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                qty
                              </span>
                            </div>
                            <div className="relative">
                              <Input
                                type="number"
                                placeholder="Price"
                                value={item.unitPrice || ''}
                                onChange={(e) =>
                                  updateFormItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                                }
                                className="h-8 text-xs pr-7"
                                min={0}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                ₹
                              </span>
                            </div>
                            <Select
                              value={String(item.gstRate)}
                              onValueChange={(v) => updateFormItem(item.id, 'gstRate', parseInt(v))}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {GST_SLABS.map((rate) => (
                                  <SelectItem key={rate} value={String(rate)} className="text-xs font-mono">
                                    {rate}%
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Remove */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600"
                          onClick={() => removeFormItem(item.id)}
                          disabled={items.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Line Total */}
                      <div className="flex items-center justify-end gap-4 text-xs text-muted-foreground pl-8">
                        <span>Base: {formatCurrency(lineBase)}</span>
                        {item.gstRate > 0 && (
                          <span className="font-mono">
                            GST ({item.gstRate}%): {formatCurrency(lineGst.totalGst)}
                          </span>
                        )}
                        <span className="font-semibold text-foreground text-sm font-mono">
                          Total: {formatCurrency(lineTotal)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* GST Type, Due Date, Discount, Round-Off */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* GST Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  GST Type
                </Label>
                <Select value={isInterstate ? 'interstate' : 'intrastate'} onValueChange={(v) => updateFormField('isInterstate', v === 'interstate')}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intrastate">CGST + SGST</SelectItem>
                    <SelectItem value="interstate">IGST</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Due Date
                </Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => updateFormField('dueDate', e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Discount */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Discount
                </Label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      placeholder={discountType === 'percentage' ? '0' : '0.00'}
                      value={discount || ''}
                      onChange={(e) => updateFormField('discount', parseFloat(e.target.value) || 0)}
                      className="h-9 pr-8"
                      min={0}
                      max={discountType === 'percentage' ? 100 : undefined}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                      {discountType === 'percentage' ? '%' : '₹'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant={discountType === 'percentage' ? 'default' : 'outline'}
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => updateFormField('discountType', discountType === 'flat' ? 'percentage' : 'flat')}
                    title={discountType === 'flat' ? 'Switch to percentage' : 'Switch to flat amount'}
                  >
                    <Percent className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {formErrors.discount && (
                  <p className="text-xs text-red-600">{formErrors.discount}</p>
                )}
              </div>

              {/* Round Off */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Round Off
                </Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch
                    checked={roundOff}
                    onCheckedChange={(v) => updateFormField('roundOff', v)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {roundOff
                      ? calculations.roundOff >= 0
                        ? `+${formatCurrency(calculations.roundOff)}`
                        : formatCurrency(calculations.roundOff)
                      : 'Off'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes (Optional)
              </Label>
              <Textarea
                placeholder="Add any notes or remarks..."
                value={notes}
                onChange={(e) => updateFormField('notes', e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>

            <Separator />

            {/* GST Summary */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Tax Summary
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Breakdown */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">{formatCurrency(calculations.subtotal)}</span>
                  </div>
                  {isInterstate ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IGST</span>
                      <span className="font-mono">{formatCurrency(calculations.igst)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CGST</span>
                        <span className="font-mono">{formatCurrency(calculations.cgst)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SGST</span>
                        <span className="font-mono">{formatCurrency(calculations.sgst)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-medium">
                    <span>Total GST</span>
                    <span className="font-mono">{formatCurrency(calculations.totalGst)}</span>
                  </div>
                  {calculations.effectiveDiscount > 0 && (
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>
                        Discount
                        {calculations.discountType === 'percentage' && (
                          <span className="text-xs ml-1">({discount}%)</span>
                        )}
                      </span>
                      <span className="font-mono">- {formatCurrency(calculations.effectiveDiscount)}</span>
                    </div>
                  )}
                  {calculations.roundOff !== 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Round Off</span>
                      <span className="font-mono">
                        {calculations.roundOff > 0 ? '+' : ''}{formatCurrency(calculations.roundOff)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Grand Total */}
                <div className="flex flex-col items-end justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Grand Total
                  </p>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-1">
                    {formatCurrency(calculations.grandTotal)}
                  </p>
                  {calculations.totalGst > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Incl. GST of {formatCurrency(calculations.totalGst)}
                      {isInterstate ? ' (IGST)' : ' (CGST+SGST)'}
                    </p>
                  )}
                  {calculations.effectiveDiscount > 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                      Saved {formatCurrency(calculations.effectiveDiscount)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <DialogFooter className="flex items-center justify-end gap-2 border-t px-6 py-3 shrink-0 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={resetCreateForm}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isDisabled || items.every((i) => !i.description) || calculations.subtotal === 0 || submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {submitting ? 'Creating...' : 'Create Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
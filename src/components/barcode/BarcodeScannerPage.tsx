'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPost } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScanLine, Package, User, Receipt, History, ExternalLink, Loader2, AlertCircle } from 'lucide-react'

interface BarcodeLookupResult {
  found: boolean
  entityType: string | null
  entityId: string | null
  displayId: string | null
  displayName: string | null
  details: Record<string, unknown> | null
}

interface ScanRecord {
  id: string
  scanId: string
  barcode: string
  entityType: string
  entityId: string
  location: string | null
  scannedAt: string
  user: { name: string; email: string } | null
}

const entityIcons: Record<string, React.ReactNode> = {
  Medicine: <Package className="h-4 w-4" />,
  Patient: <User className="h-4 w-4" />,
  Invoice: <Receipt className="h-4 w-4" />,
}

const entityColors: Record<string, string> = {
  Medicine: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  Patient: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  Invoice: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
}

export default function BarcodeScannerPage() {
  const [barcode, setBarcode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [lookupResult, setLookupResult] = useState<BarcodeLookupResult | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await apiGet<{ data: ScanRecord[] }>('/barcode/scan/history')
      setScanHistory(res.data)
    } catch {
      // Silently fail for history
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleLookup = useCallback(async (code: string) => {
    if (!code.trim()) return
    setScanning(true)
    setError(null)
    setLookupResult(null)
    try {
      const result = await apiGet<BarcodeLookupResult>('/barcode/lookup', { code: code.trim() })
      setLookupResult(result)

      if (result.found && result.entityType && result.entityId) {
        await apiPost('/barcode/scan', {
          barcode: code.trim(),
          entityType: result.entityType,
          entityId: result.entityId,
          location: 'Manual Entry',
        })
        fetchHistory()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setScanning(false)
    }
  }, [fetchHistory])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleLookup(barcode)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value)
  }

  const getStockBadge = (stock: number, minStock: number) => {
    if (stock <= 0) return <Badge variant="destructive">Out of Stock</Badge>
    if (stock <= minStock) return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">Low Stock ({stock})</Badge>
    return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">In Stock ({stock})</Badge>
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid': return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">Paid</Badge>
      case 'Unpaid': return <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300">Unpaid</Badge>
      case 'Partially Paid': return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">Partially Paid</Badge>
      case 'Overdue': return <Badge variant="destructive">Overdue</Badge>
      case 'Active': return <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">Active</Badge>
      case 'Inactive': return <Badge variant="secondary">Inactive</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Barcode Scanner</h1>
          <p className="text-sm text-muted-foreground">Scan barcodes to look up medicines, patients, and invoices</p>
        </div>
        <ScanLine className="h-8 w-8 text-muted-foreground" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Scan Barcode
          </CardTitle>
          <CardDescription>Enter or scan a barcode to look up the associated entity</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={barcode}
                onChange={handleInputChange}
                placeholder="Enter or scan barcode..."
                className="pl-10 text-lg h-12"
                autoFocus
                disabled={scanning}
              />
            </div>
            <Button type="submit" size="lg" disabled={!barcode.trim() || scanning} className="h-12 min-w-[100px]">
              {scanning ? <Loader2 className="h-5 w-5 animate-spin mr-1" /> : <ScanLine className="h-5 w-5 mr-1" />}
              Lookup
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {lookupResult && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lookupResult.found && lookupResult.entityType ? (
                  <>
                    {entityIcons[lookupResult.entityType]}
                    <CardTitle className="text-lg">{lookupResult.entityType}</CardTitle>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Not Found</CardTitle>
                  </>
                )}
              </div>
              {lookupResult.found && lookupResult.entityType && (
                <Badge className={entityColors[lookupResult.entityType]}>
                  {lookupResult.displayId}
                </Badge>
              )}
            </div>
            {lookupResult.found && (
              <CardDescription className="text-base font-medium text-foreground">
                {lookupResult.displayName}
              </CardDescription>
            )}
          </CardHeader>
          {lookupResult.found && lookupResult.entityType && lookupResult.details && (
            <CardContent>
              <Separator className="mb-4" />
              {lookupResult.entityType === 'Medicine' && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium">{String(lookupResult.details.category || '-')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Manufacturer</span>
                    <p className="font-medium">{String(lookupResult.details.manufacturer || '-')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Batch</span>
                    <p className="font-medium">{String(lookupResult.details.batchNumber || '-')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expiry</span>
                    <p className="font-medium">{String(lookupResult.details.expiryDate || '-')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price</span>
                    <p className="font-medium">{formatCurrency(Number(lookupResult.details.sellingPrice || 0))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stock</span>
                    <div className="mt-0.5">
                      {getStockBadge(
                        Number(lookupResult.details.stock || 0),
                        Number(lookupResult.details.minStock || 10)
                      )}
                    </div>
                  </div>
                </div>
              )}
              {lookupResult.entityType === 'Patient' && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Phone</span>
                    <p className="font-medium">{String(lookupResult.details.phone || '-')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gender</span>
                    <p className="font-medium">{String(lookupResult.details.gender || '-')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Blood Group</span>
                    <p className="font-medium">{String(lookupResult.details.bloodGroup || '-')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <div className="mt-0.5">{getStatusBadge(String(lookupResult.details.status || 'Active'))}</div>
                  </div>
                </div>
              )}
              {lookupResult.entityType === 'Invoice' && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Patient</span>
                    <p className="font-medium">{String(lookupResult.details.patientName || '-')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date</span>
                    <p className="font-medium">{String(lookupResult.details.date || '-')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total</span>
                    <p className="font-medium">{formatCurrency(Number(lookupResult.details.grandTotal || 0))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Paid</span>
                    <p className="font-medium">{formatCurrency(Number(lookupResult.details.paidAmount || 0))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Balance</span>
                    <p className="font-medium">{formatCurrency(Number(lookupResult.details.balance || 0))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <div className="mt-0.5">{getStatusBadge(String(lookupResult.details.status || 'Unpaid'))}</div>
                  </div>
                </div>
              )}
              <Separator className="my-4" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {lookupResult.entityType === 'Medicine' && 'Go to Inventory'}
                  {lookupResult.entityType === 'Patient' && 'Go to Patient'}
                  {lookupResult.entityType === 'Invoice' && 'Go to Billing'}
                </Button>
              </div>
            </CardContent>
          )}
          {!lookupResult.found && (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No medicine, patient, or invoice found with barcode &ldquo;{barcode}&rdquo;
              </p>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Scan History
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={historyLoading}>
              <Loader2 className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>Recent barcode scans (last 50)</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : scanHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <ScanLine className="h-8 w-8 mb-2 opacity-50" />
              <p>No scans recorded yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scanned By</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scanHistory.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell className="font-mono text-xs">{scan.barcode}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {entityIcons[scan.entityType]}
                        <Badge variant="outline" className={entityColors[scan.entityType]}>
                          {scan.entityType}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{scan.user?.name || 'Unknown'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{scan.location || '-'}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(scan.scannedAt).toLocaleString()}
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
}

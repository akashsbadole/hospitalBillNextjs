'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, type SingleResponse, type PaginatedResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Radio,
  Activity,
  FileCode,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Loader2,
  Send,
  MoreHorizontal,
} from 'lucide-react'

interface Hl7Message {
  id: string
  messageId: string
  direction: 'Inbound' | 'Outbound'
  messageType: string
  triggerEvent: string
  patientName: string | null
  patientId: string | null
  rawContent: string
  parsedJson: Record<string, unknown> | null
  status: 'Processed' | 'Failed' | 'Pending'
  createdAt: string
}

interface FhirResource {
  id: string
  resourceId: string
  resourceType: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ'
  status: 'Success' | 'Failed' | 'Pending'
  resourceJson: Record<string, unknown> | null
  createdAt: string
}

const MESSAGE_TYPES = ['ADT', 'ORU', 'ORM', 'SIU', 'MDM']
const DIRECTIONS = ['Inbound', 'Outbound']
const HL7_STATUSES = ['Processed', 'Failed', 'Pending']
const RESOURCE_TYPES = ['Patient', 'Observation', 'Condition', 'MedicationRequest', 'Encounter', 'DiagnosticReport']
const FHIR_STATUSES = ['Success', 'Failed', 'Pending']

function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

function EmptyState({ message, icon: Icon = Radio }: { message: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-3">
      <Icon className="h-12 w-12 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <AlertCircle className="h-12 w-12 text-red-400" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />Retry
      </Button>
    </div>
  )
}

export function Hl7FhirPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('hl7')

  const [hl7Messages, setHl7Messages] = useState<Hl7Message[]>([])
  const [hl7Loading, setHl7Loading] = useState(false)
  const [hl7Error, setHl7Error] = useState<string | null>(null)
  const [hl7FilterDirection, setHl7FilterDirection] = useState('all')
  const [hl7FilterType, setHl7FilterType] = useState('all')
  const [hl7FilterStatus, setHl7FilterStatus] = useState('all')
  const [viewHl7Message, setViewHl7Message] = useState<Hl7Message | null>(null)

  const [fhirResources, setFhirResources] = useState<FhirResource[]>([])
  const [fhirLoading, setFhirLoading] = useState(false)
  const [fhirError, setFhirError] = useState<string | null>(null)
  const [fhirFilterType, setFhirFilterType] = useState('all')
  const [fhirFilterStatus, setFhirFilterStatus] = useState('all')
  const [viewFhirResource, setViewFhirResource] = useState<FhirResource | null>(null)

  const [testMsgOpen, setTestMsgOpen] = useState(false)
  const [testMessageContent, setTestMessageContent] = useState('')
  const [testSubmitting, setTestSubmitting] = useState(false)

  const fetchHl7Messages = useCallback(async (direction: string, msgType: string, status: string) => {
    setHl7Loading(true)
    setHl7Error(null)
    try {
      const params: Record<string, string> = {}
      if (direction !== 'all') params.direction = direction
      if (msgType !== 'all') params.messageType = msgType
      if (status !== 'all') params.status = status
      const res = await apiGet<PaginatedResponse<Hl7Message>>('/hl7/messages', params)
      setHl7Messages(res.data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load HL7 messages'
      setHl7Error(msg)
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setHl7Loading(false)
    }
  }, [toast])

  const fetchFhirResources = useCallback(async (resourceType: string, status: string) => {
    setFhirLoading(true)
    setFhirError(null)
    try {
      const params: Record<string, string> = {}
      if (resourceType !== 'all') params.resourceType = resourceType
      if (status !== 'all') params.status = status
      const res = await apiGet<PaginatedResponse<FhirResource>>('/fhir/resources', params)
      setFhirResources(res.data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load FHIR resources'
      setFhirError(msg)
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setFhirLoading(false)
    }
  }, [toast])

   
  useEffect(() => {
    if (activeTab === 'hl7') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchHl7Messages(hl7FilterDirection, hl7FilterType, hl7FilterStatus)
    }
  }, [activeTab, hl7FilterDirection, hl7FilterType, hl7FilterStatus, fetchHl7Messages])

    
  useEffect(() => {
    if (activeTab === 'fhir') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchFhirResources(fhirFilterType, fhirFilterStatus)
    }
  }, [activeTab, fhirFilterType, fhirFilterStatus, fetchFhirResources])

  const handleSendTestMessage = async () => {
    if (!testMessageContent.trim()) {
      toast({ title: 'Validation Error', description: 'Message content cannot be empty', variant: 'destructive' })
      return
    }
    setTestSubmitting(true)
    try {
      await apiPost<SingleResponse<Hl7Message>>('/hl7/test', { content: testMessageContent })
      toast({ title: 'Test Message Sent', description: 'HL7 test message has been queued' })
      setTestMsgOpen(false)
      setTestMessageContent('')
      fetchHl7Messages(hl7FilterDirection, hl7FilterType, hl7FilterStatus)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to send test message', variant: 'destructive' })
    } finally {
      setTestSubmitting(false)
    }
  }

  const handleResendMessage = async (msg: Hl7Message) => {
    try {
      await apiPost<SingleResponse<Hl7Message>>(`/hl7/messages/${msg.id}/resend`)
      toast({ title: 'Message Resent', description: `Message ${msg.messageId} queued for resend` })
      fetchHl7Messages(hl7FilterDirection, hl7FilterType, hl7FilterStatus)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to resend message', variant: 'destructive' })
    }
  }

  const renderHl7Tab = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={hl7FilterDirection} onValueChange={setHl7FilterDirection}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              {DIRECTIONS.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={hl7FilterType} onValueChange={setHl7FilterType}>
            <SelectTrigger className="w-[140px]">
              <Activity className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Message Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {MESSAGE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={hl7FilterStatus} onValueChange={setHl7FilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {HL7_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={testMsgOpen} onOpenChange={setTestMsgOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2 shrink-0">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send Test Message</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Send Test HL7 Message</DialogTitle>
              <DialogDescription>Send a raw HL7 message for testing and validation</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>HL7 Message Content</Label>
                <Textarea
                  value={testMessageContent}
                  onChange={(e) => setTestMessageContent(e.target.value)}
                  placeholder={`MSH|^~\\&|HIS|HOSPITAL|LAB|LAB|202401010830||ADT^A01|MSG00001|P|2.5\nEVN|A01|202401010830|||\nPID|1||PAT001^^^HOSPITAL^MR||DOE^JOHN^||19700101|M|||123 MAIN ST^^CITY^ST^12345||555-0100|||S||||||`}
                  className="font-mono text-xs min-h-[200px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTestMsgOpen(false)}>Cancel</Button>
              <Button onClick={handleSendTestMessage} disabled={testSubmitting}>
                {testSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {hl7Loading ? (
            <div className="p-6"><SkeletonTable rows={5} cols={7} /></div>
          ) : hl7Error ? (
            <div className="p-6"><ErrorState message={hl7Error} onRetry={() => fetchHl7Messages(hl7FilterDirection, hl7FilterType, hl7FilterStatus)} /></div>
          ) : hl7Messages.length === 0 ? (
            <EmptyState message="No HL7 messages found" icon={Radio} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Message ID</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hl7Messages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell className="font-mono text-xs font-medium">{msg.messageId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        msg.direction === 'Inbound'
                          ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                          : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                      }>
                        {msg.direction}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{msg.messageType}</TableCell>
                    <TableCell className="font-mono text-xs">{msg.triggerEvent}</TableCell>
                    <TableCell className="text-sm">
                      {msg.patientName ? (
                        <div>
                          <span className="font-medium">{msg.patientName}</span>
                          {msg.patientId && <span className="text-xs text-muted-foreground ml-1">({msg.patientId})</span>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        msg.status === 'Processed' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300' :
                        msg.status === 'Failed' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300' :
                        'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                      }>
                        {msg.status === 'Processed' && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                        {msg.status === 'Failed' && <AlertCircle className="h-3 w-3 mr-1 inline" />}
                        {msg.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(msg.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setViewHl7Message(msg)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleResendMessage(msg)}>
                              <Send className="h-4 w-4 mr-2" />Resend
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewHl7Message} onOpenChange={(open) => { if (!open) setViewHl7Message(null) }}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          {viewHl7Message && (
            <>
              <DialogHeader>
                <DialogTitle>HL7 Message Details</DialogTitle>
                <DialogDescription>
                  {viewHl7Message.messageId} · {viewHl7Message.messageType}^{viewHl7Message.triggerEvent} · {viewHl7Message.direction}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div><span className="text-muted-foreground">Patient:</span> <span className="font-medium">{viewHl7Message.patientName || '—'}</span></div>
                <div><span className="text-muted-foreground">Patient ID:</span> <span className="font-medium">{viewHl7Message.patientId || '—'}</span></div>
                <div><span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className={viewHl7Message.status === 'Processed' ? 'bg-green-100 text-green-700 ml-1' : viewHl7Message.status === 'Failed' ? 'bg-red-100 text-red-700 ml-1' : 'bg-amber-100 text-amber-700 ml-1'}>
                    {viewHl7Message.status}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground">Timestamp:</span> <span className="font-medium">{new Date(viewHl7Message.createdAt).toLocaleString()}</span></div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-blue-500" />
                    Raw Message
                  </h4>
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-[250px] overflow-y-auto border">
                    {viewHl7Message.rawContent}
                  </pre>
                </div>
                {viewHl7Message.parsedJson && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      Parsed Data (JSON)
                    </h4>
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto border">
                      {JSON.stringify(viewHl7Message.parsedJson, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )

  const renderFhirTab = () => (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        <Select value={fhirFilterType} onValueChange={setFhirFilterType}>
          <SelectTrigger className="w-[180px]">
            <FileCode className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Resource Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {RESOURCE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fhirFilterStatus} onValueChange={setFhirFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {FHIR_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {fhirLoading ? (
            <div className="p-6"><SkeletonTable rows={5} cols={6} /></div>
          ) : fhirError ? (
            <div className="p-6"><ErrorState message={fhirError} onRetry={() => fetchFhirResources(fhirFilterType, fhirFilterStatus)} /></div>
          ) : fhirResources.length === 0 ? (
            <EmptyState message="No FHIR resources found" icon={FileCode} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Resource ID</TableHead>
                  <TableHead>Resource Type</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fhirResources.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-medium">{r.resourceId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {r.resourceType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        r.operation === 'CREATE' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300' :
                        r.operation === 'UPDATE' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300' :
                        r.operation === 'DELETE' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300' :
                        'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300'
                      }>
                        {r.operation}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        r.status === 'Success' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300' :
                        r.status === 'Failed' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300' :
                        'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                      }>
                        {r.status === 'Success' && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                        {r.status === 'Failed' && <AlertCircle className="h-3 w-3 mr-1 inline" />}
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setViewFhirResource(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewFhirResource} onOpenChange={(open) => { if (!open) setViewFhirResource(null) }}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          {viewFhirResource && (
            <>
              <DialogHeader>
                <DialogTitle>FHIR Resource Details</DialogTitle>
                <DialogDescription>
                  {viewFhirResource.resourceId} · {viewFhirResource.resourceType} · {viewFhirResource.operation}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div><span className="text-muted-foreground">Resource Type:</span> <span className="font-medium">{viewFhirResource.resourceType}</span></div>
                <div><span className="text-muted-foreground">Operation:</span> <span className="font-medium">{viewFhirResource.operation}</span></div>
                <div><span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className={viewFhirResource.status === 'Success' ? 'bg-green-100 text-green-700 ml-1' : viewFhirResource.status === 'Failed' ? 'bg-red-100 text-red-700 ml-1' : 'bg-amber-100 text-amber-700 ml-1'}>
                    {viewFhirResource.status}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground">Timestamp:</span> <span className="font-medium">{new Date(viewFhirResource.createdAt).toLocaleString()}</span></div>
              </div>
              {viewFhirResource.resourceJson && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-emerald-500" />
                    FHIR Resource JSON
                  </h4>
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto border">
                    {JSON.stringify(viewFhirResource.resourceJson, null, 2)}
                  </pre>
                </div>
              )}
              {!viewFhirResource.resourceJson && (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No resource data available for this entry.
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">HL7 / FHIR Interoperability</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor HL7 messages and FHIR resource operations
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="hl7" className="gap-2">
            <Radio className="h-4 w-4" />
            <span className="hidden sm:inline">HL7 Messages</span>
            <span className="sm:hidden">HL7</span>
          </TabsTrigger>
          <TabsTrigger value="fhir" className="gap-2">
            <FileCode className="h-4 w-4" />
            <span className="hidden sm:inline">FHIR Resources</span>
            <span className="sm:hidden">FHIR</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="hl7" className="mt-6">{renderHl7Tab()}</TabsContent>
        <TabsContent value="fhir" className="mt-6">{renderFhirTab()}</TabsContent>
      </Tabs>
    </div>
  )
}

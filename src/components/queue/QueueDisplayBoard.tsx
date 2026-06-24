'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Clock, SkipForward, CheckCheck } from 'lucide-react'
import { apiGet, type PaginatedResponse } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

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

const DEPARTMENTS = [
  'All Departments',
  'General Medicine',
  'Cardiology',
  'Orthopedics',
  'Dermatology',
  'Pediatrics',
  'Gynecology',
  'ENT',
  'Ophthalmology',
  'Neurology',
  'Psychiatry',
  'Urology',
]

const PRIORITY_COLORS: Record<string, string> = {
  Normal: 'bg-blue-100 text-blue-700 border-blue-200',
  Urgent: 'bg-amber-100 text-amber-700 border-amber-200',
  Emergency: 'bg-red-100 text-red-700 border-red-200 animate-pulse',
  VIP: 'bg-purple-100 text-purple-700 border-purple-200',
}

const STATUS_COLORS: Record<string, string> = {
  Waiting: 'bg-gray-100 text-gray-600 border-gray-200',
  Called: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'In-Consultation': 'bg-sky-100 text-sky-700 border-sky-200',
  Completed: 'bg-slate-100 text-slate-500 border-slate-200',
  Skipped: 'bg-rose-100 text-rose-600 border-rose-200',
}

export function QueueDisplayBoard() {
  const [tokens, setTokens] = useState<QueueToken[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDepartment, setActiveDepartment] = useState('All Departments')
  const [currentTime, setCurrentTime] = useState(new Date())

  const fetchQueue = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { limit: 200 }
      if (activeDepartment !== 'All Departments') params.department = activeDepartment

      const res = await apiGet<PaginatedResponse<QueueToken>>('/queue', params)
      setTokens(res.data)
    } catch {
      // silently retry on next interval
    } finally {
      setLoading(false)
    }
  }, [activeDepartment])

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 10000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  useEffect(() => {
    const clock = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(clock)
  }, [])

  const nowServing = tokens.filter((t) => t.status === 'Called' || t.status === 'In-Consultation')
  const waiting = tokens.filter((t) => t.status === 'Waiting')

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Users className="size-8 text-emerald-400" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Queue Display Board</h1>
            <p className="text-sm text-slate-400">Real-time patient queue status</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-2xl font-mono tabular-nums">
          <Clock className="size-6 text-emerald-400" />
          <span>{currentTime.toLocaleTimeString('en-IN')}</span>
        </div>
      </div>

      {/* Department Tabs */}
      <Tabs
        value={activeDepartment}
        onValueChange={(val) => {
          setActiveDepartment(val)
          setLoading(true)
        }}
        className="w-full"
      >
        <TabsList className="bg-slate-900 border border-slate-800 w-full flex-wrap h-auto">
          {DEPARTMENTS.map((dept) => (
            <TabsTrigger
              key={dept}
              value={dept}
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300"
            >
              {dept === 'All Departments' ? dept : dept}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Now Serving */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <CheckCheck className="size-5" />
            Now Serving
          </h2>
          {loading ? (
            <div className="flex gap-4">
              <Skeleton className="h-20 w-48 bg-slate-800" />
              <Skeleton className="h-20 w-48 bg-slate-800" />
            </div>
          ) : nowServing.length === 0 ? (
            <p className="text-slate-500 text-sm">No patients are currently being served.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {nowServing.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center gap-4 bg-emerald-950/50 border border-emerald-800 rounded-lg p-4 min-w-[200px]"
                >
                  <div className="text-4xl font-bold text-emerald-400">
                    {String(token.tokenNumber).padStart(2, '0')}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{token.patient.name}</p>
                    <p className="text-xs text-slate-400">
                      {token.department} {token.counterNumber ? `• Counter ${token.counterNumber}` : ''}
                    </p>
                    <Badge
                      className={`mt-1 ${PRIORITY_COLORS[token.priority] || PRIORITY_COLORS.Normal}`}
                      variant="outline"
                    >
                      {token.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Waiting List */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="size-5 text-slate-400" />
              Waiting List
              <Badge className="ml-2 bg-slate-700 text-white">{waiting.length}</Badge>
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Token</TableHead>
                <TableHead className="text-slate-400">Patient Name</TableHead>
                <TableHead className="text-slate-400">Department</TableHead>
                <TableHead className="text-slate-400">Priority</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400 text-right">Issued At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-slate-800">
                    <TableCell><Skeleton className="h-5 w-12 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 bg-slate-800" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto bg-slate-800" /></TableCell>
                  </TableRow>
                ))
              ) : tokens.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                    No tokens in the queue.
                  </TableCell>
                </TableRow>
              ) : (
                tokens.map((token) => (
                  <TableRow
                    key={token.id}
                    className={`border-slate-800 ${
                      token.status === 'Called' || token.status === 'In-Consultation'
                        ? 'bg-emerald-950/30'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <TableCell className="font-mono text-lg font-bold text-white">
                      {String(token.tokenNumber).padStart(2, '0')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-slate-700 text-white text-xs font-semibold shrink-0">
                          {token.patient.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{token.patient.name}</p>
                          <p className="text-xs text-slate-500">{token.patient.patientId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{token.department}</TableCell>
                    <TableCell>
                      <Badge
                        className={`${PRIORITY_COLORS[token.priority] || PRIORITY_COLORS.Normal}`}
                        variant="outline"
                      >
                        {token.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${STATUS_COLORS[token.status] || STATUS_COLORS.Waiting}`}
                        variant="outline"
                      >
                        {token.status === 'In-Consultation' ? 'In Consult' : token.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-slate-400 font-mono text-sm">
                      {formatTime(token.issuedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
        <Clock className="size-3.5" />
        Auto-refreshes every 10 seconds
        {!loading && (
          <>
            <span className="mx-1">•</span>
            <span>{tokens.length} token{tokens.length !== 1 ? 's' : ''} loaded</span>
          </>
        )}
      </div>
    </div>
  )
}

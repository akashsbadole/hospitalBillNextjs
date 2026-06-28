'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { MODALITY_OPTIONS } from '@/lib/ai-service'
import { Loader2, Upload, Image as ImageIcon, Brain, AlertCircle, CheckCircle2, XCircle, RefreshCw, Clock, Search, Trash2, FlaskConical, Microscope, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

type AnalysisResult = Record<string, unknown>
type AnalysisEntry = {
  id: string
  analysisId: string
  type: string
  input: { imageUrl: string; modality: string; bodyPart?: string; clinicalContext?: string }
  result: { gemini: AnalysisResult; claude: AnalysisResult; geminiError?: string; claudeError?: string }
  model: string
  createdAt: string
}

const URGENCY_COLORS: Record<string, string> = {
  Normal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Abnormal: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export function AiImagingPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [modality, setModality] = useState('X-Ray')
  const [bodyPart, setBodyPart] = useState('')
  const [clinicalContext, setClinicalContext] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string; patientId: string } | null>(null)
  const [patients, setPatients] = useState<Array<{ id: string; name: string; patientId: string }>>([])
  const [patientSearching, setPatientSearching] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<{
    gemini: AnalysisResult
    claude: AnalysisResult
    geminiError?: string
    claudeError?: string
    imageUrl: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // History
  const [history, setHistory] = useState<AnalysisEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('new')

  const modalityConfig = MODALITY_OPTIONS.find((m) => m.value === modality)
  const bodyParts: readonly string[] = modalityConfig?.bodyParts || []

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (bodyParts.length > 0 && bodyParts.indexOf(bodyPart) === -1) {
      setBodyPart(bodyParts[0] as string)
    }
  }, [modality, bodyPart, bodyParts])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/ai/analyze-image')
      if (res.ok) {
        const json = await res.json()
        setHistory(json.data || [])
      }
    } catch {
      // silent
    } finally {
      setHistoryLoading(false)
    }
  }, [])

   
  useEffect(() => {
    if (activeTab === 'history') // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory()
  }, [activeTab, loadHistory])

  const handleFileSelect = useCallback((file: File | null) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Invalid file type. Supported: JPEG, PNG, WebP, GIF')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10MB')
      return
    }
    setError(null)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setResult(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    handleFileSelect(file)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const searchPatients = useCallback(async (query: string) => {
    if (query.length < 2) {
      setPatients([])
      return
    }
    setPatientSearching(true)
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=5`)
      if (res.ok) {
        const json = await res.json()
        setPatients(json.data || [])
      }
    } catch {
      // silent
    } finally {
      setPatientSearching(false)
    }
  }, [])

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Please select an image to analyze')
      return
    }
    setError(null)
    setAnalyzing(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('image', selectedFile)
      formData.append('metadata', JSON.stringify({
        modality,
        bodyPart: bodyPart || undefined,
        clinicalContext: clinicalContext || undefined,
        patientId: selectedPatient?.id || undefined,
      }))

      const res = await fetch('/api/ai/analyze-image', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Analysis failed')
      }

      const json = await res.json()
      setResult({
        gemini: json.data.gemini,
        claude: json.data.claude,
        geminiError: json.data.geminiError,
        claudeError: json.data.claudeError,
        imageUrl: json.data.imageUrl,
      })
      setActiveTab('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/analyze-image/${id}`, { method: 'DELETE' })
      if (res.ok) setHistory((prev) => prev.filter((h) => h.id !== id))
    } catch {
      // silent
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Medical Imaging Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze X-rays, ultrasound, CT, MRI, and other medical images using Google Gemini and Anthropic Claude
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            Gemini
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            Claude
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="new" className="gap-2">
            <Upload className="h-4 w-4" />
            New Analysis
          </TabsTrigger>
          <TabsTrigger value="result" className="gap-2" disabled={!result}>
            <Activity className="h-4 w-4" />
            Results
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Upload Medical Image</CardTitle>
                  <CardDescription>Drag & drop or click to upload (JPEG, PNG, WebP, GIF, max 10MB)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
                      previewUrl
                        ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                        : 'border-muted-foreground/25 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/10'
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    />
                    {previewUrl ? (
                      <div className="space-y-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-h-64 mx-auto rounded-lg object-contain"
                        />
                        <p className="text-sm text-muted-foreground">
                          {selectedFile?.name} ({(selectedFile?.size || 0) / 1024 / 1024 < 1
                            ? `${((selectedFile?.size || 0) / 1024).toFixed(0)} KB`
                            : `${((selectedFile?.size || 0) / 1024 / 1024).toFixed(1)} MB`}
                          )
                        </p>
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); resetForm() }}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-center">
                          <div className="p-4 rounded-full bg-muted">
                            <ImageIcon className="h-10 w-10 text-muted-foreground" />
                          </div>
                        </div>
                        <div>
                          <p className="font-medium">Drop image here or click to browse</p>
                          <p className="text-xs text-muted-foreground mt-1">X-Ray, Ultrasound, CT, MRI, Mammography, etc.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Clinical Context</CardTitle>
                  <CardDescription>Provide details to improve AI analysis accuracy</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Imaging Modality</Label>
                      <Select value={modality} onValueChange={setModality}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODALITY_OPTIONS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Body Part / Region</Label>
                      <Select value={bodyPart} onValueChange={setBodyPart}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select body part" />
                        </SelectTrigger>
                        <SelectContent>
                          {bodyParts.map((bp) => (
                            <SelectItem key={bp} value={bp}>{bp}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label>Clinical History / Indication</Label>
                    <Textarea
                      placeholder="E.g., 45-year-old male with persistent cough for 2 weeks, history of smoking..."
                      value={clinicalContext}
                      onChange={(e) => setClinicalContext(e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Link Patient</CardTitle>
                  <CardDescription>Optional - search and link to patient record</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search patients..."
                      className="pl-8"
                      value={patientSearch}
                      onChange={(e) => {
                        setPatientSearch(e.target.value)
                        searchPatients(e.target.value)
                      }}
                    />
                  </div>
                  {patientSearching && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Searching...
                    </div>
                  )}
                  {patients.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {patients.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedPatient(p)
                            setPatients([])
                            setPatientSearch(p.name)
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors',
                            selectedPatient?.id === p.id && 'bg-emerald-50 dark:bg-emerald-950/30'
                          )}
                        >
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.patientId}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedPatient && (
                    <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                      <div>
                        <p className="text-sm font-medium">{selectedPatient.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedPatient.patientId}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setSelectedPatient(null)
                          setPatientSearch('')
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Analyze</CardTitle>
                  <CardDescription>Run analysis on both AI models</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={handleAnalyze}
                    disabled={!selectedFile || analyzing}
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing with Gemini & Claude...
                      </>
                    ) : (
                      <>
                        <Microscope className="h-4 w-4" />
                        Analyze Image
                      </>
                    )}
                  </Button>
                  {error && (
                    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="result">
          {result ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gemini Result */}
                <Card className={cn(result.geminiError ? 'border-red-200 dark:border-red-900' : 'border-emerald-200 dark:border-emerald-900')}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-emerald-600" />
                        <CardTitle className="text-lg">Google Gemini</CardTitle>
                      </div>
                      {result.geminiError ? (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Error
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Completed
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {result.geminiError ? (
                      <div className="text-sm text-red-600 space-y-2">
                        <p className="font-medium">Analysis Error</p>
                        <p className="text-muted-foreground">{result.geminiError}</p>
                      </div>
                    ) : (
                      <AnalysisResultView result={result.gemini} />
                    )}
                  </CardContent>
                </Card>

                {/* Claude Result */}
                <Card className={cn(result.claudeError ? 'border-red-200 dark:border-red-900' : 'border-emerald-200 dark:border-emerald-900')}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-5 w-5 text-purple-600" />
                        <CardTitle className="text-lg">Anthropic Claude</CardTitle>
                      </div>
                      {result.claudeError ? (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Error
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Completed
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {result.claudeError ? (
                      <div className="text-sm text-red-600 space-y-2">
                        <p className="font-medium">Analysis Error</p>
                        <p className="text-muted-foreground">{result.claudeError}</p>
                      </div>
                    ) : (
                      <AnalysisResultView result={result.claude} />
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-center">
                <Button variant="outline" onClick={() => { setActiveTab('new'); resetForm() }} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  New Analysis
                </Button>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium">No results yet</p>
                <p className="text-sm">Run an analysis to see results here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Analysis History</CardTitle>
                  <CardDescription>Previous medical image analyses</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadHistory} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Clock className="h-10 w-10 mb-3 opacity-50" />
                  <p className="font-medium">No analysis history</p>
                  <p className="text-sm">Upload and analyze images to build history</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-4 border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0 border">
                        {entry.input?.imageUrl ? (
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={entry.input.imageUrl}
                            alt="Analysis"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{entry.input?.modality || 'Unknown'} Analysis</p>
                          {entry.input?.bodyPart && (
                            <Badge variant="secondary" className="text-[10px]">{entry.input.bodyPart}</Badge>
                          )}
                          {(entry.result?.gemini?.urgencyLevel as string) && (
                            <Badge className={cn('text-[10px]', URGENCY_COLORS[entry.result.gemini.urgencyLevel as string] || '')}>
                              {entry.result.gemini.urgencyLevel as string}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.analysisId} &middot; {new Date(entry.createdAt).toLocaleString()}
                        </p>
                          {(entry.result?.gemini?.impression as string) && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {entry.result.gemini.impression as string}
                            </p>
                          )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AnalysisResultView({ result }: { result: AnalysisResult }) {
  const impression = result.impression as string || ''
  const findings = (result.findings as string[]) || []
  const differentialDiagnosis = (result.differentialDiagnosis as string[]) || []
  const keyObservations = (result.keyObservations as string[]) || []
  const urgencyLevel = result.urgencyLevel as string || 'Normal'
  const recommendations = (result.recommendations as string[]) || []
  const limitations = (result.limitations as string[]) || []
  const disclaimer = result.disclaimer as string || ''

  return (
    <div className="space-y-4">
      {urgencyLevel && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Urgency:</span>
          <Badge className={cn('text-xs', URGENCY_COLORS[urgencyLevel] || '')}>
            {urgencyLevel}
          </Badge>
        </div>
      )}

      {impression && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Impression</p>
          <p className="text-sm leading-relaxed">{impression}</p>
        </div>
      )}

      {findings.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Findings</p>
          <ul className="space-y-1">
            {findings.map((f, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-emerald-600 mt-1">&bull;</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {keyObservations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Key Observations</p>
          <ul className="space-y-1">
            {keyObservations.map((o, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-amber-600 mt-1">&bull;</span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {differentialDiagnosis.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Differential Diagnosis</p>
          <ul className="space-y-1">
            {differentialDiagnosis.map((d, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-purple-600 mt-1">&bull;</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Recommendations</p>
          <ul className="space-y-1">
            {recommendations.map((r, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-blue-600 mt-1">&bull;</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {limitations.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-wider">Limitations</p>
          <ul className="space-y-0.5">
            {limitations.map((l, i) => (
              <li key={i} className="text-xs text-amber-600 dark:text-amber-300">{l}</li>
            ))}
          </ul>
        </div>
      )}

      {disclaimer && (
        <div className="bg-muted rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground italic">{disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  )
}

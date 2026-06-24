'use client'

import React, { useRef, useState } from 'react'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'

interface ImageUploadProps {
  currentImage?: string | null
  onUploadComplete: (url: string) => void
  type?: string
  aspectRatio?: string
  className?: string
}

export function ImageUpload({ currentImage, onUploadComplete, type = 'general', aspectRatio = 'aspect-square', className = '' }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Only JPEG, PNG, WebP, and GIF files are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB')
      return
    }

    setError(null)
    setPreview(URL.createObjectURL(file))
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const errData = await res.json()
        throw new ApiError(res.status, errData.error || 'Upload failed')
      }
      const json = await res.json()
      onUploadComplete(json.data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setPreview(null)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const displayUrl = preview || currentImage || null

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div
        className={`relative ${aspectRatio} w-full max-w-[200px] rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/20 cursor-pointer hover:border-emerald-500/50 transition-colors`}
        onClick={() => inputRef.current?.click()}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="Preview" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-muted-foreground">
            <ImageIcon className="h-10 w-10" />
            <span className="text-xs text-center">Click to upload image</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileSelect} />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload className="h-4 w-4 mr-1" />
          {currentImage ? 'Change' : 'Upload'}
        </Button>
        {displayUrl && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setPreview(null); onUploadComplete('') }}>
            <X className="h-4 w-4 mr-1" />
            Remove
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

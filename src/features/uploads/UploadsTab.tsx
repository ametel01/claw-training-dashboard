import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface UploadBoxProps {
  title: string
  kind: string
  accept: string
  description: string
  onSuccess?: () => void
}

function UploadBox({ title, kind, accept, description, onSuccess }: UploadBoxProps) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [statusText, setStatusText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setStatus('uploading')
    setStatusText(`Uploading ${file.name}…`)
    const form = new FormData()
    form.append('kind', kind)
    form.append('file', file)
    try {
      const res = await fetch('/api/upload-health', { method: 'POST', body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || `upload failed (${res.status})`)
      setStatus('done')
      setStatusText(`Uploaded: ${json.path || file.name}`)
      onSuccess?.()
    } catch (e) {
      setStatus('error')
      setStatusText(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <Card
      className={cn(
        'border-2 border-dashed transition-colors cursor-pointer',
        dragging ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          {title}
          {status === 'done' && <Badge variant="done">Uploaded</Badge>}
          {status === 'error' && <Badge variant="destructive">Error</Badge>}
          {status === 'uploading' && <Badge variant="secondary">Uploading…</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground mt-1">Accepts: {accept}</p>
        {statusText && <p className="text-xs text-muted-foreground mt-2 font-mono">{statusText}</p>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
          }}
        />
      </CardContent>
    </Card>
  )
}

interface UploadsTabProps {
  onRefresh: () => void
}

export function UploadsTab({ onRefresh }: UploadsTabProps) {
  return (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UploadBox
          title="Apple Health"
          kind="apple"
          accept=".xml,.zip,application/xml,application/zip"
          description="Drop your Apple Health export here (export.xml or export.zip)"
          onSuccess={onRefresh}
        />
        <UploadBox
          title="Polar Export"
          kind="polar"
          accept=".tcx,.csv,.fit,text/csv,application/octet-stream"
          description="Drop your Polar training file here (.tcx, .csv, or .fit)"
          onSuccess={onRefresh}
        />
      </div>
    </div>
  )
}

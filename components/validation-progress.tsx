"use client"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Loader2, Pause, Play, Square, Clock } from "lucide-react"

interface BatchProgress {
  current: number
  total: number
}

interface ValidationProgressProps {
  isValidating: boolean
  validationProgress: number
  batchProgress?: BatchProgress
  isPaused: boolean
  estimatedTime?: number | null
  onPause: () => void
  onResume: () => void
  onCancel: () => void
}

export function ValidationProgress({
  isValidating,
  validationProgress,
  batchProgress,
  isPaused,
  estimatedTime,
  onPause,
  onResume,
  onCancel,
}: ValidationProgressProps) {
  const formatEstimatedTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60)
      const s = Math.round(seconds % 60)
      return `${m}m ${s}s`
    }
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m`
  }

  if (!isValidating) return null

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Pause className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-foreground" />
          )}
          <span className="text-sm font-medium text-foreground">
            {isPaused ? "Paused" : "Validating…"}
          </span>
          {batchProgress && batchProgress.total > 1 && (
            <span className="text-xs text-muted-foreground">
              Batch {batchProgress.current}/{batchProgress.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {estimatedTime && !isPaused && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
              <Clock className="h-3 w-3" />
              {formatEstimatedTime(estimatedTime)}
            </span>
          )}
          {isPaused ? (
            <Button onClick={onResume} variant="outline" size="sm" className="h-7 px-2 text-xs">
              <Play className="h-3 w-3 mr-1" />
              Resume
            </Button>
          ) : (
            <Button onClick={onPause} variant="outline" size="sm" className="h-7 px-2 text-xs">
              <Pause className="h-3 w-3 mr-1" />
              Pause
            </Button>
          )}
          <Button onClick={onCancel} variant="outline" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive">
            <Square className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span className="font-mono">{Math.round(validationProgress || 0)}%</span>
        </div>
        <Progress value={validationProgress || 0} className="h-1.5" />
      </div>

      {batchProgress && batchProgress.total > 1 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Batch</span>
            <span className="font-mono">{batchProgress.current}/{batchProgress.total}</span>
          </div>
          <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-1.5" />
        </div>
      )}
    </div>
  )
}

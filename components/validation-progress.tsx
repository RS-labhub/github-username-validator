"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    if (seconds < 60) {
      return `${Math.round(seconds)}s`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = Math.round(seconds % 60)
      return `${minutes}m ${remainingSeconds}s`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return `${hours}h ${minutes}m`
    }
  }

  if (!isValidating) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isPaused ? <Pause className="h-5 w-5 text-yellow-600" /> : <Loader2 className="h-5 w-5 animate-spin" />}
          {isPaused ? "Validation Paused" : "Validating GitHub Usernames"}
        </CardTitle>
        <CardDescription>
          {batchProgress
            ? `Processing batch ${batchProgress.current} of ${batchProgress.total}`
            : "Validating usernames with GitHub API"}
          {estimatedTime && !isPaused && (
            <span className="ml-2 text-blue-600">• Est. {formatEstimatedTime(estimatedTime)} remaining</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{validationProgress || 0}%</span>
          </div>
          <Progress value={validationProgress || 0} className="w-full" />
        </div>
        {batchProgress && batchProgress.total > 1 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Batch Progress</span>
              <span>
                {batchProgress.current} / {batchProgress.total}
              </span>
            </div>
            <Progress value={(batchProgress.current / batchProgress.total) * 100} className="w-full" />
          </div>
        )}
        <div className="flex gap-2">
          {isPaused ? (
            <Button onClick={onResume} variant="default" size="sm">
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          ) : (
            <Button onClick={onPause} variant="secondary" size="sm">
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          <Button onClick={onCancel} variant="destructive" size="sm">
            <Square className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          {estimatedTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
              <Clock className="h-4 w-4" />
              {isPaused ? "Paused" : `${formatEstimatedTime(estimatedTime)} left`}
            </div>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {isPaused
            ? "Validation is paused. You can resume or cancel the process."
            : batchProgress && batchProgress.total > 1
              ? `Processing large dataset in ${batchProgress.total} batches to respect API limits`
              : "This may take a few moments depending on the number of usernames"}
        </div>
      </CardContent>
    </Card>
  )
}

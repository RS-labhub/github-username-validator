"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RotateCcw } from "lucide-react"
import { StatisticsCards } from "@/components/statistics-cards"
import { ValidationProgress } from "@/components/validation-progress"
import { ResultsTable } from "@/components/results-table"

interface ProcessedUser {
  originalValue: string
  username: string | null
  status: "valid" | "invalid" | "duplicate" | "deleted" | "processing" | "pending" | "error"
  error?: string
  index: number
  profileData?: {
    name?: string
    bio?: string
    public_repos: number
    followers: number
    following: number
    created_at: string
  }
}

interface BatchProgress {
  current: number
  total: number
}

interface ResultsDashboardProps {
  users: ProcessedUser[]
  onValidate?: () => void
  isValidating?: boolean
  validationProgress?: number
  batchProgress?: BatchProgress
  isPaused?: boolean
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  estimatedTime?: number | null
  onRetryFailed?: () => void
}

export function ResultsDashboard({
  users,
  onValidate,
  isValidating,
  validationProgress,
  batchProgress,
  isPaused,
  onPause,
  onResume,
  onCancel,
  estimatedTime,
  onRetryFailed,
}: ResultsDashboardProps) {
  const statistics = useMemo(() => {
    const total = users.length
    const valid = users.filter((u) => u.status === "valid").length
    const pending = users.filter((u) => u.status === "pending").length
    return { total, valid, pending }
  }, [users])

  const failedRetryableCount = useMemo(() => {
    return users.filter((u) => u.status === "error" && u.username && u.error?.includes("Rate limit exceeded")).length
  }, [users])

  if (users.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      <ValidationProgress
        isValidating={isValidating || false}
        validationProgress={validationProgress || 0}
        batchProgress={batchProgress}
        isPaused={isPaused || false}
        estimatedTime={estimatedTime}
        onPause={onPause || (() => {})}
        onResume={onResume || (() => {})}
        onCancel={onCancel || (() => {})}
      />

      <StatisticsCards users={users} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Validation Results</CardTitle>
              <CardDescription>
                {users.length} usernames processed
                {users.length > 1000 && <span className="ml-2 text-blue-600">• Large dataset detected</span>}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {statistics.pending > 0 && onValidate && (
                <Button onClick={onValidate} disabled={isValidating}>
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      Validate with GitHub
                      {statistics.pending > 100 && (
                        <Badge variant="secondary" className="ml-2">
                          {statistics.pending}
                        </Badge>
                      )}
                    </>
                  )}
                </Button>
              )}
              {failedRetryableCount > 0 && onRetryFailed && (
                <Button onClick={onRetryFailed} disabled={isValidating} variant="secondary">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry Failed ({failedRetryableCount})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResultsTable users={users} />
        </CardContent>
      </Card>
    </div>
  )
}

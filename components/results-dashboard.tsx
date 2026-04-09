"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  onRecheckEngagement?: (usernames?: string[]) => void | Promise<void>
  isRecheckingEngagement?: boolean
  repositoryUrl?: string
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
  onRecheckEngagement,
  isRecheckingEngagement,
  repositoryUrl,
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

  if (users.length === 0) return null

  return (
    <div className="space-y-4">
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

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base font-semibold">Results</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {users.length.toLocaleString()} usernames processed
              </p>
            </div>
            <div className="flex gap-2">
              {statistics.pending > 0 && onValidate && (
                <Button onClick={onValidate} disabled={isValidating} size="sm" className="h-8 text-xs">
                  {isValidating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Validating…
                    </>
                  ) : (
                    <>
                      Validate with GitHub
                      {statistics.pending > 100 && (
                        <span className="ml-1.5 rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-mono">
                          {statistics.pending}
                        </span>
                      )}
                    </>
                  )}
                </Button>
              )}
              {failedRetryableCount > 0 && onRetryFailed && (
                <Button onClick={onRetryFailed} disabled={isValidating} variant="outline" size="sm" className="h-8 text-xs">
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Retry ({failedRetryableCount})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResultsTable
            users={users}
            onRecheckEngagement={onRecheckEngagement}
            isRecheckingEngagement={isRecheckingEngagement}
            repositoryUrl={repositoryUrl}
          />
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Key, AlertCircle, Shield, GitFork, ChevronDown, ChevronUp } from "lucide-react"

export type EngagementMode = "both" | "stars" | "forks"

interface GitHubAuthSectionProps {
  githubToken: string
  setGithubToken: (token: string) => void
  repositoryUrl: string
  setRepositoryUrl: (url: string) => void
  engagementMode: EngagementMode
  setEngagementMode: (mode: EngagementMode) => void
  rateLimitInfo?: {
    remaining: number
    limit: number
    resetTime: number
  } | null
  cacheStats?: {
    cached: number
    validated: number
    total: number
  } | null
  validationMethod?: "graphql" | "rest" | null
  onClearToken: () => void
}

export function GitHubAuthSection({
  githubToken,
  setGithubToken,
  repositoryUrl,
  setRepositoryUrl,
  engagementMode,
  setEngagementMode,
  rateLimitInfo,
  cacheStats,
  validationMethod,
  onClearToken,
}: GitHubAuthSectionProps) {
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [showRepoInput, setShowRepoInput] = useState(false)

  const parseRepositoryUrl = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    return match ? { owner: match[1], repo: match[2].replace(/[?#].*$/, "") } : null
  }

  const parsedRepo = repositoryUrl ? parseRepositoryUrl(repositoryUrl) : null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Authentication Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Key className="h-4 w-4 text-muted-foreground" />
            Authentication
            <span className="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Add a Personal Access Token to increase rate limits from 60 to 5,000 req/hr and enable fast GraphQL batch processing.
          </p>

          <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
              Rate Limits
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p><strong className="text-foreground">Without PAT:</strong> Shared 60 req/hr — may fail under load.</p>
              <p><strong className="text-foreground">With PAT:</strong> Personal 5,000 req/hr + 20× faster batching.</p>
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              Your token never leaves your browser.
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTokenInput(!showTokenInput)}
              className="h-8 text-xs"
            >
              {showTokenInput ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {githubToken ? "Edit Token" : "Add Token"}
            </Button>
            {githubToken && (
              <>
                <span className="inline-flex items-center gap-1 rounded-md bg-foreground/5 px-2 py-1 text-xs font-medium text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Configured
                </span>
                <Button variant="ghost" size="sm" onClick={onClearToken} className="h-8 text-xs text-muted-foreground">
                  Remove
                </Button>
              </>
            )}
          </div>

          {rateLimitInfo && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Rate Limit</span>
                <span className="font-mono font-medium text-foreground">
                  {rateLimitInfo.remaining}/{rateLimitInfo.limit}
                </span>
              </div>
              {cacheStats && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cache Hit</span>
                  <span className="font-mono font-medium text-foreground">
                    {cacheStats.cached}/{cacheStats.total} ({Math.round((cacheStats.cached / cacheStats.total) * 100)}%)
                  </span>
                </div>
              )}
              {validationMethod && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium text-foreground">
                    {validationMethod === "graphql" ? "GraphQL" : "REST"}
                  </span>
                </div>
              )}
            </div>
          )}

          {showTokenInput && (
            <div className="space-y-2 pt-1">
              <Label htmlFor="github-token" className="text-xs font-medium">
                Personal Access Token
              </Label>
              <Input
                id="github-token"
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="h-9 font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Create a token at{" "}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                >
                  github.com/settings/tokens
                </a>{" "}
                with <code className="rounded bg-muted px-1 py-0.5 text-[11px]">read:user</code> scope.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repository Analysis Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <GitFork className="h-4 w-4 text-muted-foreground" />
            Repository Analysis
            <span className="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Enter a GitHub repository URL to check which validated users have starred or forked it. Helps identify engaged community members.
          </p>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRepoInput(!showRepoInput)}
              className="h-8 text-xs"
            >
              {showRepoInput ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {repositoryUrl ? "Edit URL" : "Add Repository"}
            </Button>
            {repositoryUrl && parsedRepo && (
              <span className="inline-flex items-center gap-1 rounded-md bg-foreground/5 px-2 py-1 text-xs font-medium font-mono text-foreground">
                {parsedRepo.owner}/{parsedRepo.repo}
              </span>
            )}
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-medium">Check Mode</Label>
            <Select value={engagementMode} onValueChange={(v) => setEngagementMode(v as EngagementMode)}>
              <SelectTrigger className="h-8 text-xs w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both" className="text-xs">Stars &amp; Forks</SelectItem>
                <SelectItem value="stars" className="text-xs">Stars only</SelectItem>
                <SelectItem value="forks" className="text-xs">Forks only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showRepoInput && (
            <div className="space-y-2 pt-1">
              <Label htmlFor="repository-url" className="text-xs font-medium">
                Repository URL
              </Label>
              <Input
                id="repository-url"
                type="url"
                placeholder="https://github.com/owner/repository"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                className="h-9 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                e.g., https://github.com/vercel/next.js
              </p>
              {repositoryUrl && !parsedRepo && (
                <p className="text-xs text-destructive">
                  Invalid URL. Use format: https://github.com/owner/repository
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

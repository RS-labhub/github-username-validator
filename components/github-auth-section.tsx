"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Key, AlertCircle, Shield, GitFork, Star } from "lucide-react"

interface GitHubAuthSectionProps {
  githubToken: string
  setGithubToken: (token: string) => void
  repositoryUrl: string
  setRepositoryUrl: (url: string) => void
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
  rateLimitInfo,
  cacheStats,
  validationMethod,
  onClearToken,
}: GitHubAuthSectionProps) {
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [showRepoInput, setShowRepoInput] = useState(false)

  const parseRepositoryUrl = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    return match ? { owner: match[1], repo: match[2] } : null
  }

  const parsedRepo = repositoryUrl ? parseRepositoryUrl(repositoryUrl) : null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            GitHub Authentication (Optional)
          </CardTitle>
          <CardDescription>
            Add your GitHub Personal Access Token to increase rate limits from 60 to 5,000 requests per hour and enable
            GraphQL batch processing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Important: Rate Limiting Notice</span>
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p>
                <strong>Without PAT:</strong> All users share 60 requests/hour limit. If multiple users access this app
                simultaneously, you may encounter rate limit errors even if you haven't used the app before.
              </p>
              <p>
                <strong>With PAT:</strong> You get your own 5,000 requests/hour limit and 20x faster GraphQL batch
                processing.
              </p>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Privacy Guarantee</span>
            </div>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              Your GitHub token is <strong>never stored</strong> on our servers. It's only kept in your browser session
              and will be lost when you refresh the page.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTokenInput(!showTokenInput)}>
              {showTokenInput ? "Hide" : "Add"} GitHub Token
            </Button>
            {githubToken && (
              <>
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <Key className="h-3 w-3" />
                  Token configured
                </span>
                <Button variant="ghost" size="sm" onClick={onClearToken}>
                  Remove Token
                </Button>
              </>
            )}
          </div>

          {rateLimitInfo && (
            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rate Limit:</span>
                <span className="font-medium">
                  {rateLimitInfo.remaining} / {rateLimitInfo.limit} remaining
                </span>
              </div>
              {cacheStats && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cache Hit:</span>
                  <span className="font-medium">
                    {cacheStats.cached} / {cacheStats.total} ({Math.round((cacheStats.cached / cacheStats.total) * 100)}
                    %)
                  </span>
                </div>
              )}
              {validationMethod && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="font-medium capitalize">
                    {validationMethod === "graphql" ? "GraphQL Batch" : "REST API"}
                  </span>
                </div>
              )}
            </div>
          )}

          {showTokenInput && (
            <div className="space-y-2">
              <Label htmlFor="github-token">GitHub Personal Access Token</Label>
              <Input
                id="github-token"
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Create a token at{" "}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  github.com/settings/tokens
                </a>{" "}
                with 'public_repo' or 'read:user' scope. Enables GraphQL batch processing for 20x faster validation.
              </p>
            </div>
          )}

          {!githubToken && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Limited Performance</span>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                Without a token, validation is limited to 60 requests/hour and uses slower sequential processing.
                <strong> Multiple users may cause rate limit errors.</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitFork className="h-5 w-5" />
            Repository Analysis (Optional)
          </CardTitle>
          <CardDescription>
            Analyze which validated users have starred or forked a specific GitHub repository.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-purple-800 dark:text-purple-200 mb-2">
              <Star className="h-4 w-4" />
              <span className="text-sm font-medium">Repository Star & Fork Analysis</span>
            </div>
            <p className="text-xs text-purple-700 dark:text-purple-300">
              Enter a GitHub repository URL to check which of your validated users have starred or forked that
              repository. This helps identify engaged community members and contributors.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowRepoInput(!showRepoInput)}>
              {showRepoInput ? "Hide" : "Add"} Repository URL
            </Button>
            {repositoryUrl && parsedRepo && (
              <span className="text-sm text-purple-600 flex items-center gap-1">
                <GitFork className="h-3 w-3" />
                {parsedRepo.owner}/{parsedRepo.repo}
              </span>
            )}
          </div>

          {showRepoInput && (
            <div className="space-y-2">
              <Label htmlFor="repository-url">GitHub Repository URL</Label>
              <Input
                id="repository-url"
                type="url"
                placeholder="https://github.com/owner/repository"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the full GitHub repository URL (e.g., https://github.com/vercel/next.js) to analyze stars and
                forks from your validated users.
              </p>
              {repositoryUrl && !parsedRepo && (
                <p className="text-xs text-red-600">
                  Please enter a valid GitHub repository URL in the format: https://github.com/owner/repository
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

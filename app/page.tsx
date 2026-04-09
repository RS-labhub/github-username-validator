"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { AppHeader } from "@/components/app-header"
import { GitHubAuthSection, type EngagementMode } from "@/components/github-auth-section"
import { InputSection } from "@/components/input-section"
import { ResultsDashboard } from "@/components/results-dashboard"

interface ParsedData {
  headers: string[]
  rows: string[][]
}

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
  repositoryEngagement?: {
    hasStarred: boolean
    hasFork: boolean
    repositoryUrl: string
  }
}

interface RepositoryEngagementUser {
  username: string
  hasStarred: boolean
  hasForked: boolean
  error?: string
}

export default function GitHubValidator() {
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [selectedColumn, setSelectedColumn] = useState<string>("")
  const [processedUsers, setProcessedUsers] = useState<ProcessedUser[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationProgress, setValidationProgress] = useState(0)
  const [manualInput, setManualInput] = useState("")
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const [validationController, setValidationController] = useState<AbortController | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null)
  const [githubToken, setGithubToken] = useState("")
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [isProcessingManual, setIsProcessingManual] = useState(false)
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining: number
    limit: number
    resetTime: number
  } | null>(null)
  const [cacheStats, setCacheStats] = useState<{
    cached: number
    validated: number
    total: number
  } | null>(null)
  const [validationMethod, setValidationMethod] = useState<"graphql" | "rest" | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState("upload")
  const [repositoryUrl, setRepositoryUrl] = useState("")
  const [engagementMode, setEngagementMode] = useState<EngagementMode>("both")
  const [isValidatingGitHub, setIsValidatingGitHub] = useState(false)
  const [isRecheckingEngagement, setIsRecheckingEngagement] = useState(false)
  const { toast } = useToast()
  
  // Use ref to store initial estimated time for accurate timer calculations
  const initialEstimatedTimeRef = useRef<number>(0)

  // Timer is now calculated from real batch progress in validateSpecificUsernames

  const parseFile = async (uploadedFile: File): Promise<ParsedData> => {
    const fileName = uploadedFile.name.toLowerCase()

    if (fileName.endsWith(".csv")) {
      return await parseCSV(uploadedFile)
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      return await parseExcel(uploadedFile)
    } else if (fileName.endsWith(".docx")) {
      return await parseWord(uploadedFile)
    } else {
      return await parseText(uploadedFile)
    }
  }

  const parseCSV = async (file: File): Promise<ParsedData> => {
    const text = await file.text()
    const lines = text.split("\n").filter((line) => line.trim())

    if (lines.length === 0) {
      throw new Error("Empty file")
    }

    // Handle different CSV delimiters
    const firstLine = lines[0]
    const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ","

    const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/"/g, ""))
    const rows = lines.slice(1).map((line) => line.split(delimiter).map((cell) => cell.trim().replace(/"/g, "")))

    return { headers, rows }
  }

  const parseExcel = async (file: File): Promise<ParsedData> => {
    try {
      const XLSX = await import("xlsx")
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })

      // Get the first worksheet
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      // Convert to JSON to get all data
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as string[][]

      if (jsonData.length === 0) {
        throw new Error("Empty Excel file")
      }

      const firstRow = jsonData[0].map((cell, index) =>
        cell && cell.toString().trim() ? cell.toString().trim() : `Column ${index + 1}`,
      )

      // If first row looks like data (all cells are usernames/URLs), create generic headers
      const firstRowLooksLikeData = firstRow.every((cell) => {
        const lowerCell = cell.toLowerCase()
        return (
          lowerCell.includes("github.com") ||
          lowerCell.startsWith("@") ||
          /^[a-zA-Z0-9-]+$/.test(cell) ||
          cell.startsWith("Column ")
        )
      })

      let headers: string[]
      let dataRows: string[][]

      if (firstRowLooksLikeData) {
        // First row is data, create generic headers
        headers = firstRow.map((_, index) => `Column ${index + 1}`)
        dataRows = jsonData.map((row) => row.map((cell) => (cell ? cell.toString().trim() : "")))
      } else {
        // First row contains headers
        headers = firstRow
        dataRows = jsonData.slice(1).map((row) => row.map((cell) => (cell ? cell.toString().trim() : "")))
      }

      return { headers, rows: dataRows }
    } catch (error) {
      console.error("Excel parsing error:", error)
      return parseText(file)
    }
  }

  const parseWord = async (file: File): Promise<ParsedData> => {
    // For now, we'll use a simple approach - in a real app, you'd use mammoth library
    const text = await file.text()
    // Fallback to text parsing for now
    return parseText(file)
  }

  const parseText = async (file: File): Promise<ParsedData> => {
    const text = await file.text()
    const lines = text.split("\n").filter((line) => line.trim())
    return {
      headers: ["username"],
      rows: lines.map((line) => [line.trim()]),
    }
  }

  const handleFileUpload = useCallback(
    async (uploadedFile: File) => {
      setIsUploadingFile(true)
      setFile(uploadedFile)
      setProcessedUsers([])

      try {
        const parsed = await parseFile(uploadedFile)
        setParsedData(parsed)

        const githubColumns = parsed.headers.filter((header) => {
          const lowerHeader = header.toLowerCase()
          return (
            lowerHeader.includes("github") ||
            lowerHeader.includes("username") ||
            lowerHeader.includes("user") ||
            lowerHeader.includes("profile") ||
            lowerHeader.includes("account") ||
            lowerHeader.match(/^(gh|git)$/i)
          )
        })

        if (githubColumns.length > 0) {
          setSelectedColumn(githubColumns[0])
          toast({
            title: "Column Auto-detected",
            description: `Found potential GitHub column: "${githubColumns[0]}"`,
          })
        }
      } catch (error) {
        toast({
          title: "Error parsing file",
          description: error instanceof Error ? error.message : "Please check your file format and try again.",
          variant: "destructive",
        })
      } finally {
        setIsUploadingFile(false)
      }
    },
    [toast],
  )

  const extractUsername = (value: string): string | null => {
    if (!value || typeof value !== "string") return null

    value = value.trim()
    if (!value) return null

    // Enhanced GitHub URL patterns
    const githubUrlPatterns = [
      /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/?(?:\?.*)?(?:#.*)?$/i,
      /(?:https?:\/\/)?([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.github\.io\/?)/i,
      /git@github\.com:([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)(?:\.git)?/i,
    ]

    // Try URL patterns first
    for (const pattern of githubUrlPatterns) {
      const match = value.match(pattern)
      if (match && match[1]) {
        let username = match[1]
        // Remove .git suffix if present
        username = username.replace(/\.git$/, "")
        return cleanUsername(username)
      }
    }

    // Handle direct username formats
    let cleanedValue = value

    // Remove @ prefix if present
    if (cleanedValue.startsWith("@")) {
      cleanedValue = cleanedValue.substring(1)
    }

    // Remove common prefixes
    cleanedValue = cleanedValue.replace(/^(?:github:|gh:|git:)/i, "")

    // Remove trailing slashes and whitespace
    cleanedValue = cleanedValue.replace(/\/+$/, "").trim()

    // Strip fragment identifiers (#...) and query strings (?...) that may be appended
    cleanedValue = cleanedValue.replace(/[#?].*$/, "").trim()

    return cleanUsername(cleanedValue)
  }

  const cleanUsername = (username: string): string | null => {
    if (!username) return null

    username = username.trim()

    // GitHub username rules: alphanumeric and hyphens, cannot start/end with hyphen, 1-39 chars
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(username)) {
      return null
    }

    // Length validation (GitHub allows 1-39 characters)
    if (username.length === 0 || username.length > 39) {
      return null
    }

    return username
  }

  const processUsernames = useCallback(() => {
    if (!parsedData || !selectedColumn) return

    setIsProcessing(true)

    const columnIndex = parsedData.headers.indexOf(selectedColumn)
    if (columnIndex === -1) {
      setIsProcessing(false)
      return
    }

    const users: ProcessedUser[] = []
    const seenUsernames = new Map<string, number>() // Track first occurrence index
    const duplicateUsernames = new Set<string>()
    let validUsernameCount = 0

    // First pass: extract usernames, validate format, and identify duplicates
    parsedData.rows.forEach((row, index) => {
      const originalValue = row[columnIndex] || ""
      const username = extractUsername(originalValue)

      let status: ProcessedUser["status"] = "invalid"
      let error: string | undefined

      if (username) {
        const lowerUsername = username.toLowerCase()
        if (seenUsernames.has(lowerUsername)) {
          status = "duplicate"
          error = "Duplicate username found"
          duplicateUsernames.add(lowerUsername)

          // Mark the first occurrence as duplicate too
          const firstIndex = seenUsernames.get(lowerUsername)!
          const firstUser = users.find((u) => u.index === firstIndex)
          if (firstUser && firstUser.status === "pending") {
            firstUser.status = "duplicate"
            firstUser.error = "Duplicate username found"
          }
        } else {
          seenUsernames.set(lowerUsername, index)
          status = "pending"
          validUsernameCount++
        }
      } else {
        error = "Invalid username format or not found"
      }

      users.push({
        originalValue,
        username,
        status,
        error,
        index,
      })
    })

    setProcessedUsers(users)
    setIsProcessing(false)

    const invalidCount = users.filter((u) => u.status === "invalid").length
    const duplicateCount = users.filter((u) => u.status === "duplicate").length

    const repositoryMessage = repositoryUrl.trim()
      ? ` Repository analysis will be performed for valid users on: ${repositoryUrl.trim()}`
      : ""

    toast({
      title: "Processing Complete",
      description: `Processed ${users.length} entries. ${validUsernameCount} valid usernames, ${invalidCount} invalid, ${duplicateCount} duplicates.${repositoryMessage}`,
    })

    if (validUsernameCount > 0 && validUsernameCount <= 100) {
      toast({
        title: "Auto-validating",
        description: `${validUsernameCount} usernames found. Starting automatic validation${repositoryUrl.trim() ? " with repository analysis" : ""}...`,
      })
      setTimeout(() => validateWithGitHub(), 1000)
    }
  }, [parsedData, selectedColumn, repositoryUrl, toast]) // Added repositoryUrl to dependencies

  const retryFailedUsernames = useCallback(async () => {
    const failedUsers = processedUsers.filter(
      (user) => user.status === "error" && user.username && user.error?.includes("Rate limit exceeded"),
    )

    if (failedUsers.length === 0) {
      toast({
        title: "No failed usernames to retry",
        description: "All usernames have been processed successfully.",
      })
      return
    }

    const usernamesToRetry = failedUsers.map((user) => user.username!).filter(Boolean)

    toast({
      title: "Retrying failed usernames",
      description: `Retrying ${usernamesToRetry.length} failed usernames...`,
    })

    // Mark failed users as pending for retry
    setProcessedUsers((prev) =>
      prev.map((user) =>
        failedUsers.some((failed) => failed.username === user.username)
          ? { ...user, status: "pending" as const, error: undefined }
          : user,
      ),
    )

    // Start validation for retry
    await validateSpecificUsernames(usernamesToRetry)
  }, [processedUsers, toast])

  const fetchRepositoryEngagementData = useCallback(
    async ({
      usernames,
      repositoryUrl,
      signal,
      mode,
    }: {
      usernames: string[]
      repositoryUrl: string
      signal?: AbortSignal
      mode?: EngagementMode
    }): Promise<RepositoryEngagementUser[] | null> => {
      const trimmedRepositoryUrl = repositoryUrl.trim()
      if (!trimmedRepositoryUrl || usernames.length === 0) {
        return null
      }

      const uniqueUsernames: string[] = []
      const seen = new Set<string>()
      usernames.forEach((username) => {
        if (!username) return
        const key = username.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          uniqueUsernames.push(username)
        }
      })

      if (uniqueUsernames.length === 0) {
        return null
      }

      const repoBatchSize = 100
      const aggregated: RepositoryEngagementUser[] = []
      const token = githubToken.trim()

      for (let i = 0; i < uniqueUsernames.length; i += repoBatchSize) {
        if (signal?.aborted) {
          return null
        }

        const batch = uniqueUsernames.slice(i, i + repoBatchSize)
        const requestBody: Record<string, any> = {
          repositoryUrl: trimmedRepositoryUrl,
          usernames: batch,
          checkMode: mode || "both",
        }
        if (token) {
          requestBody.githubToken = token
        }

        const response = await fetch("/api/check-repository-engagement", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal,
        })

        if (!response.ok) {
          const errorPayload = await response.text()
          let parsedError: any = null
          try {
            parsedError = JSON.parse(errorPayload)
          } catch {
            parsedError = null
          }
          throw new Error(parsedError?.error || errorPayload || "Repository engagement request failed")
        }

        const batchData = await response.json()
        aggregated.push(...((batchData.users || []) as RepositoryEngagementUser[]))

        if (i + repoBatchSize < uniqueUsernames.length) {
          await new Promise((resolve) => setTimeout(resolve, 800))
        }
      }

      return aggregated
    },
    [githubToken],
  )

  const validateSpecificUsernames = useCallback(
    async (usernames: string[]) => {
      if (usernames.length === 0) return

      const controller = new AbortController()
      setValidationController(controller)
      setIsValidating(true)
      setValidationProgress(0)
      setIsPaused(false)

      const trimmedRepositoryUrl = repositoryUrl.trim()
      const trimmedGithubToken = githubToken.trim()

      console.log("Starting validation with repository URL:", repositoryUrl.trim())
      console.log("GitHub token present:", !!trimmedGithubToken)
      console.log("Usernames to validate:", usernames.length)

      try {
        const apiEndpoint = "/api/validate-github-batch"
        const validationStartTime = Date.now()

        // ─── Phase 1: Validate usernames in real batches ───
        // Split into batches for real progress tracking (max 200 per batch for GraphQL, 50 for REST)
        const batchSize = trimmedGithubToken ? 200 : 50
        const validationBatches: string[][] = []
        for (let i = 0; i < usernames.length; i += batchSize) {
          validationBatches.push(usernames.slice(i, i + batchSize))
        }

        // Total steps: validation batches + (optional) engagement batches
        const totalValidationBatches = validationBatches.length
        // Engagement phase will take roughly same weight as validation
        const hasEngagementPhase = !!trimmedRepositoryUrl
        const totalWeight = totalValidationBatches + (hasEngagementPhase ? Math.max(1, Math.ceil(totalValidationBatches * 0.3)) : 0)
        let completedWeight = 0

        setBatchProgress({ current: 0, total: totalValidationBatches })
        setStartTime(validationStartTime)
        initialEstimatedTimeRef.current = 0 // Will be calculated from actual elapsed time

        const allResults: any[] = []

        for (let i = 0; i < validationBatches.length; i++) {
          if (controller.signal.aborted) throw new Error("Cancelled")
          while (isPaused && !controller.signal.aborted) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }

          const batch = validationBatches[i]
          setBatchProgress({ current: i + 1, total: totalValidationBatches })

          try {
            const requestBody: any = {
              usernames: batch,
              method: trimmedGithubToken ? "auto" : "rest",
            }
            if (trimmedGithubToken) requestBody.githubToken = trimmedGithubToken

            const response = await fetch(apiEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
              signal: controller.signal,
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              if (response.status === 429) {
                const waitTime = Math.min(120000, 15000 * Math.pow(2, Math.min(i, 3)))
                toast({
                  title: "Rate Limited",
                  description: `Waiting ${Math.round(waitTime / 1000)}s before retrying…`,
                })
                await new Promise((resolve) => setTimeout(resolve, waitTime))
                i-- // Retry
                continue
              }
              throw new Error(errorData.error || "Validation failed")
            }

            const { results, rateLimit, cacheStats: cache, method } = await response.json()
            if (rateLimit) setRateLimitInfo(rateLimit)
            if (cache) setCacheStats(cache)
            if (method) setValidationMethod(method)
            allResults.push(...results)
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") throw err
            // Mark entire batch as error
            batch.forEach((username) => {
              allResults.push({ username, status: "error", error: err instanceof Error ? err.message : "Failed" })
            })
          }

          completedWeight++
          const realProgress = Math.round((completedWeight / totalWeight) * 100)
          setValidationProgress(Math.min(realProgress, hasEngagementPhase ? 90 : 100))

          // Calculate real estimated time from actual elapsed
          const elapsed = (Date.now() - validationStartTime) / 1000
          const remaining = (elapsed / completedWeight) * (totalWeight - completedWeight)
          setEstimatedTime(Math.max(0, remaining))

          // Update processed users incrementally
          setProcessedUsers((prev) =>
            prev.map((user) => {
              if (user.username && usernames.includes(user.username)) {
                const result = allResults.find((r: any) => r.username === user.username)
                if (result) {
                  return { ...user, status: result.status, error: result.error, profileData: result.profileData }
                }
              }
              return user
            }),
          )

          // Small delay between batches to respect rate limits
          if (i < validationBatches.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, trimmedGithubToken ? 200 : 1000))
          }
        }

        // ─── Phase 2: Repository engagement (if configured) ───
        let repositoryEngagementUsers: RepositoryEngagementUser[] | null = null
        if (trimmedRepositoryUrl) {
          const validUsernames = allResults.filter((r: any) => r.status === "valid").map((r: any) => r.username)

          if (validUsernames.length > 0) {
            try {
              repositoryEngagementUsers = await fetchRepositoryEngagementData({
                usernames: validUsernames,
                repositoryUrl: trimmedRepositoryUrl,
                signal: controller.signal,
                mode: engagementMode,
              })

              if (repositoryEngagementUsers?.length) {
                const starredCount = repositoryEngagementUsers.filter((u) => u.hasStarred).length
                const forkedCount = repositoryEngagementUsers.filter((u) => u.hasForked).length
                toast({
                  title: "Repository Analysis Complete",
                  description: `${starredCount} starred, ${forkedCount} forked.`,
                })
              }
            } catch (repoError) {
              console.error("Repository engagement check failed:", repoError)
              toast({
                title: "Repository Analysis Failed",
                description: "Validation completed but engagement analysis encountered an error.",
                variant: "destructive",
              })
            }
          }
        }

        // ─── Final: Update all results at once ───
        setValidationProgress(100)
        setEstimatedTime(null)
        setStartTime(null)
        initialEstimatedTimeRef.current = 0
        setBatchProgress({ current: 0, total: 0 })

        setProcessedUsers((prev) =>
          prev.map((user) => {
            if (user.username && usernames.includes(user.username)) {
              const result = allResults.find((r: any) => r.username === user.username)
              if (result) {
                let repositoryEngagement = undefined
                if (repositoryEngagementUsers && result.status === "valid") {
                  const engagementUser = repositoryEngagementUsers.find(
                    (u) => u.username.toLowerCase() === user.username?.toLowerCase(),
                  )
                  if (engagementUser) {
                    repositoryEngagement = {
                      hasStarred: engagementUser.hasStarred,
                      hasFork: engagementUser.hasForked,
                      repositoryUrl: trimmedRepositoryUrl,
                    }
                  }
                }
                return { ...user, status: result.status, error: result.error, profileData: result.profileData, repositoryEngagement }
              }
            }
            return user
          }),
        )

        const validCount = allResults.filter((r: any) => r.status === "valid").length
        const errorCount = allResults.filter((r: any) => r.status === "error").length
        toast({
          title: "Validation Complete",
          description: `${allResults.length} processed: ${validCount} valid, ${errorCount} errors`,
        })

        setEstimatedTime(null)
        setStartTime(null)
        initialEstimatedTimeRef.current = 0
      } catch (error) {
        console.error("Validation error:", error)
        toast({
          title: "Validation Failed",
          description: error instanceof Error ? error.message : "Failed to validate usernames",
          variant: "destructive",
        })
      } finally {
        setIsValidating(false)
        setValidationController(null)
        setIsPaused(false)
        setEstimatedTime(null)
        setStartTime(null)
        initialEstimatedTimeRef.current = 0
        setBatchProgress({ current: 0, total: 0 })
      }
    },
    [engagementMode, fetchRepositoryEngagementData, githubToken, isPaused, repositoryUrl, toast],
  )

  const pauseValidation = useCallback(() => {
    setIsPaused(true)
    toast({
      title: "Validation Paused",
      description: "You can resume or cancel the validation process",
    })
  }, [toast])

  const resumeValidation = useCallback(() => {
    setIsPaused(false)
    toast({
      title: "Validation Resumed",
      description: "Continuing with username validation",
    })
  }, [toast])

  const cancelValidation = useCallback(() => {
    if (validationController) {
      validationController.abort()
    }
    setIsValidating(false)
    setIsPaused(false)
    setValidationController(null)
    setBatchProgress({ current: 0, total: 0 })
    setEstimatedTime(null)
    setStartTime(null)
    initialEstimatedTimeRef.current = 0
  }, [validationController])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) {
        handleFileUpload(droppedFile)
      }
    },
    [handleFileUpload],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const processManualInput = useCallback(() => {
    if (!manualInput.trim()) return

    setIsProcessingManual(true)

    const lines = manualInput.split("\n").filter((line) => line.trim())
    const users: ProcessedUser[] = []
    const seenUsernames = new Set<string>()
    const duplicateUsernames = new Set<string>()

    lines.forEach((line, index) => {
      const originalValue = line.trim()
      const username = extractUsername(originalValue)

      if (username) {
        const lowerUsername = username.toLowerCase()
        if (seenUsernames.has(lowerUsername)) {
          duplicateUsernames.add(lowerUsername)
        } else {
          seenUsernames.add(lowerUsername)
        }
      }

      users.push({
        originalValue,
        username,
        status: username ? "pending" : "invalid",
        error: username ? undefined : "Invalid username format",
        index,
      })
    })

    users.forEach((user) => {
      if (user.username && duplicateUsernames.has(user.username.toLowerCase())) {
        user.status = "duplicate"
        user.error = "Duplicate username found"
      }
    })

    setProcessedUsers(users)
    setParsedData(null) // Clear file data when using manual input
    setIsProcessingManual(false)

    const repositoryMessage = repositoryUrl.trim()
      ? ` Repository analysis will be performed for valid users on: ${repositoryUrl.trim()}`
      : ""

    toast({
      title: "Manual Input Processed",
      description: `Processed ${users.length} entries. Found ${duplicateUsernames.size} duplicates.${repositoryMessage}`,
    })
  }, [manualInput, repositoryUrl, toast]) // Added repositoryUrl to dependencies

  const clearGithubToken = useCallback(() => {
    setGithubToken("")
    toast({
      title: "Token Removed",
      description: "GitHub token has been cleared. Rate limits will be reduced to 60 requests/hour.",
    })
  }, [toast])

  const validateWithGitHub = useCallback(async () => {
    if (processedUsers.length === 0) return

    const usersToValidate = processedUsers.filter((user) => user.status === "pending" && user.username)

    if (usersToValidate.length === 0) {
      toast({
        title: "No usernames to validate",
        description: "All usernames are either invalid or duplicates.",
        variant: "destructive",
      })
      return
    }

    setIsValidatingGitHub(true)
    try {
      const usernames = usersToValidate.map((user) => user.username!).filter(Boolean)
      await validateSpecificUsernames(usernames)
    } finally {
      setIsValidatingGitHub(false)
    }
  }, [processedUsers, validateSpecificUsernames, toast])

  const rerunRepositoryEngagement = useCallback(
    async (targetUsernames?: string[]) => {
      const trimmedRepositoryUrl = repositoryUrl.trim()
      if (!trimmedRepositoryUrl) {
        toast({
          title: "Repository URL required",
          description: "Please provide a repository URL before re-running engagement checks.",
          variant: "destructive",
        })
        return
      }

      const fallbackTargets = targetUsernames?.length
        ? targetUsernames
        : processedUsers.filter((user) => user.status === "valid" && user.username).map((user) => user.username!)

      const uniqueTargets: string[] = []
      const seen = new Set<string>()
      fallbackTargets.forEach((username) => {
        if (!username) return
        const key = username.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          uniqueTargets.push(username)
        }
      })

      if (uniqueTargets.length === 0) {
        toast({
          title: "No users to refresh",
          description: "There are no valid usernames available for a repository re-check.",
        })
        return
      }

      setIsRecheckingEngagement(true)
      try {
        const engagementUsers = await fetchRepositoryEngagementData({
          usernames: uniqueTargets,
          repositoryUrl: trimmedRepositoryUrl,
          mode: engagementMode,
        })

        if (!engagementUsers || engagementUsers.length === 0) {
          toast({
            title: "No engagement updates",
            description: "The re-run completed but no engagement data was returned.",
          })
          return
        }

        setProcessedUsers((prev) => {
          const updated = prev.map((user) => {
            if (!user.username) return user
            const engagementUser = engagementUsers.find(
              (engagement) => engagement.username.toLowerCase() === user.username?.toLowerCase(),
            )
            if (!engagementUser) return user

            // Create new object to ensure React detects the change
            return {
              ...user,
              repositoryEngagement: {
                hasStarred: engagementUser.hasStarred,
                hasFork: engagementUser.hasForked,
                repositoryUrl: trimmedRepositoryUrl,
              },
            }
          })
          return updated
        })

        const starredCount = engagementUsers.filter((u) => u.hasStarred).length
        const forkedCount = engagementUsers.filter((u) => u.hasForked).length
        toast({
          title: "Repository engagement refreshed",
          description: `Re-checked ${engagementUsers.length} users: ${starredCount} starred, ${forkedCount} forked.`,
        })
      } catch (error) {
        console.error("Repository engagement re-run failed", error)
        toast({
          title: "Re-run failed",
          description: error instanceof Error ? error.message : "Unable to refresh repository engagement.",
          variant: "destructive",
        })
      } finally {
        setIsRecheckingEngagement(false)
      }
    },
    [engagementMode, fetchRepositoryEngagementData, processedUsers, repositoryUrl, toast],
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 space-y-6">
        <AppHeader />

        <GitHubAuthSection
          githubToken={githubToken}
          setGithubToken={setGithubToken}
          repositoryUrl={repositoryUrl}
          setRepositoryUrl={setRepositoryUrl}
          engagementMode={engagementMode}
          setEngagementMode={setEngagementMode}
          rateLimitInfo={rateLimitInfo}
          cacheStats={cacheStats}
          validationMethod={validationMethod}
          onClearToken={clearGithubToken}
        />

        <InputSection
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          file={file}
          parsedData={parsedData}
          selectedColumn={selectedColumn}
          setSelectedColumn={setSelectedColumn}
          manualInput={manualInput}
          setManualInput={setManualInput}
          isUploadingFile={isUploadingFile}
          isProcessingManual={isProcessingManual}
          isProcessing={isProcessing}
          onFileUpload={handleFileUpload}
          onProcessUsernames={processUsernames}
          onProcessManualInput={processManualInput}
        />

        <ResultsDashboard
          users={processedUsers}
          onValidate={validateWithGitHub}
          isValidating={isValidating || isValidatingGitHub} // Include both validation states
          validationProgress={validationProgress}
          batchProgress={batchProgress.total > 0 ? batchProgress : undefined}
          isPaused={isPaused}
          onPause={pauseValidation}
          onResume={resumeValidation}
          onCancel={cancelValidation}
          estimatedTime={estimatedTime}
          onRetryFailed={retryFailedUsernames}
          onRecheckEngagement={rerunRepositoryEngagement}
          isRecheckingEngagement={isRecheckingEngagement}
          repositoryUrl={repositoryUrl.trim() || undefined}
        />
      </div>
    </div>
  )
}

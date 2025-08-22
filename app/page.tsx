"use client"

import type React from "react"
import { useState, useCallback, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { AppHeader } from "@/components/app-header"
import { GitHubAuthSection } from "@/components/github-auth-section"
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
  const [isValidatingGitHub, setIsValidatingGitHub] = useState(false) // Added loading state for Process GitHub Usernames button
  const { toast } = useToast()

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isValidating && estimatedTime && !isPaused && startTime) {
      interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000
        const remaining = Math.max(0, estimatedTime - elapsed)
        setEstimatedTime(remaining)

        if (remaining <= 0) {
          setEstimatedTime(null)
        }
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isValidating, estimatedTime, isPaused, startTime])

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

  const validateSpecificUsernames = useCallback(
    async (usernames: string[]) => {
      if (usernames.length === 0) return

      const controller = new AbortController()
      setValidationController(controller)
      setIsValidating(true)
      setValidationProgress(0)
      setIsPaused(false)

      console.log("Starting validation with repository URL:", repositoryUrl.trim())
      console.log("GitHub token present:", !!githubToken.trim())
      console.log("Usernames to validate:", usernames.length)

      try {
        const useBatchAPI = usernames.length >= 10 || githubToken.trim()
        const apiEndpoint = useBatchAPI ? "/api/validate-github-batch" : "/api/validate-github"

        let estimatedSeconds: number
        if (useBatchAPI && githubToken.trim()) {
          // GraphQL batching: ~20 requests for 2000 users
          estimatedSeconds = Math.ceil(usernames.length / 100) * 2 + 5
        } else if (useBatchAPI) {
          // REST parallel: faster than sequential
          estimatedSeconds = Math.ceil(usernames.length / 20) * 3 + 10
        } else {
          // Sequential REST (old method)
          estimatedSeconds = usernames.length * 2.5 + Math.ceil(usernames.length / 20) * 10
        }

        if (repositoryUrl.trim()) {
          estimatedSeconds += Math.ceil(usernames.length / 100) * 3 // Repository analysis time
        }

        setEstimatedTime(estimatedSeconds)
        setStartTime(Date.now())

        if (useBatchAPI) {
          const requestBody: any = {
            usernames,
            method: githubToken.trim() ? "auto" : "rest",
          }
          if (githubToken.trim()) {
            requestBody.githubToken = githubToken.trim()
          }

          console.log("Making batch API request to:", apiEndpoint)
          const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error("Batch validation failed:", errorData)
            throw new Error(errorData.error || "Batch validation failed")
          }

          const { results, rateLimit, cacheStats: cache, method } = await response.json()
          console.log("Batch validation completed, results:", results.length)

          setRateLimitInfo(rateLimit)
          setCacheStats(cache)
          setValidationMethod(method)

          let repositoryEngagementData: any = null
          if (repositoryUrl.trim()) {
            const validUsernames = results.filter((r: any) => r.status === "valid").map((r: any) => r.username)

            console.log("Repository URL provided:", repositoryUrl.trim())
            console.log("Valid usernames for repo analysis:", validUsernames.length)

            if (validUsernames.length > 0) {
              try {
                console.log("Starting repository engagement check...")

                const repoBatchSize = 100
                const repoResults: any[] = []

                for (let i = 0; i < validUsernames.length; i += repoBatchSize) {
                  const batch = validUsernames.slice(i, i + repoBatchSize)
                  console.log(
                    `Processing repository batch ${Math.floor(i / repoBatchSize) + 1}/${Math.ceil(validUsernames.length / repoBatchSize)}, size: ${batch.length}`,
                  )

                  const repoRequestBody = {
                    repositoryUrl: repositoryUrl.trim(),
                    usernames: batch,
                    githubToken: githubToken.trim() || undefined,
                  }

                  const repoResponse = await fetch("/api/check-repository-engagement", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(repoRequestBody),
                    signal: controller.signal,
                  })

                  if (repoResponse.ok) {
                    const batchData = await repoResponse.json()
                    repoResults.push(...batchData.users)
                    console.log(
                      `Repository batch ${Math.floor(i / repoBatchSize) + 1} completed, users: ${batchData.users.length}`,
                    )
                  } else {
                    let errorDetails
                    try {
                      errorDetails = await repoResponse.json()
                    } catch {
                      errorDetails = { error: await repoResponse.text() }
                    }
                    console.error(`Repository batch ${Math.floor(i / repoBatchSize) + 1} failed:`, errorDetails)
                  }

                  // Small delay between batches
                  if (i + repoBatchSize < validUsernames.length) {
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                  }
                }

                if (repoResults.length > 0) {
                  repositoryEngagementData = {
                    users: repoResults,
                    summary: {
                      starred: repoResults.filter((u) => u.hasStarred).length,
                      forked: repoResults.filter((u) => u.hasForked).length,
                      total: repoResults.length,
                      errors: 0,
                    },
                  }

                  console.log("Repository engagement data received:", {
                    totalUsers: repositoryEngagementData.users.length,
                    starred: repositoryEngagementData.summary.starred,
                    forked: repositoryEngagementData.summary.forked,
                  })

                  toast({
                    title: "Repository Analysis Complete",
                    description: `Found ${repositoryEngagementData.summary.starred} users who starred and ${repositoryEngagementData.summary.forked} who forked the repository.`,
                  })
                } else {
                  console.log("No repository engagement data received")
                }
              } catch (repoError) {
                console.error("Repository engagement check failed:", repoError)
                toast({
                  title: "Repository Analysis Failed",
                  description: "Username validation completed, but repository analysis encountered an error.",
                  variant: "destructive",
                })
              }
            } else {
              console.log("No valid usernames found for repository analysis")
            }
          }

          setValidationProgress(100)
          setEstimatedTime(null)
          setStartTime(null)

          setProcessedUsers((prev) => {
            const updatedUsers = prev.map((user) => {
              if (user.username && usernames.includes(user.username)) {
                const result = results.find((r: any) => r.username === user.username)
                if (result) {
                  let repositoryEngagement = undefined
                  if (repositoryEngagementData && result.status === "valid") {
                    const engagementUser = repositoryEngagementData.users.find(
                      (u: any) => u.username.toLowerCase() === user.username?.toLowerCase(),
                    )
                    if (engagementUser) {
                      repositoryEngagement = {
                        hasStarred: engagementUser.hasStarred,
                        hasFork: engagementUser.hasForked,
                        repositoryUrl: repositoryUrl.trim(),
                      }
                      console.log("Added repository engagement for user:", user.username, repositoryEngagement)
                    }
                  }

                  return {
                    ...user,
                    status: result.status,
                    error: result.error,
                    profileData: result.profileData,
                    repositoryEngagement,
                  }
                }
              }
              return user
            })

            const usersWithRepoData = updatedUsers.filter((u) => u.repositoryEngagement)
            console.log("Final users with repository engagement data:", usersWithRepoData.length)
            if (usersWithRepoData.length > 0) {
              console.log("Sample repository engagement:", usersWithRepoData[0]?.repositoryEngagement)
            }

            return updatedUsers
          })
        } else {
          const chunkSize = 20
          const chunks: string[][] = []

          for (let i = 0; i < usernames.length; i += chunkSize) {
            chunks.push(usernames.slice(i, i + chunkSize))
          }

          setBatchProgress({ current: 0, total: chunks.length })

          const allResults: any[] = []
          let processedCount = 0
          const startTime = Date.now()

          for (let i = 0; i < chunks.length; i++) {
            if (controller.signal.aborted) {
              throw new Error("Validation cancelled by user")
            }

            while (isPaused && !controller.signal.aborted) {
              await new Promise((resolve) => setTimeout(resolve, 1000))
            }

            const chunk = chunks[i]
            setBatchProgress({ current: i + 1, total: chunks.length })

            try {
              const requestBody: any = { usernames: chunk }
              if (githubToken.trim()) {
                requestBody.githubToken = githubToken.trim()
              }

              const response = await fetch(apiEndpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
              })

              if (!response.ok) {
                const errorData = await response.json()

                if (response.status === 429) {
                  const waitTime = Math.min(300000, 30000 * Math.pow(2, Math.min(i, 4)))

                  toast({
                    title: "Rate Limited",
                    description: `Waiting ${Math.round(waitTime / 1000)}s before continuing...`,
                  })

                  await new Promise((resolve) => setTimeout(resolve, waitTime))
                  i-- // Retry the same chunk
                  continue
                }

                throw new Error(errorData.error || "Validation failed")
              }

              const { results, rateLimit } = await response.json()
              if (rateLimit) setRateLimitInfo(rateLimit)

              allResults.push(...results)
              processedCount += chunk.length

              const progress = Math.round((processedCount / usernames.length) * 100)
              setValidationProgress(progress)

              const elapsedTime = (Date.now() - startTime) / 1000
              const remainingUsernames = usernames.length - processedCount
              const avgTimePerUsername = elapsedTime / processedCount
              setEstimatedTime(remainingUsernames * avgTimePerUsername)

              // Update specific usernames in the results
              setProcessedUsers((prev) =>
                prev.map((user) => {
                  if (user.username && usernames.includes(user.username)) {
                    const result = allResults.find((r: any) => r.username === user.username)
                    if (result) {
                      return {
                        ...user,
                        status: result.status,
                        error: result.error,
                        profileData: result.profileData,
                      }
                    }
                  }
                  return user
                }),
              )

              if (i < chunks.length - 1) {
                const delay = 10000
                await new Promise((resolve) => setTimeout(resolve, delay))
              }
            } catch (chunkError) {
              if (chunkError instanceof Error && chunkError.name === "AbortError") {
                throw chunkError
              }

              const errorResults = chunk.map((username) => ({
                username,
                status: "error" as const,
                error: chunkError instanceof Error ? chunkError.message : "Processing failed",
              }))
              allResults.push(...errorResults)
            }
          }

          if (repositoryUrl.trim()) {
            const validUsernames = allResults.filter((r: any) => r.status === "valid").map((r: any) => r.username)

            if (validUsernames.length > 0) {
              try {
                console.log("Starting repository engagement check for sequential validation...")
                const repoRequestBody = {
                  repositoryUrl: repositoryUrl.trim(),
                  usernames: validUsernames,
                  githubToken: githubToken.trim() || undefined,
                }
                console.log("Repository request body:", {
                  repositoryUrl: repoRequestBody.repositoryUrl,
                  usernamesCount: repoRequestBody.usernames.length,
                  hasToken: !!repoRequestBody.githubToken,
                  sampleUsernames: repoRequestBody.usernames.slice(0, 3),
                })

                const repoResponse = await fetch("/api/check-repository-engagement", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(repoRequestBody),
                  signal: controller.signal,
                })

                if (repoResponse.ok) {
                  const repositoryEngagementData = await repoResponse.json()
                  console.log(
                    "Repository engagement data for sequential validation:",
                    repositoryEngagementData.summary,
                  )

                  // Update users with repository engagement data
                  setProcessedUsers((prev) =>
                    prev.map((user) => {
                      if (user.username && user.status === "valid") {
                        const engagementUser = repositoryEngagementData.users.find(
                          (u: any) => u.username.toLowerCase() === user.username?.toLowerCase(),
                        )
                        if (engagementUser) {
                          return {
                            ...user,
                            repositoryEngagement: {
                              hasStarred: engagementUser.hasStarred,
                              hasFork: engagementUser.hasForked,
                              repositoryUrl: repositoryUrl.trim(),
                            },
                          }
                        }
                      }
                      return user
                    }),
                  )

                  toast({
                    title: "Repository Analysis Complete",
                    description: `Found ${repositoryEngagementData.summary.starred} users who starred and ${repositoryEngagementData.summary.forked} who forked the repository.`,
                  })
                }
              } catch (repoError) {
                console.error("Repository engagement check failed in sequential validation:", repoError)
              }
            }
          }

          setValidationProgress(100)
          setBatchProgress({ current: 0, total: 0 })

          const validCount = allResults.filter((r: any) => r.status === "valid").length
          const errorCount = allResults.filter((r: any) => r.status === "error").length

          toast({
            title: "Validation Complete",
            description: `Processed ${allResults.length} usernames: ${validCount} valid, ${errorCount} errors`,
          })
        }

        setEstimatedTime(null)
        setStartTime(null)
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
        setBatchProgress({ current: 0, total: 0 })
      }
    },
    [githubToken, isPaused, repositoryUrl, toast],
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

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <AppHeader />

        <GitHubAuthSection
          githubToken={githubToken}
          setGithubToken={setGithubToken}
          repositoryUrl={repositoryUrl}
          setRepositoryUrl={setRepositoryUrl}
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
        />
      </div>
    </div>
  )
}

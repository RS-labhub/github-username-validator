import { type NextRequest, NextResponse } from "next/server"

interface ValidationRequest {
  usernames: string[]
  githubToken?: string
  method?: "graphql" | "rest" | "auto"
}

interface ValidationResult {
  username: string
  status: "valid" | "invalid" | "deleted" | "error"
  error?: string
  profileData?: {
    name?: string
    bio?: string
    public_repos: number
    followers: number
    following: number
    created_at: string
  }
}

interface CacheEntry {
  result: ValidationResult
  timestamp: number
}

const validationCache = new Map<string, CacheEntry>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string, hasToken: boolean): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const limit = rateLimitMap.get(ip)
  const maxRequests = hasToken ? 5000 : 60 // GitHub's actual limits

  if (!limit || now > limit.resetTime) {
    const resetTime = now + 60 * 60 * 1000 // 1 hour
    rateLimitMap.set(ip, { count: 1, resetTime })
    return { allowed: true, remaining: maxRequests - 1, resetTime }
  }

  if (limit.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: limit.resetTime }
  }

  limit.count++
  return {
    allowed: true,
    remaining: maxRequests - limit.count,
    resetTime: limit.resetTime,
  }
}

async function validateUsernamesGraphQL(usernames: string[], githubToken: string): Promise<ValidationResult[]> {
  try {
    // Build dynamic GraphQL query with aliases
    const aliases = usernames
      .map(
        (username, index) => `
          user${index}: user(login: "${username}") {
            login
            name
            bio
            repositories(privacy: PUBLIC) { totalCount }
            followers { totalCount }
            following { totalCount }
            createdAt
          }
        `,
      )
      .join("\n")

    const query = `
        query BatchUserValidation {
          ${aliases}
          rateLimit {
            limit
            remaining
            resetAt
          }
        }
      `

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "User-Agent": "GitHub-Username-Validator",
      },
      body: JSON.stringify({ query }),
    })

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`)
    }

    const data = await response.json()

    // Don't throw — errors may just mean some users don't exist
    const errors = data.errors || []
    if (errors.length > 0) {
      console.warn(
        "GraphQL returned errors:",
        errors.map((e: any) => e.message),
      )
    }

    const results: ValidationResult[] = []

    usernames.forEach((username, index) => {
      const alias = `user${index}`
      const userData = data.data?.[alias]

      // Check if GraphQL flagged this alias as NOT_FOUND
      const notFound = errors.some((err: any) => err.path?.[0] === alias && err.type === "NOT_FOUND")

      if (userData) {
        results.push({
          username,
          status: "valid",
          profileData: {
            name: userData.name,
            bio: userData.bio,
            public_repos: userData.repositories.totalCount,
            followers: userData.followers.totalCount,
            following: userData.following.totalCount,
            created_at: userData.createdAt,
          },
        })
      } else if (notFound) {
        results.push({
          username,
          status: "deleted",
          error: "User not found or account deleted",
        })
      } else {
        results.push({
          username,
          status: "error",
          error: "Unexpected GraphQL error",
        })
      }
    })

    return results
  } catch (error) {
    console.error("GraphQL validation failed:", error)
    throw error
  }
}

async function validateUsernamesREST(
  usernames: string[],
  githubToken?: string,
  concurrency = 20,
): Promise<ValidationResult[]> {
  const headers: Record<string, string> = {
    "User-Agent": "GitHub-Username-Validator",
    Accept: "application/vnd.github.v3+json",
  }

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`
  }

  // Simple concurrency control
  const results: ValidationResult[] = []
  const chunks = []

  for (let i = 0; i < usernames.length; i += concurrency) {
    chunks.push(usernames.slice(i, i + concurrency))
  }

  for (const chunk of chunks) {
    const chunkPromises = chunk.map(async (username) => {
      try {
        const response = await fetch(`https://api.github.com/users/${username}`, { headers })

        if (response.status === 200) {
          const userData = await response.json()
          return {
            username,
            status: "valid" as const,
            profileData: {
              name: userData.name,
              bio: userData.bio,
              public_repos: userData.public_repos,
              followers: userData.followers,
              following: userData.following,
              created_at: userData.created_at,
            },
          }
        } else if (response.status === 404) {
          return {
            username,
            status: "deleted" as const,
            error: "User not found or account deleted",
          }
        } else if (response.status === 403) {
          return {
            username,
            status: "error" as const,
            error: "Rate limit exceeded - please wait",
          }
        } else {
          return {
            username,
            status: "error" as const,
            error: `HTTP ${response.status}: ${response.statusText}`,
          }
        }
      } catch (error) {
        return {
          username,
          status: "error" as const,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    })

    const chunkResults = await Promise.all(chunkPromises)
    results.push(...chunkResults)

    // Small delay between chunks to respect rate limits
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return results
}

function getCachedResult(username: string): ValidationResult | null {
  const cached = validationCache.get(username)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.result
  }
  return null
}

function setCachedResult(username: string, result: ValidationResult): void {
  validationCache.set(username, {
    result,
    timestamp: Date.now(),
  })
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown"
    const body: ValidationRequest = await request.json()
    const { usernames, githubToken, method = "auto" } = body

    if (!Array.isArray(usernames) || usernames.length === 0) {
      return NextResponse.json({ error: "Invalid request: usernames array is required" }, { status: 400 })
    }

    if (usernames.length > 5000) {
      return NextResponse.json({ error: "Too many usernames. Maximum 5000 per request." }, { status: 400 })
    }

    const rateLimit = checkRateLimit(ip, !!githubToken)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          resetTime: rateLimit.resetTime,
          remaining: rateLimit.remaining,
        },
        { status: 429 },
      )
    }

    const cachedResults: ValidationResult[] = []
    const uncachedUsernames: string[] = []

    usernames.forEach((username) => {
      const cached = getCachedResult(username)
      if (cached) {
        cachedResults.push(cached)
      } else {
        uncachedUsernames.push(username)
      }
    })

    let uncachedResults: ValidationResult[] = []
    let useGraphQL = false // Declare useGraphQL variable

    if (uncachedUsernames.length > 0) {
      if (method === "graphql" || (method === "auto" && githubToken && uncachedUsernames.length >= 10)) {
        useGraphQL = true
      }

      try {
        if (useGraphQL && githubToken) {
          // Process in batches of 100 for GraphQL
          const batches = []
          for (let i = 0; i < uncachedUsernames.length; i += 100) {
            batches.push(uncachedUsernames.slice(i, i + 100))
          }

          for (const batch of batches) {
            const batchResults = await validateUsernamesGraphQL(batch, githubToken)
            uncachedResults.push(...batchResults)

            // Cache results
            batchResults.forEach((result) => setCachedResult(result.username, result))
          }
        } else {
          // Fall back to parallel REST
          uncachedResults = await validateUsernamesREST(uncachedUsernames, githubToken)

          // Cache results
          uncachedResults.forEach((result) => setCachedResult(result.username, result))
        }
      } catch (error) {
        console.error("Primary validation method failed, falling back to REST:", error)

        if (useGraphQL) {
          // Fallback to REST if GraphQL fails
          uncachedResults = await validateUsernamesREST(uncachedUsernames, githubToken)
          uncachedResults.forEach((result) => setCachedResult(result.username, result))
        } else {
          throw error
        }
      }
    }

    const allResults: ValidationResult[] = []
    usernames.forEach((username) => {
      const cached = cachedResults.find((r) => r.username === username)
      const uncached = uncachedResults.find((r) => r.username === username)
      allResults.push(cached || uncached!)
    })

    return NextResponse.json({
      results: allResults,
      rateLimit: {
        remaining: rateLimit.remaining,
        resetTime: rateLimit.resetTime,
        limit: githubToken ? 5000 : 60,
      },
      cacheStats: {
        cached: cachedResults.length,
        validated: uncachedResults.length,
        total: usernames.length,
      },
      method: useGraphQL ? "graphql" : "rest",
    })
  } catch (error) {
    console.error("Batch validation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"

interface ValidationRequest {
  usernames: string[]
  githubToken?: string
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

// Rate limiting: GitHub allows 60 requests per hour for unauthenticated requests
// We'll be more conservative and allow 30 requests per hour with proper delays
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const limit = rateLimitMap.get(ip)

  if (!limit || now > limit.resetTime) {
    const resetTime = now + 60 * 60 * 1000 // 1 hour
    rateLimitMap.set(ip, { count: 1, resetTime })
    return { allowed: true, remaining: 29, resetTime }
  }

  if (limit.count >= 30) {
    return { allowed: false, remaining: 0, resetTime: limit.resetTime }
  }

  limit.count++
  return { allowed: true, remaining: 30 - limit.count, resetTime: limit.resetTime }
}

async function validateGitHubUsername(username: string, githubToken?: string): Promise<ValidationResult> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 2500))

    const headers: Record<string, string> = {
      "User-Agent": "GitHub-Username-Validator",
      Accept: "application/vnd.github.v3+json",
    }

    if (githubToken) {
      headers.Authorization = `token ${githubToken}`
    }

    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers,
    })

    if (response.status === 200) {
      const userData = await response.json()
      return {
        username,
        status: "valid",
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
        status: "deleted",
        error: "User not found or account deleted",
      }
    } else if (response.status === 403) {
      // Check if it's rate limiting or other forbidden access
      const errorData = await response.json().catch(() => ({}))
      if (errorData.message && errorData.message.includes("rate limit")) {
        return {
          username,
          status: "error",
          error: "Rate limit exceeded - please wait",
        }
      }
      return {
        username,
        status: "error",
        error: "Access forbidden - may be private or suspended account",
      }
    } else {
      return {
        username,
        status: "error",
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }
  } catch (error) {
    return {
      username,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || "unknown"
    const rateLimit = checkRateLimit(ip)

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

    const body: ValidationRequest = await request.json()
    const { usernames, githubToken } = body

    if (!Array.isArray(usernames) || usernames.length === 0) {
      return NextResponse.json({ error: "Invalid request: usernames array is required" }, { status: 400 })
    }

    if (usernames.length > 20) {
      return NextResponse.json({ error: "Too many usernames. Maximum 20 per request." }, { status: 400 })
    }

    const results: ValidationResult[] = []
    for (const username of usernames) {
      const result = await validateGitHubUsername(username, githubToken)
      results.push(result)
    }

    return NextResponse.json({
      results,
      rateLimit: {
        remaining: rateLimit.remaining - usernames.length,
        resetTime: rateLimit.resetTime,
      },
    })
  } catch (error) {
    console.error("Validation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

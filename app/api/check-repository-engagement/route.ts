import { type NextRequest, NextResponse } from "next/server";
import pLimit from "p-limit";

interface RepositoryEngagementRequest {
  repositoryUrl: string;
  usernames: string[];
  githubToken?: string;
}

interface UserEngagement {
  username: string;
  hasStarred: boolean;
  hasForked: boolean;
  error?: string;
}

interface RepositoryEngagementResponse {
  repository: {
    owner: string;
    repo: string;
    url: string;
  };
  users: UserEngagement[];
  summary: {
    totalUsers: number;
    starred: number;
    forked: number;
    errors: number;
  };
}

// --- Utility: Parse GitHub repo URL ---
function parseRepositoryUrl(
  url: string
): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
  };
}

// --- REST: Check one user ---
async function checkUserEngagement(
  username: string,
  targetOwner: string,
  targetRepo: string,
  token?: string
): Promise<{ hasStarred: boolean; hasForked: boolean; error?: string }> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "GitHub-Username-Validator",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    let hasStarred = false;
    let hasForked = false;

    // Check starred repos
    try {
      const starredRes = await fetch(
        `https://api.github.com/users/${username}/starred?per_page=100`,
        { headers }
      );
      if (starredRes.ok) {
        const repos = await starredRes.json();
        hasStarred = repos.some(
          (r: any) =>
            r.owner?.login?.toLowerCase() === targetOwner.toLowerCase() &&
            r.name?.toLowerCase() === targetRepo.toLowerCase()
        );
      }
    } catch (err) {
      console.error(`[REST] Starred check failed for ${username}`, err);
    }

    // Check forked repos
    try {
      const reposRes = await fetch(
        `https://api.github.com/users/${username}/repos?type=forks&per_page=100`,
        { headers }
      );
      if (reposRes.ok) {
        const repos = await reposRes.json();
        hasForked = repos.some(
          (r: any) =>
            r.fork &&
            r.parent &&
            r.parent.owner?.login?.toLowerCase() ===
              targetOwner.toLowerCase() &&
            r.parent.name?.toLowerCase() === targetRepo.toLowerCase()
        );
      }
    } catch (err) {
      console.error(`[REST] Fork check failed for ${username}`, err);
    }

    return { hasStarred, hasForked };
  } catch (error) {
    return {
      hasStarred: false,
      hasForked: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// --- Delay helper ---
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- GraphQL batching ---
async function checkUsersEngagementGraphQL(
  usernames: string[],
  targetOwner: string,
  targetRepo: string,
  token: string
): Promise<UserEngagement[]> {
  const results: UserEngagement[] = [];
  const chunkSize = 30;
  const limit = pLimit(5); // max 5 batches in parallel (safe for GitHub)

  const batches: string[][] = [];
  for (let i = 0; i < usernames.length; i += chunkSize) {
    batches.push(usernames.slice(i, i + chunkSize));
  }

  const batchPromises = batches.map((batch) =>
    limit(async () => {
      const query = `
        query {
          ${batch
            .map(
              (u, idx) => `
            user${idx}: user(login: "${u}") {
              login
              starredRepositories(first: 50, orderBy: {field: STARRED_AT, direction: DESC}) {
                nodes { nameWithOwner }
              }
              repositories(first: 50, isFork: true, orderBy: {field: CREATED_AT, direction: DESC}) {
                nodes {
                  name
                  owner { login }
                  parent { name owner { login } }
                }
              }
            }`
            )
            .join("\n")}
        }
      `;

      try {
        const res = await fetch("https://api.github.com/graphql", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });

        if (!res.ok) {
          console.warn(`[GraphQL failed: ${res.status}] → fallback REST`);
          return await checkUsersEngagementREST(batch, targetOwner, targetRepo, token);
        }

        const data = await res.json();
        const targetRepoName = `${targetOwner}/${targetRepo}`.toLowerCase();

        return batch.map((username, idx) => {
          const userData = data.data?.[`user${idx}`];
          if (!userData) {
            return { username, hasStarred: false, hasForked: false, error: "User not found" };
          }

          const hasStarred = userData.starredRepositories.nodes.some(
            (r: any) => r.nameWithOwner.toLowerCase() === targetRepoName
          );

          const hasForked = userData.repositories.nodes.some(
            (r: any) =>
              r.parent &&
              `${r.parent.owner.login}/${r.parent.name}`.toLowerCase() === targetRepoName
          );

          return { username, hasStarred, hasForked };
        });
      } catch (err) {
        console.warn(`[GraphQL exception] → fallback REST`, err);
        return await checkUsersEngagementREST(batch, targetOwner, targetRepo, token);
      }
    })
  );

  const settled = await Promise.all(batchPromises);
  settled.forEach((arr) => results.push(...arr));

  return results;
}

// --- REST batching ---
async function checkUsersEngagementREST(
  usernames: string[],
  targetOwner: string,
  targetRepo: string,
  token?: string
): Promise<UserEngagement[]> {
  const results: UserEngagement[] = [];
  const batchSize = token ? 20 : 5;
  const delayMs = token ? 300 : 1000;

  for (let i = 0; i < usernames.length; i += batchSize) {
    const batch = usernames.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(async (u) => {
        try {
          const r = await checkUserEngagement(
            u,
            targetOwner,
            targetRepo,
            token
          );
          return { username: u, ...r };
        } catch (err) {
          return {
            username: u,
            hasStarred: false,
            hasForked: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      })
    );

    batchResults.forEach((r) => {
      if (r.status === "fulfilled") results.push(r.value);
    });

    if (i + batchSize < usernames.length) {
      await delay(delayMs);
    }
  }
  return results;
}

// --- Next.js API handler ---
export async function POST(request: NextRequest) {
  try {
    const body: RepositoryEngagementRequest = await request.json();
    const { repositoryUrl, usernames, githubToken } = body;

    if (!repositoryUrl || !Array.isArray(usernames) || usernames.length === 0) {
      return NextResponse.json(
        { error: "Repository URL and usernames array are required" },
        { status: 400 }
      );
    }

    const parsed = parseRepositoryUrl(repositoryUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: `Invalid GitHub repository URL: ${repositoryUrl}` },
        { status: 400 }
      );
    }
    const { owner, repo } = parsed;

    let users: UserEngagement[] = [];

    // GraphQL path (fastest, for up to ~100 usernames per batch)
    if (githubToken && usernames.length <= 100) {
      try {
        users = await checkUsersEngagementGraphQL(
          usernames,
          owner,
          repo,
          githubToken
        );
      } catch (err) {
        console.warn(`[GraphQL failed] Falling back to REST`, err);
        users = await checkUsersEngagementREST(
          usernames,
          owner,
          repo,
          githubToken
        );
      }
    } else {
      users = await checkUsersEngagementREST(
        usernames,
        owner,
        repo,
        githubToken
      );
    }

    const summary = {
      totalUsers: users.length,
      starred: users.filter((u) => u.hasStarred).length,
      forked: users.filter((u) => u.hasForked).length,
      errors: users.filter((u) => u.error).length,
    };

    const response: RepositoryEngagementResponse = {
      repository: { owner, repo, url: repositoryUrl },
      users,
      summary,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Engagement API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

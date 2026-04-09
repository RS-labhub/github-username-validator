import { type NextRequest, NextResponse } from "next/server";

import pLimit from "p-limit";

interface RepositoryEngagementRequest {
  repositoryUrl: string;
  usernames: string[];
  githubToken?: string;
  checkMode?: "both" | "stars" | "forks";
}

interface UserEngagement {
  username: string;
  hasStarred: boolean;
  hasForked: boolean;
  error?: string;
}

interface RepositoryEngagementResponse {
  repository: { owner: string; repo: string; url: string };
  users: UserEngagement[];
  summary: { totalUsers: number; starred: number; forked: number; errors: number };
}

function parseRepositoryUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "").replace(/[?#].*$/, "") };
}

async function checkStarsGraphQL(
  usernames: string[],
  owner: string,
  repo: string,
  token: string
): Promise<Set<string>> {
  const found = new Set<string>();
  const targetFull = `${owner}/${repo}`.toLowerCase();
  const limit = pLimit(3);
  const batchSize = 8;
  const batches: string[][] = [];
  for (let i = 0; i < usernames.length; i += batchSize) {
    batches.push(usernames.slice(i, i + batchSize));
  }
  await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        const userQueries = batch
          .map(
            (u, idx) => `
          user${idx}: user(login: "${u}") {
            starredRepositories(first: 100, orderBy: {field: STARRED_AT, direction: DESC}) {
              nodes { nameWithOwner }
            }
          }`
          )
          .join("\n");
        const query: string = `query { ${userQueries} }`;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res: Response = await fetch("https://api.github.com/graphql", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "User-Agent": "GitHub-Username-Validator",
              },
              body: JSON.stringify({ query }),
            });
            if (res.status === 502 || res.status === 503) {
              if (attempt < 2) {
                await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
                continue;
              }
              break;
            }
            if (!res.ok) break;
            const data: any = await res.json();
            batch.forEach((username, idx) => {
              const ud = data?.data?.[`user${idx}`];
              if (!ud) return;
              const starred = ud.starredRepositories?.nodes || [];
              if (starred.some((r: any) => r?.nameWithOwner?.toLowerCase() === targetFull)) {
                found.add(username.toLowerCase());
              }
            });
            break;
          } catch {
            if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          }
        }
      })
    )
  );
  return found;
}

async function checkStarsREST(
  usernames: string[],
  owner: string,
  repo: string
): Promise<Set<string>> {
  const found = new Set<string>();
  const target = new Set(usernames.map((u) => u.toLowerCase()));
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "GitHub-Username-Validator" };
  const maxPages = 400;
  for (let page = 1; page <= maxPages; page++) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100&page=${page}`,
        { headers }
      );
      if (!res.ok) break;
      const data: any[] = await res.json();
      if (!data || data.length === 0) break;
      for (const u of data) {
        if (u?.login && target.has(u.login.toLowerCase())) {
          found.add(u.login.toLowerCase());
        }
      }
      if (found.size === target.size) return found;
      if (data.length < 100) break;
    } catch {
      break;
    }
  }
  return found;
}

async function checkForksGraphQL(
  usernames: string[],
  owner: string,
  repo: string,
  token: string
): Promise<Set<string>> {
  const found = new Set<string>();
  const targetFull = `${owner}/${repo}`.toLowerCase();
  const limit = pLimit(3);
  const batchSize = 15;
  const batches: string[][] = [];
  for (let i = 0; i < usernames.length; i += batchSize) {
    batches.push(usernames.slice(i, i + batchSize));
  }
  await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        const queries = batch
          .map(
            (u, idx) => `
          repo${idx}: repository(owner: "${u}", name: "${repo}") {
            isFork
            parent { nameWithOwner }
          }`
          )
          .join("\n");
        const query: string = `query { ${queries} }`;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res: Response = await fetch("https://api.github.com/graphql", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "User-Agent": "GitHub-Username-Validator",
              },
              body: JSON.stringify({ query }),
            });
            if (res.status === 502 || res.status === 503) {
              if (attempt < 2) {
                await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
                continue;
              }
              break;
            }
            if (!res.ok) break;
            const data: any = await res.json();
            batch.forEach((username, idx) => {
              const rd = data?.data?.[`repo${idx}`];
              if (rd?.isFork && rd.parent?.nameWithOwner?.toLowerCase() === targetFull) {
                found.add(username.toLowerCase());
              }
            });
            break;
          } catch {
            if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          }
        }
      })
    )
  );
  return found;
}

async function checkForksREST(
  usernames: string[],
  owner: string,
  repo: string
): Promise<Set<string>> {
  const found = new Set<string>();
  const targetFull = `${owner}/${repo}`.toLowerCase();
  const limit = pLimit(5);
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "GitHub-Username-Validator" };
  await Promise.all(
    usernames.map((username) =>
      limit(async () => {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${username}/${repo}`,
            { headers }
          );
          if (!res.ok) return;
          const rd: any = await res.json();
          if (
            rd.fork &&
            (rd.parent?.full_name?.toLowerCase() === targetFull ||
              rd.source?.full_name?.toLowerCase() === targetFull)
          ) {
            found.add(username.toLowerCase());
          }
        } catch {
          /* skip */
        }
      })
    )
  );
  return found;
}

export async function POST(request: NextRequest) {
  try {
    const body: RepositoryEngagementRequest = await request.json();
    const { repositoryUrl, usernames, githubToken, checkMode = "both" } = body;

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

    const [stargazers, forkers] = await Promise.all([
      checkMode !== "forks"
        ? githubToken
          ? checkStarsGraphQL(usernames, owner, repo, githubToken)
          : checkStarsREST(usernames, owner, repo)
        : Promise.resolve(new Set<string>()),
      checkMode !== "stars"
        ? githubToken
          ? checkForksGraphQL(usernames, owner, repo, githubToken)
          : checkForksREST(usernames, owner, repo)
        : Promise.resolve(new Set<string>()),
    ]);

    const users: UserEngagement[] = usernames.map((username) => {
      const lower = username.toLowerCase();
      return {
        username,
        hasStarred: stargazers.has(lower),
        hasForked: forkers.has(lower),
      };
    });

    const summary = {
      totalUsers: users.length,
      starred: users.filter((u) => u.hasStarred).length,
      forked: users.filter((u) => u.hasForked).length,
      errors: 0,
    };

    return NextResponse.json({
      repository: { owner, repo, url: repositoryUrl },
      users,
      summary,
    } as RepositoryEngagementResponse);
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

import { Users, UserCheck, UserX, Shield, XCircle, Copy, AlertCircle, Star, GitFork } from "lucide-react"

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

interface StatisticsCardsProps {
  users: ProcessedUser[]
}

export function StatisticsCards({ users }: StatisticsCardsProps) {
  const statistics = {
    total: users.length,
    valid: users.filter((u) => u.status === "valid").length,
    invalid: users.filter((u) => u.status === "invalid").length,
    deleted: users.filter((u) => u.status === "deleted").length,
    duplicate: users.filter((u) => u.status === "duplicate").length,
    pending: users.filter((u) => u.status === "pending").length,
    error: users.filter((u) => u.status === "error").length,
    fake: users.filter((u) => ["invalid", "deleted", "duplicate"].includes(u.status)).length,
  }

  const repositoryStats = {
    starred: users.filter((u) => u.repositoryEngagement?.hasStarred).length,
    forked: users.filter((u) => u.repositoryEngagement?.hasFork).length,
    hasRepositoryData: users.some((u) => u.repositoryEngagement),
  }

  const baseCards = [
    { icon: Users, value: statistics.total, label: "Total" },
    { icon: UserCheck, value: statistics.valid, label: "Valid" },
    { icon: Shield, value: statistics.fake, label: "Fake" },
    { icon: UserX, value: statistics.invalid, label: "Invalid" },
    { icon: XCircle, value: statistics.deleted, label: "Deleted" },
    { icon: Copy, value: statistics.duplicate, label: "Duplicates" },
    { icon: AlertCircle, value: statistics.pending, label: "Pending" },
    { icon: AlertCircle, value: statistics.error, label: "Errors" },
  ]

  const repositoryCards = repositoryStats.hasRepositoryData
    ? [
        { icon: Star, value: repositoryStats.starred, label: "Starred" },
        { icon: GitFork, value: repositoryStats.forked, label: "Forked" },
      ]
    : []

  const allCards = [...baseCards, ...repositoryCards]

  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-4 ${repositoryStats.hasRepositoryData ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-2`}
    >
      {allCards.map((card, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5"
        >
          <card.icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-none tracking-tight text-foreground tabular-nums">{card.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

import { Card, CardContent } from "@/components/ui/card"
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

  console.log("StatisticsCards - Total users:", users.length)
  console.log(
    "StatisticsCards - Users with repository engagement:",
    users.filter((u) => u.repositoryEngagement).length,
  )
  console.log("StatisticsCards - Repository stats:", repositoryStats)
  console.log(
    "StatisticsCards - Sample user with engagement:",
    users.find((u) => u.repositoryEngagement),
  )

  const baseCards = [
    {
      icon: Users,
      value: statistics.total,
      label: "Total",
      color: "text-muted-foreground",
    },
    {
      icon: UserCheck,
      value: statistics.valid,
      label: "Valid",
      color: "text-green-600",
    },
    {
      icon: Shield,
      value: statistics.fake,
      label: "Fake Entries",
      color: "text-purple-600",
    },
    {
      icon: UserX,
      value: statistics.invalid,
      label: "Invalid",
      color: "text-red-600",
    },
    {
      icon: XCircle,
      value: statistics.deleted,
      label: "Deleted",
      color: "text-red-600",
    },
    {
      icon: Copy,
      value: statistics.duplicate,
      label: "Duplicates",
      color: "text-yellow-600",
    },
    {
      icon: AlertCircle,
      value: statistics.pending,
      label: "Pending",
      color: "text-gray-600",
    },
    {
      icon: AlertCircle,
      value: statistics.error,
      label: "Errors",
      color: "text-orange-600",
    },
  ]

  const repositoryCards = repositoryStats.hasRepositoryData
    ? [
        {
          icon: Star,
          value: repositoryStats.starred,
          label: "Starred Repo",
          color: "text-blue-600",
        },
        {
          icon: GitFork,
          value: repositoryStats.forked,
          label: "Forked Repo",
          color: "text-indigo-600",
        },
      ]
    : []

  const allCards = [...baseCards, ...repositoryCards]

  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-4 ${repositoryStats.hasRepositoryData ? "lg:grid-cols-5 xl:grid-cols-10" : "lg:grid-cols-8"} gap-4`}
    >
      {allCards.map((card, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <div>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

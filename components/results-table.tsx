"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CheckCircle,
  XCircle,
  Copy,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  Download,
  RotateCcw,
  GitFork,
  Star,
  Users,
  Calendar,
  ExternalLink,
} from "lucide-react"
import { Label } from "@/components/ui/label"

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

interface ResultsTableProps {
  users: ProcessedUser[]
  onRecheckEngagement?: (usernames: string[]) => void | Promise<void>
  isRecheckingEngagement?: boolean
  repositoryUrl?: string
}

const EXPORT_FIELD_CONFIG = [
  {
    value: "originalValue",
    label: "Original ID / Value",
    description: "Raw entry exactly as provided in your file.",
    requiresRepository: false,
  },
  {
    value: "username",
    label: "Username",
    description: "Detected GitHub username.",
    requiresRepository: false,
  },
  {
    value: "authenticity",
    label: "Authenticity Status",
    description: "Validation outcome for the username.",
    requiresRepository: false,
  },
  {
    value: "error",
    label: "Error Message",
    description: "Validation or processing errors, if any.",
    requiresRepository: false,
  },
  {
    value: "profileName",
    label: "Profile Name",
    description: "Public profile name pulled from GitHub.",
    requiresRepository: false,
  },
  {
    value: "repos",
    label: "Public Repositories",
    description: "Total public repos for the user.",
    requiresRepository: false,
  },
  {
    value: "followers",
    label: "Followers",
    description: "Total follower count.",
    requiresRepository: false,
  },
  {
    value: "following",
    label: "Following",
    description: "Following count.",
    requiresRepository: false,
  },
  {
    value: "created",
    label: "Account Created Date",
    description: "ISO timestamp for when the account was created.",
    requiresRepository: false,
  },
  {
    value: "accountAge",
    label: "Account Age (Months)",
    description: "Age of the GitHub account in months.",
    requiresRepository: false,
  },
  {
    value: "engagementStar",
    label: "Engagement • Starred Repository",
    description: "Whether the user starred the target repository.",
    requiresRepository: true,
  },
  {
    value: "engagementFork",
    label: "Engagement • Forked Repository",
    description: "Whether the user forked the target repository.",
    requiresRepository: true,
  },
  {
    value: "repositoryUrl",
    label: "Repository URL",
    description: "Repository used for engagement analysis.",
    requiresRepository: true,
  },
] as const

type ExportFieldValue = (typeof EXPORT_FIELD_CONFIG)[number]["value"]

const EXPORT_FIELD_HEADERS: Record<ExportFieldValue, string> = {
  originalValue: "Original Value",
  username: "Username",
  authenticity: "Authenticity Status",
  error: "Error",
  profileName: "Name",
  repos: "Public Repos",
  followers: "Followers",
  following: "Following",
  created: "Created",
  accountAge: "Account Age (Months)",
  engagementStar: "Has Starred",
  engagementFork: "Has Forked",
  repositoryUrl: "Repository URL",
}

const exportFieldGetters: Record<ExportFieldValue, (user: ProcessedUser) => string> = {
  originalValue: (user) => user.originalValue,
  username: (user) => user.username || "",
  authenticity: (user) => user.status,
  error: (user) => user.error || "",
  profileName: (user) => user.profileData?.name || "",
  repos: (user) => (user.profileData?.public_repos ?? "").toString(),
  followers: (user) => (user.profileData?.followers ?? "").toString(),
  following: (user) => (user.profileData?.following ?? "").toString(),
  created: (user) => user.profileData?.created_at || "",
  accountAge: (user) => {
    if (!user.profileData?.created_at) return "";
    const createdDate = new Date(user.profileData.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
    return diffMonths.toString();
  },
  engagementStar: (user) =>
    user.repositoryEngagement ? (user.repositoryEngagement.hasStarred ? "Yes" : "No") : "",
  engagementFork: (user) =>
    user.repositoryEngagement ? (user.repositoryEngagement.hasFork ? "Yes" : "No") : "",
  repositoryUrl: (user) => user.repositoryEngagement?.repositoryUrl || "",
}

export function ResultsTable({ users, onRecheckEngagement, isRecheckingEngagement, repositoryUrl }: ResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [repositoryFilter, setRepositoryFilter] = useState<string>("all")
  const [ageFilter, setAgeFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("index")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [selectedUser, setSelectedUser] = useState<ProcessedUser | null>(null)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)

  const hasRepositoryData = users.some((u) => u.repositoryEngagement)
  const availableExportFields = useMemo(
    () => EXPORT_FIELD_CONFIG.filter((field) => !field.requiresRepository || hasRepositoryData),
    [hasRepositoryData],
  )
  const [selectedExportFields, setSelectedExportFields] = useState<ExportFieldValue[]>(
    () => availableExportFields.map((field) => field.value)
  )

  useEffect(() => {
    setSelectedExportFields((prev) => {
      const filtered = prev.filter((value) => availableExportFields.some((field) => field.value === value))
      if (filtered.length === 0) {
        return availableExportFields.map((field) => field.value)
      }
      return filtered
    })
  }, [availableExportFields])

  const getAccountAgeInMonths = (createdAt: string): number => {
    const createdDate = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - createdDate.getTime())
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)) // Average days per month
    return diffMonths
  }

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users

    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.originalValue.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.profileData?.name?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") {
      if (statusFilter === "fake") {
        filtered = filtered.filter((user) => ["invalid", "deleted", "duplicate"].includes(user.status))
      } else {
        filtered = filtered.filter((user) => user.status === statusFilter)
      }
    }

    if (repositoryFilter !== "all") {
      switch (repositoryFilter) {
        case "starred":
          filtered = filtered.filter((user) => user.repositoryEngagement?.hasStarred)
          break
        case "forked":
          filtered = filtered.filter((user) => user.repositoryEngagement?.hasFork)
          break
        case "engaged":
          filtered = filtered.filter(
            (user) => user.repositoryEngagement?.hasStarred || user.repositoryEngagement?.hasFork,
          )
          break
        case "not-engaged":
          filtered = filtered.filter(
            (user) =>
              user.status === "valid" && !user.repositoryEngagement?.hasStarred && !user.repositoryEngagement?.hasFork,
          )
          break
      }
    }

    if (ageFilter !== "all") {
      filtered = filtered.filter((user) => {
        if (!user.profileData?.created_at) return false
        const ageInMonths = getAccountAgeInMonths(user.profileData.created_at)

        switch (ageFilter) {
          case "2months":
            return ageInMonths >= 2
          case "3months":
            return ageInMonths >= 3
          case "6months":
            return ageInMonths >= 6
          case "1year":
            return ageInMonths >= 12
          default:
            return true
        }
      })
    }

    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case "username":
          aValue = a.username || a.originalValue
          bValue = b.username || b.originalValue
          break
        case "status":
          aValue = a.status
          bValue = b.status
          break
        case "repos":
          aValue = a.profileData?.public_repos || 0
          bValue = b.profileData?.public_repos || 0
          break
        case "followers":
          aValue = a.profileData?.followers || 0
          bValue = b.profileData?.followers || 0
          break
        case "created":
          aValue = a.profileData?.created_at || ""
          bValue = b.profileData?.created_at || ""
          break
        default:
          aValue = a.index
          bValue = b.index
      }

      if (typeof aValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      return sortOrder === "asc" ? aValue - bValue : bValue - aValue
    })

    return filtered
  }, [users, searchTerm, statusFilter, repositoryFilter, ageFilter, sortBy, sortOrder])

  const filteredNonEngagedUsernames = useMemo(() => {
    const seen = new Set<string>()
    const names: string[] = []
    filteredAndSortedUsers.forEach((user) => {
      const hasEngagement = Boolean(user.repositoryEngagement?.hasStarred || user.repositoryEngagement?.hasFork)
      if (user.username && user.status === "valid" && !hasEngagement) {
        const key = user.username.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          names.push(user.username)
        }
      }
    })
    return names
  }, [filteredAndSortedUsers])

  const getStatusIcon = (status: ProcessedUser["status"]) => {
    switch (status) {
      case "valid":
        return <CheckCircle className="h-3.5 w-3.5 text-foreground" />
      case "invalid":
      case "deleted":
        return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
      case "duplicate":
        return <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      case "processing":
        return <Loader2 className="h-3.5 w-3.5 text-foreground animate-spin" />
      case "error":
        return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
      default:
        return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
    }
  }

  const getStatusBadge = (status: ProcessedUser["status"]) => {
    const base = "rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
    const variants: Record<string, string> = {
      valid: `${base} border-foreground/10 bg-foreground/5 text-foreground`,
      invalid: `${base} border-border bg-muted text-muted-foreground`,
      deleted: `${base} border-border bg-muted text-muted-foreground`,
      duplicate: `${base} border-border bg-muted text-muted-foreground`,
      pending: `${base} border-border bg-muted text-muted-foreground`,
      processing: `${base} border-foreground/10 bg-foreground/5 text-foreground`,
      error: `${base} border-destructive/20 bg-destructive/5 text-destructive`,
    }

    return <span className={variants[status] || variants.pending}>{status}</span>
  }

  const exportResults = (fields: ExportFieldValue[]) => {
    if (fields.length === 0) return

    // Export filtered and sorted users, respecting all active filters
    const usersToExport = filteredAndSortedUsers

    const csvContent = [
      fields.map((field) => EXPORT_FIELD_HEADERS[field]),
      ...usersToExport.map((user) => fields.map((field) => exportFieldGetters[field](user))),
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    
    // Build descriptive filename with active filters
    const datePart = new Date().toISOString().split("T")[0]
    const filterParts: string[] = []
    
    if (statusFilter !== "all") {
      filterParts.push(statusFilter)
    }
    if (repositoryFilter !== "all") {
      filterParts.push(repositoryFilter.replace("-", "_"))
    }
    if (ageFilter !== "all") {
      const ageLabels: Record<string, string> = {
        "2months": "2mo+",
        "3months": "3mo+",
        "6months": "6mo+",
        "1year": "1yr+"
      }
      filterParts.push(ageLabels[ageFilter] || ageFilter)
    }
    
    const filterSuffix = filterParts.length > 0 ? `-${filterParts.join("-")}` : ""
    a.href = url
    a.download = `github-validation-results-${datePart}${filterSuffix}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportConfirm = () => {
    if (selectedExportFields.length === 0) return
    exportResults(selectedExportFields)
    setIsExportDialogOpen(false)
  }

  const handleSelectAllExportFields = () => {
    setSelectedExportFields(availableExportFields.map((field) => field.value))
  }

  const toggleExportField = (field: ExportFieldValue, checked: boolean) => {
    setSelectedExportFields((prev) => {
      if (checked) {
        if (prev.includes(field)) return prev
        return [...prev, field]
      }
      return prev.filter((value) => value !== field)
    })
  }

  const handleRecheckEngagement = () => {
    if (!onRecheckEngagement || filteredNonEngagedUsernames.length === 0) return
    onRecheckEngagement(filteredNonEngagedUsernames)
  }

  const isGitHubLink = (value: string): boolean => {
    return value.toLowerCase().includes("github.com") || value.toLowerCase().includes(".github.io")
  }

  const renderOriginalValue = (originalValue: string) => {
    if (isGitHubLink(originalValue)) {
      const url = originalValue.startsWith("http") ? originalValue : `https://${originalValue}`
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-2 decoration-border hover:decoration-foreground cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs max-w-32 truncate flex items-center gap-1">
            {originalValue}
            <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground" />
          </div>
        </a>
      )
    }
    return <div className="text-xs text-muted-foreground max-w-32 truncate">{originalValue}</div>
  }

  const renderRepositoryEngagement = (user: ProcessedUser) => {
    if (!user.repositoryEngagement) {
      return <div className="text-xs text-muted-foreground">—</div>
    }

    return (
      <div className="flex gap-2">
        {user.repositoryEngagement.hasStarred && (
          <div className="flex items-center gap-1 text-xs text-foreground" title="Starred repository">
            <Star className="h-3 w-3" />
          </div>
        )}
        {user.repositoryEngagement.hasFork && (
          <div className="flex items-center gap-1 text-xs text-foreground" title="Forked repository">
            <GitFork className="h-3 w-3" />
          </div>
        )}
        {!user.repositoryEngagement.hasStarred && !user.repositoryEngagement.hasFork && (
          <div className="text-xs text-muted-foreground">None</div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            {filteredAndSortedUsers.length} of {users.length} shown
          </p>
          <div className="flex flex-wrap gap-1.5">
            {repositoryFilter === "not-engaged" && repositoryUrl && onRecheckEngagement && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecheckEngagement}
                disabled={isRecheckingEngagement || filteredNonEngagedUsernames.length === 0}
                className="h-7 text-xs"
              >
                {isRecheckingEngagement ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Refreshing…
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Refresh
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)} className="h-7 text-xs">
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search usernames, names…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="valid" className="text-xs">Valid</SelectItem>
              <SelectItem value="fake" className="text-xs">Fake (Invalid + Deleted + Duplicate)</SelectItem>
              <SelectItem value="invalid" className="text-xs">Invalid</SelectItem>
              <SelectItem value="deleted" className="text-xs">Deleted</SelectItem>
              <SelectItem value="duplicate" className="text-xs">Duplicate</SelectItem>
              <SelectItem value="pending" className="text-xs">Pending</SelectItem>
              <SelectItem value="error" className="text-xs">Error</SelectItem>
            </SelectContent>
          </Select>
          {hasRepositoryData && (
            <Select value={repositoryFilter} onValueChange={setRepositoryFilter}>
              <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
                <Star className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Engagement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Users</SelectItem>
                <SelectItem value="starred" className="text-xs">Starred</SelectItem>
                <SelectItem value="forked" className="text-xs">Forked</SelectItem>
                <SelectItem value="engaged" className="text-xs">Any Engagement</SelectItem>
                <SelectItem value="not-engaged" className="text-xs">No Engagement</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={ageFilter} onValueChange={setAgeFilter}>
            <SelectTrigger className="w-full sm:w-32 h-8 text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Age" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Ages</SelectItem>
              <SelectItem value="2months" className="text-xs">2+ Months</SelectItem>
              <SelectItem value="3months" className="text-xs">3+ Months</SelectItem>
              <SelectItem value="6months" className="text-xs">6+ Months</SelectItem>
              <SelectItem value="1year" className="text-xs">1+ Year</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={`${sortBy}-${sortOrder}`}
            onValueChange={(value) => {
              const [field, order] = value.split("-")
              setSortBy(field)
              setSortOrder(order as "asc" | "desc")
            }}
          >
            <SelectTrigger className="w-full sm:w-40 h-8 text-xs">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="index-asc" className="text-xs">Index ↑</SelectItem>
              <SelectItem value="username-asc" className="text-xs">Username A-Z</SelectItem>
              <SelectItem value="username-desc" className="text-xs">Username Z-A</SelectItem>
              <SelectItem value="status-asc" className="text-xs">Status A-Z</SelectItem>
              <SelectItem value="repos-desc" className="text-xs">Repos ↓</SelectItem>
              <SelectItem value="followers-desc" className="text-xs">Followers ↓</SelectItem>
              <SelectItem value="created-desc" className="text-xs">Newest</SelectItem>
              <SelectItem value="created-asc" className="text-xs">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium">Status</TableHead>
                <TableHead className="text-xs font-medium">Username</TableHead>
                <TableHead className="text-xs font-medium">Original</TableHead>
                <TableHead className="hidden md:table-cell text-xs font-medium">Profile</TableHead>
                <TableHead className="hidden lg:table-cell text-xs font-medium">Stats</TableHead>
                {hasRepositoryData && <TableHead className="hidden xl:table-cell text-xs font-medium">Repo</TableHead>}
                <TableHead className="text-xs font-medium w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedUsers.map((user, index) => (
                <TableRow key={index} className="hover:bg-muted/30">
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1.5">
                      {getStatusIcon(user.status)}
                      {getStatusBadge(user.status)}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      {user.username || "—"}
                      {user.repositoryEngagement?.hasStarred && (
                        <Star className="h-3 w-3 text-foreground" aria-label="Starred repository" />
                      )}
                      {user.repositoryEngagement?.hasFork && (
                        <GitFork className="h-3 w-3 text-foreground" aria-label="Forked repository" />
                      )}
                    </div>
                    {user.error && <div className="mt-0.5 text-[11px] text-destructive">{user.error}</div>}
                  </TableCell>
                  <TableCell className="py-2">{renderOriginalValue(user.originalValue)}</TableCell>
                  <TableCell className="hidden md:table-cell py-2">
                    {user.profileData && (
                      <div>
                        <div className="text-xs font-medium">{user.profileData.name || user.username}</div>
                        {user.profileData.bio && (
                          <div className="max-w-48 truncate text-[11px] text-muted-foreground">{user.profileData.bio}</div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell py-2">
                    {user.profileData && (
                      <div className="flex gap-3 text-[11px] text-muted-foreground tabular-nums">
                        <span className="flex items-center gap-1">
                          <GitFork className="h-3 w-3" />
                          {user.profileData.public_repos}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {user.profileData.followers}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  {hasRepositoryData && (
                    <TableCell className="hidden xl:table-cell py-2">{renderRepositoryEngagement(user)}</TableCell>
                  )}
                  <TableCell className="py-2">
                    <div className="flex gap-1">
                      {user.username && user.status === "valid" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`https://github.com/${user.username}`, "_blank")}
                          className="h-6 w-6 p-0"
                          title="Open GitHub Profile"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedUser(user)}
                      >
                        Details
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredAndSortedUsers.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No results match your filters.</div>
        )}
      </div>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export results</DialogTitle>
            <DialogDescription>
              Select which columns to include in your CSV export.
              {(statusFilter !== "all" || repositoryFilter !== "all" || ageFilter !== "all") && (
                <span className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs font-medium">Active filters:</span>
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      Status: {statusFilter}
                    </Badge>
                  )}
                  {repositoryFilter !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      Repository: {repositoryFilter}
                    </Badge>
                  )}
                  {ageFilter !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      Age: {ageFilter === "2months" ? "2+ months" : ageFilter === "3months" ? "3+ months" : ageFilter === "6months" ? "6+ months" : "1+ year"}
                    </Badge>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {availableExportFields.map((field) => (
              <div key={field.value} className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id={`export-${field.value}`}
                  checked={selectedExportFields.includes(field.value)}
                  onCheckedChange={(checked) => toggleExportField(field.value, Boolean(checked))}
                />
                <div>
                  <Label htmlFor={`export-${field.value}`} className="text-sm font-medium">
                    {field.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleSelectAllExportFields}>
              Select all
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleExportConfirm} disabled={selectedExportFields.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedUser)}
        onOpenChange={(open) => {
          if (!open) setSelectedUser(null)
        }}
      >
        {selectedUser && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base">User Details</DialogTitle>
              <DialogDescription className="text-xs">{selectedUser.originalValue}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Username</label>
                  <p className="mt-0.5 font-mono text-xs">{selectedUser.username || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <div className="mt-0.5">{getStatusBadge(selectedUser.status)}</div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Original Value</label>
                <div className="mt-1">
                  {isGitHubLink(selectedUser.originalValue) ? (
                    <a
                      href={
                        selectedUser.originalValue.startsWith("http")
                          ? selectedUser.originalValue
                          : `https://${selectedUser.originalValue}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-fit items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2 decoration-border hover:decoration-foreground"
                    >
                      {selectedUser.originalValue}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-xs">{selectedUser.originalValue}</p>
                  )}
                </div>
              </div>

              {selectedUser.error && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Error</label>
                  <p className="mt-0.5 text-xs text-destructive">{selectedUser.error}</p>
                </div>
              )}

              {selectedUser.repositoryEngagement && (
                <div className="space-y-3 border-t border-border/60 pt-4">
                  <h4 className="text-sm font-medium text-foreground">Repository Engagement</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Repository</label>
                      <a
                        href={selectedUser.repositoryEngagement.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex w-fit items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2 decoration-border hover:decoration-foreground"
                      >
                        {selectedUser.repositoryEngagement.repositoryUrl.replace("https://github.com/", "")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Engagement</label>
                      <div className="mt-1 flex gap-3">
                        <div className="flex items-center gap-1 text-xs">
                          <Star
                            className={`h-3.5 w-3.5 ${selectedUser.repositoryEngagement.hasStarred ? "text-foreground" : "text-muted-foreground/40"}`}
                          />
                          <span
                            className={
                              selectedUser.repositoryEngagement.hasStarred ? "text-foreground font-medium" : "text-muted-foreground"
                            }
                          >
                            {selectedUser.repositoryEngagement.hasStarred ? "Starred" : "Not starred"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <GitFork
                            className={`h-3.5 w-3.5 ${selectedUser.repositoryEngagement.hasFork ? "text-foreground" : "text-muted-foreground/40"}`}
                          />
                          <span
                            className={
                              selectedUser.repositoryEngagement.hasFork ? "text-foreground font-medium" : "text-muted-foreground"
                            }
                          >
                            {selectedUser.repositoryEngagement.hasFork ? "Forked" : "Not forked"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedUser.profileData && (
                <div className="space-y-3 border-t border-border/60 pt-4">
                  <h4 className="text-sm font-medium text-foreground">GitHub Profile</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Name</label>
                      <p className="mt-0.5 text-xs">{selectedUser.profileData.name || "—"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Public Repos</label>
                      <p className="mt-0.5 text-xs font-mono">{selectedUser.profileData.public_repos}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Followers</label>
                      <p className="mt-0.5 text-xs font-mono">{selectedUser.profileData.followers}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Following</label>
                      <p className="mt-0.5 text-xs font-mono">{selectedUser.profileData.following}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Account Created</label>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(selectedUser.profileData.created_at).toLocaleDateString()}
                        <span className="text-muted-foreground">
                          · {getAccountAgeInMonths(selectedUser.profileData.created_at)} months
                        </span>
                      </p>
                    </div>
                    {selectedUser.profileData.bio && (
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">Bio</label>
                        <p className="mt-0.5 text-xs leading-relaxed">{selectedUser.profileData.bio}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}

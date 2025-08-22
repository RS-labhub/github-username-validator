"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  GitFork,
  Star,
  Users,
  Calendar,
  ExternalLink,
} from "lucide-react"

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
}

export function ResultsTable({ users }: ResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [repositoryFilter, setRepositoryFilter] = useState<string>("all")
  const [ageFilter, setAgeFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("index")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [selectedUser, setSelectedUser] = useState<ProcessedUser | null>(null)

  const hasRepositoryData = users.some((u) => u.repositoryEngagement)

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
      filtered = filtered.filter((user) => user.status === statusFilter)
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

  const getStatusIcon = (status: ProcessedUser["status"]) => {
    switch (status) {
      case "valid":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "invalid":
      case "deleted":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "duplicate":
        return <Copy className="h-4 w-4 text-yellow-600" />
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-orange-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: ProcessedUser["status"]) => {
    const variants = {
      valid: "bg-green-100 text-green-800 hover:bg-green-200",
      invalid: "bg-red-100 text-red-800 hover:bg-red-200",
      deleted: "bg-red-100 text-red-800 hover:bg-red-200",
      duplicate: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
      pending: "bg-gray-100 text-gray-800 hover:bg-gray-200",
      processing: "bg-blue-100 text-blue-800 hover:bg-blue-200",
      error: "bg-orange-100 text-orange-800 hover:bg-orange-200",
    }

    return <Badge className={variants[status] || variants.pending}>{status}</Badge>
  }

  const exportResults = () => {
    const csvContent = [
      [
        "Original Value",
        "Username",
        "Status",
        "Error",
        "Name",
        "Repos",
        "Followers",
        "Following",
        "Created",
        ...(hasRepositoryData ? ["Has Starred", "Has Forked", "Repository URL"] : []),
      ],
      ...users.map((user) => [
        user.originalValue,
        user.username || "",
        user.status,
        user.error || "",
        user.profileData?.name || "",
        user.profileData?.public_repos || "",
        user.profileData?.followers || "",
        user.profileData?.following || "",
        user.profileData?.created_at || "",
        ...(hasRepositoryData
          ? [
              user.repositoryEngagement?.hasStarred ? "Yes" : "No",
              user.repositoryEngagement?.hasFork ? "Yes" : "No",
              user.repositoryEngagement?.repositoryUrl || "",
            ]
          : []),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `github-validation-results-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm max-w-32 truncate flex items-center gap-1">
            {originalValue}
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </div>
        </a>
      )
    }
    return <div className="text-sm text-muted-foreground max-w-32 truncate">{originalValue}</div>
  }

  const renderRepositoryEngagement = (user: ProcessedUser) => {
    if (!user.repositoryEngagement) {
      return <div className="text-xs text-muted-foreground">-</div>
    }

    return (
      <div className="flex gap-2">
        {user.repositoryEngagement.hasStarred && (
          <div className="flex items-center gap-1 text-xs text-blue-600" title="Starred repository">
            <Star className="h-3 w-3 fill-current" />
          </div>
        )}
        {user.repositoryEngagement.hasFork && (
          <div className="flex items-center gap-1 text-xs text-indigo-600" title="Forked repository">
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredAndSortedUsers.length} of {users.length} usernames shown
        </p>
        <Button variant="outline" onClick={exportResults}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search usernames, names, or original values..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="invalid">Invalid</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
            <SelectItem value="duplicate">Duplicate</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        {hasRepositoryData && (
          <Select value={repositoryFilter} onValueChange={setRepositoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Star className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Repository filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="starred">Starred Repo</SelectItem>
              <SelectItem value="forked">Forked Repo</SelectItem>
              <SelectItem value="engaged">Any Engagement</SelectItem>
              <SelectItem value="not-engaged">No Engagement</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={ageFilter} onValueChange={setAgeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Account age" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ages</SelectItem>
            <SelectItem value="2months">2+ Months Old</SelectItem>
            <SelectItem value="3months">3+ Months Old</SelectItem>
            <SelectItem value="6months">6+ Months Old</SelectItem>
            <SelectItem value="1year">1+ Year Old</SelectItem>
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
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="index-asc">Index (A-Z)</SelectItem>
            <SelectItem value="username-asc">Username (A-Z)</SelectItem>
            <SelectItem value="username-desc">Username (Z-A)</SelectItem>
            <SelectItem value="status-asc">Status (A-Z)</SelectItem>
            <SelectItem value="repos-desc">Repos (High-Low)</SelectItem>
            <SelectItem value="followers-desc">Followers (High-Low)</SelectItem>
            <SelectItem value="created-desc">Newest First</SelectItem>
            <SelectItem value="created-asc">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Original Value</TableHead>
              <TableHead className="hidden md:table-cell">Profile Info</TableHead>
              <TableHead className="hidden lg:table-cell">Stats</TableHead>
              {hasRepositoryData && <TableHead className="hidden xl:table-cell">Repository</TableHead>}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedUsers.map((user, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(user.status)}
                    {getStatusBadge(user.status)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-mono text-sm flex items-center gap-2">
                    {user.username || "N/A"}
                    {user.repositoryEngagement?.hasStarred && (
                      <Star className="h-3 w-3 text-blue-600 fill-current" aria-label="Starred repository" />
                    )}
                    {user.repositoryEngagement?.hasFork && (
                      <GitFork className="h-3 w-3 text-indigo-600" aria-label="Forked repository" />
                    )}
                  </div>
                  {user.error && <div className="text-xs text-red-600 mt-1">{user.error}</div>}
                </TableCell>
                <TableCell>{renderOriginalValue(user.originalValue)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {user.profileData && (
                    <div className="text-sm">
                      <div className="font-medium">{user.profileData.name || user.username}</div>
                      {user.profileData.bio && (
                        <div className="text-xs text-muted-foreground max-w-48 truncate">{user.profileData.bio}</div>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {user.profileData && (
                    <div className="flex gap-4 text-xs text-muted-foreground">
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
                  <TableCell className="hidden xl:table-cell">{renderRepositoryEngagement(user)}</TableCell>
                )}
                <TableCell>
                  <div className="flex gap-1">
                    {user.username && user.status === "valid" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`https://github.com/${user.username}`, "_blank")}
                        className="h-8 w-8 p-0"
                        title="Open GitHub Profile"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUser(user)}
                          className="h-8 px-2 text-xs"
                        >
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>User Details</DialogTitle>
                          <DialogDescription>Detailed information for {user.originalValue}</DialogDescription>
                        </DialogHeader>
                        {selectedUser && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Username</label>
                                <p className="font-mono text-sm mt-1">{selectedUser.username || "N/A"}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Status</label>
                                <div className="mt-1">{getStatusBadge(selectedUser.status)}</div>
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Original Value</label>
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
                                    className="text-blue-600 hover:text-blue-800 hover:underline text-sm flex items-center gap-1 w-fit"
                                  >
                                    {selectedUser.originalValue}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <p className="text-sm">{selectedUser.originalValue}</p>
                                )}
                              </div>
                            </div>

                            {selectedUser.error && (
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Error</label>
                                <p className="text-sm text-red-600 mt-1">{selectedUser.error}</p>
                              </div>
                            )}

                            {selectedUser.repositoryEngagement && (
                              <div className="space-y-3 border-t pt-4">
                                <h4 className="font-medium">Repository Engagement</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Repository</label>
                                    <a
                                      href={selectedUser.repositoryEngagement.repositoryUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 hover:underline text-sm flex items-center gap-1 w-fit mt-1"
                                    >
                                      {selectedUser.repositoryEngagement.repositoryUrl.replace(
                                        "https://github.com/",
                                        "",
                                      )}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Engagement</label>
                                    <div className="flex gap-3 mt-1">
                                      <div className="flex items-center gap-1 text-sm">
                                        <Star
                                          className={`h-4 w-4 ${selectedUser.repositoryEngagement.hasStarred ? "text-blue-600 fill-current" : "text-gray-300"}`}
                                        />
                                        <span
                                          className={
                                            selectedUser.repositoryEngagement.hasStarred
                                              ? "text-blue-600"
                                              : "text-gray-500"
                                          }
                                        >
                                          {selectedUser.repositoryEngagement.hasStarred ? "Starred" : "Not starred"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 text-sm">
                                        <GitFork
                                          className={`h-4 w-4 ${selectedUser.repositoryEngagement.hasFork ? "text-indigo-600" : "text-gray-300"}`}
                                        />
                                        <span
                                          className={
                                            selectedUser.repositoryEngagement.hasFork
                                              ? "text-indigo-600"
                                              : "text-gray-500"
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
                              <div className="space-y-3 border-t pt-4">
                                <h4 className="font-medium">GitHub Profile</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                                    <p className="text-sm mt-1">{selectedUser.profileData.name || "Not provided"}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Public Repos</label>
                                    <p className="text-sm mt-1">{selectedUser.profileData.public_repos}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Followers</label>
                                    <p className="text-sm mt-1">{selectedUser.profileData.followers}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Following</label>
                                    <p className="text-sm mt-1">{selectedUser.profileData.following}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <label className="text-sm font-medium text-muted-foreground">Account Created</label>
                                    <p className="flex items-center gap-2 text-sm mt-1">
                                      <Calendar className="h-4 w-4" />
                                      {new Date(selectedUser.profileData.created_at).toLocaleDateString()}
                                      <span className="text-xs text-muted-foreground">
                                        ({getAccountAgeInMonths(selectedUser.profileData.created_at)} months old)
                                      </span>
                                    </p>
                                  </div>
                                  {selectedUser.profileData.bio && (
                                    <div className="col-span-2">
                                      <label className="text-sm font-medium text-muted-foreground">Bio</label>
                                      <p className="text-sm mt-1">{selectedUser.profileData.bio}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredAndSortedUsers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">No results match your current filters.</div>
      )}
    </div>
  )
}

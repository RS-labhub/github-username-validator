"use client"

import { Github, Linkedin, Twitter, Globe } from "lucide-react"

export function AppHeader() {
  return (
    <div>
      {/* Fixed top bar */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-foreground" />
            <span className="text-sm font-semibold tracking-tight text-foreground">GH Validator</span>
          </div>
          <nav className="flex items-center gap-1">
            {[
              { icon: Github, href: "https://github.com/RS-labhub", label: "GitHub" },
              { icon: Linkedin, href: "https://www.linkedin.com/in/rohan-sharma-9386rs/", label: "LinkedIn" },
              { icon: Twitter, href: "https://twitter.com/rrs00179", label: "X" },
              { icon: Globe, href: "https://rohan-sharma-portfolio.vercel.app", label: "Portfolio" },
            ].map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero section */}
      <div className="pt-20 pb-2 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Github className="h-3.5 w-3.5" />
            Bulk validation tool
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            GitHub Username Validator
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Upload files containing GitHub usernames or profile links to validate,
            detect duplicates, and identify invalid accounts in bulk.
          </p>
        </div>
      </div>
    </div>
  )
}

"use client"

import { Github, Linkedin, Twitter, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AppHeader() {
  return (
    <div className="text-center">
      {/* Fixed Header */}
      <header
        id="site-header"
        className="fixed inset-x-0 top-0 z-50 bg-white/90 backdrop-blur shadow"
      >
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 px-2 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="group h-8 px-2 sm:px-3 text-gray-700 text-xs sm:text-sm transition-colors hover:bg-black hover:text-white"
            onClick={() => window.open("https://github.com/RS-labhub", "_blank")}
          >
            <Github className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 group-hover:text-white" />
            GitHub
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="group h-8 px-2 sm:px-3 text-gray-700 text-xs sm:text-sm transition-colors hover:bg-black hover:text-white"
            onClick={() =>
              window.open("https://www.linkedin.com/in/rohan-sharma-9386rs/", "_blank")
            }
          >
            <Linkedin className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 group-hover:text-white" />
            LinkedIn
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="group h-8 px-2 sm:px-3 text-gray-700 text-xs sm:text-sm transition-colors hover:bg-black hover:text-white"
            onClick={() => window.open("https://twitter.com/rrs00179", "_blank")}
          >
            <Twitter className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 group-hover:text-white" />
            X (Twitter)
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="group h-8 px-2 sm:px-3 text-gray-700 text-xs sm:text-sm transition-colors hover:bg-black hover:text-white"
            onClick={() => window.open("https://rohan-sharma-portfolio.vercel.app", "_blank")}
          >
            <Globe className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 group-hover:text-white" />
            Portfolio
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 mt-24 sm:mt-18"> 
        {/* 👆 Adjust margin to match navbar height */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Github className="h-7 w-7 sm:h-9 sm:w-9 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            GitHub Username Validator
          </h1>
        </div>

        <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
          Upload files containing GitHub usernames or profile links to validate,
          detect duplicates, and identify invalid accounts in BULK.
        </p>
      </main>
    </div>
  )
}

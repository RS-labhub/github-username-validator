"use client"

import type React from "react"

import { useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileText, AlertCircle, Loader2, Type, Info } from "lucide-react"

interface ParsedData {
  headers: string[]
  rows: string[][]
}

interface InputSectionProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  file: File | null
  parsedData: ParsedData | null
  selectedColumn: string
  setSelectedColumn: (column: string) => void
  manualInput: string
  setManualInput: (input: string) => void
  isUploadingFile: boolean
  isProcessingManual: boolean
  isProcessing: boolean
  onFileUpload: (file: File) => void
  onProcessUsernames: () => void
  onProcessManualInput: () => void
}

export function InputSection({
  activeTab,
  setActiveTab,
  file,
  parsedData,
  selectedColumn,
  setSelectedColumn,
  manualInput,
  setManualInput,
  isUploadingFile,
  isProcessingManual,
  isProcessing,
  onFileUpload,
  onProcessUsernames,
  onProcessManualInput,
}: InputSectionProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) {
        onFileUpload(droppedFile)
      }
    },
    [onFileUpload],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Input GitHub Usernames
        </CardTitle>
        <CardDescription>
          Upload files or enter usernames manually. GitHub usernames will be auto-detected and processed.
        </CardDescription>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">Processing Limit</span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Maximum of <strong>5,000 GitHub usernames</strong> can be validated at a time. Larger datasets will need to
            be split into multiple batches.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Manual Input
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              {isUploadingFile ? (
                <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
              ) : (
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              )}
              <p className="text-lg font-medium text-foreground mb-2">
                {isUploadingFile ? "Processing file..." : file ? file.name : "Drop your file here or click to browse"}
              </p>
              <p className="text-sm text-muted-foreground">Supported formats: CSV, TXT, XLSX, DOCX (up to 10MB)</p>
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept=".csv,.txt,.xlsx,.docx"
                onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0])}
                disabled={isUploadingFile}
              />
            </div>

            {parsedData && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  Found {parsedData.headers.length} columns and {parsedData.rows.length} rows
                </div>

                <div className="space-y-2">
                  <Label htmlFor="column-select">Select GitHub Username Column</Label>
                  <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose the column containing GitHub usernames" />
                    </SelectTrigger>
                    <SelectContent>
                      {parsedData.headers.map((header, index) => (
                        <SelectItem key={index} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={onProcessUsernames} disabled={!selectedColumn || isProcessing} className="w-full">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Process GitHub Usernames"
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manual-input">GitHub Usernames</Label>
                <textarea
                  id="manual-input"
                  className="w-full h-32 p-3 border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter GitHub usernames or profile URLs, one per line:&#10;octocat&#10;https://github.com/torvalds&#10;@defunkt"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  disabled={isProcessingManual}
                />
              </div>
              <Button
                onClick={onProcessManualInput}
                className="w-full"
                disabled={!manualInput.trim() || isProcessingManual}
              >
                {isProcessingManual ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Process Manual Input"
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

"use client"

import type React from "react"

import { useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileText, Loader2, Type } from "lucide-react"

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
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Upload className="h-4 w-4 text-muted-foreground" />
          Input Usernames
        </CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Upload a file or paste usernames manually. Limit: <strong className="text-foreground">5,000</strong> per batch.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="upload" className="flex items-center gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1.5 text-xs">
              <Type className="h-3.5 w-3.5" />
              Manual Input
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div
              className="rounded-lg border-2 border-dashed border-border/60 bg-muted/20 p-8 text-center transition-colors hover:border-foreground/20 hover:bg-muted/40 cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              {isUploadingFile ? (
                <Loader2 className="h-8 w-8 text-muted-foreground mx-auto mb-3 animate-spin" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
              )}
              <p className="text-sm font-medium text-foreground mb-1">
                {isUploadingFile ? "Processing file..." : file ? file.name : "Drop file here or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">CSV, TXT, XLSX, DOCX — up to 10 MB</p>
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
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Found {parsedData.headers.length} column{parsedData.headers.length !== 1 ? "s" : ""} · {parsedData.rows.length} row{parsedData.rows.length !== 1 ? "s" : ""}
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="column-select" className="text-xs font-medium">
                    Username Column
                  </Label>
                  <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select the column with GitHub usernames" />
                    </SelectTrigger>
                    <SelectContent>
                      {parsedData.headers.map((header, index) => (
                        <SelectItem key={index} value={header} className="text-xs">
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={onProcessUsernames}
                  disabled={!selectedColumn || isProcessing}
                  className="w-full h-9 text-xs"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    "Process Usernames"
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="manual-input" className="text-xs font-medium">
                Usernames
              </Label>
              <textarea
                id="manual-input"
                className="w-full h-32 rounded-md border border-border/60 bg-background p-3 text-sm resize-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-foreground/20"
                placeholder={"octocat\nhttps://github.com/torvalds\n@defunkt"}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                disabled={isProcessingManual}
              />
            </div>
            <Button
              onClick={onProcessManualInput}
              className="w-full h-9 text-xs"
              disabled={!manualInput.trim() || isProcessingManual}
            >
              {isProcessingManual ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Processing…
                </>
              ) : (
                "Process Input"
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

import { EXTRACTION_MIME_TYPES } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { FileUpIcon, LoaderCircleIcon } from "lucide-react"
import { type ChangeEvent, type DragEvent, useId, useRef, useState } from "react"
import type { UploadStep } from "../api/mutations"

/** The extensions the file picker offers beside the types, for the systems that name none. */
const ACCEPT = [...EXTRACTION_MIME_TYPES, ".md", ".markdown", ".csv", ".txt"].join(",")

export type FileDropZoneProps = {
  /** The files the person dropped or picked. */
  onFiles: (files: File[]) => void
  /** The file on its way, while it uploads and its extraction starts. */
  upload: { fileName: string; step: UploadStep } | null
  /** The largest file an extraction reads, in the person's language: "25 MB". */
  maxSize: string
}

/**
 * Where a person gives the agent its file: dropped on the zone, or picked with the button the
 * zone is, which opens the file picker beside it. While a file uploads, the zone tells where it
 * stands and takes no other.
 */
export function FileDropZone({ onFiles, upload, maxSize }: FileDropZoneProps) {
  const { t } = useLingui()
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  // Entering a child of the zone fires a leave on the zone: a count tells the real leave.
  const [dragDepth, setDragDepth] = useState(0)
  const isDragging = dragDepth > 0 && upload === null

  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files")

  const handleDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    setDragDepth((depth) => depth + 1)
  }

  const handleDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) return
    // Without it, the browser opens the file instead of dropping it here.
    event.preventDefault()
    event.dataTransfer.dropEffect = upload ? "none" : "copy"
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragDepth(0)
    if (upload) return
    onFiles([...event.dataTransfer.files])
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])]
    // The same file can be picked again after a refusal.
    event.target.value = ""
    if (files.length > 0) onFiles(files)
  }

  return (
    <>
      {/* The picker the zone opens: the zone is the control people reach, so this one is hidden. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        aria-label={t`File to extract`}
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        aria-describedby={hintId}
        aria-busy={upload !== null}
        disabled={upload !== null}
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragDepth((depth) => Math.max(0, depth - 1))}
        onDrop={handleDrop}
        className={cn(
          "group flex w-full flex-col items-center gap-4 rounded-3xl border border-dashed border-foreground/20 bg-background px-6 py-12 text-center shadow-sm transition duration-150 outline-none hover:border-foreground/35 hover:shadow-md focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-progress dark:bg-card",
          isDragging && "border-solid border-foreground/50 bg-muted/60 shadow-md",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5",
            isDragging && "-translate-y-1 bg-foreground text-background",
          )}
        >
          {upload ? (
            <LoaderCircleIcon className="size-6 animate-spin motion-reduce:animate-none" />
          ) : (
            <FileUpIcon className="size-6" />
          )}
        </span>
        {upload ? (
          <span className="flex min-w-0 max-w-full flex-col gap-1" aria-live="polite">
            <span className="truncate text-base font-medium">{upload.fileName}</span>
            <span className="text-sm text-muted-foreground">
              {upload.step === "uploading" ? (
                <Trans>Uploading…</Trans>
              ) : (
                <Trans>Starting the extraction…</Trans>
              )}
            </span>
          </span>
        ) : (
          <span className="flex flex-col gap-1">
            <span className="text-base font-medium">
              {isDragging ? (
                <Trans>Drop the file to extract it</Trans>
              ) : (
                <>
                  {/* A touch screen picks a file; it has nothing to drag one from. */}
                  <span className="pointer-coarse:hidden">
                    <Trans>
                      Drop a file here, or{" "}
                      <span className="underline underline-offset-4">browse</span>
                    </Trans>
                  </span>
                  <span className="hidden pointer-coarse:inline">
                    <Trans>Choose a file</Trans>
                  </span>
                </>
              )}
            </span>
            <span id={hintId} className="text-sm text-muted-foreground">
              <Trans>
                PDF, image, text or CSV file, up to {maxSize}. A CSV file runs row by row.
              </Trans>
            </span>
          </span>
        )}
      </button>
    </>
  )
}

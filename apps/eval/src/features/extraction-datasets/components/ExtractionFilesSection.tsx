import {
  EXTRACTION_DATASET_FILE_MAX_SIZE,
  EXTRACTION_DATASET_FILE_MIME_TYPE,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { FileSpreadsheetIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { SectionCard } from "@/components/shared/SectionCard"
import { TimeAgo } from "@/components/shared/TimeAgo"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { fileSizeOf } from "@/lib/file-size"
import { useDeleteExtractionFiles, useUploadExtractionFile } from "../api/mutations"
import { extractionFilesQueryOptions } from "../api/queries"
import { csvFileProblemOf } from "../csv-file"
import { ExtractionFileDetails } from "./ExtractionFileDetails"

export type ExtractionFilesSectionProps = {
  project: ProjectParamsDto
  /** Takes a file as the source of the dataset's records. */
  onChoose: (file: { id: string; fileName: string }) => void
}

/**
 * The first step that builds a dataset: the CSV files of the project, the last uploaded first,
 * with the way to upload one, by the button or by dropping it on the list. A file is chosen, and
 * the files checked are deleted together, after a confirmation.
 */
export function ExtractionFilesSection({ project, onChoose }: ExtractionFilesSectionProps) {
  const { t, i18n } = useLingui()
  const { data: files } = useSuspenseQuery(extractionFilesQueryOptions(project))
  // The files checked, and whether the dialog that deletes them shows.
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set())
  const [state, setState] = useState<"idle" | "dropping" | "confirming">("idle")
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadFile = useUploadExtractionFile(project)
  const deleteFiles = useDeleteExtractionFiles(project)
  // A file deleted since it was checked no longer counts.
  const checked = files.filter((file) => checkedIds.has(file.id))
  const checkedCount = checked.length
  const areAllChecked = files.length > 0 && checkedCount === files.length
  const maxSize = fileSizeOf(EXTRACTION_DATASET_FILE_MAX_SIZE, i18n.locale)
  const upload = (chosen: File[]) => {
    const [file] = chosen
    if (!file) return
    if (chosen.length > 1) {
      toast.error(t`Upload one file at a time.`)
      return
    }
    const fileName = file.name
    const problem = csvFileProblemOf(file)
    if (problem === "notCsv") {
      toast.error(t`${fileName} is not a CSV file.`)
      return
    }
    if (problem === "tooLarge") {
      toast.error(t`${fileName} is over ${maxSize}.`)
      return
    }
    const uploading = toast.loading(t`Uploading ${fileName}…`)
    uploadFile.mutate(file, {
      onSuccess: () => toast.success(t`${fileName} was uploaded.`, { id: uploading }),
      onError: () =>
        toast.error(t`${fileName} could not be uploaded. Try again.`, { id: uploading }),
    })
  }
  const toggle = (fileId: string) =>
    setCheckedIds((previous) => {
      const next = new Set(previous)
      if (!next.delete(fileId)) next.add(fileId)
      return next
    })
  return (
    <SectionCard
      title={<Trans>Choose a CSV file</Trans>}
      description={
        <Trans>
          The records of the dataset come from the rows of a CSV file, whose first row names the
          columns. Choose a file of the project, or upload one, of {maxSize} at most.
        </Trans>
      }
      aside={
        <>
          <input
            ref={fileInput}
            type="file"
            accept={`.csv,${EXTRACTION_DATASET_FILE_MIME_TYPE}`}
            className="sr-only"
            tabIndex={-1}
            aria-label={t`CSV file to upload`}
            onChange={(event) => {
              upload([...(event.target.files ?? [])])
              // The same file can be chosen again, after a failure.
              event.target.value = ""
            }}
          />
          <Button
            variant="outline"
            disabled={uploadFile.isPending}
            onClick={() => fileInput.current?.click()}
          >
            <UploadIcon data-icon="inline-start" aria-hidden />
            {uploadFile.isPending ? (
              <Trans comment="The button that uploads a file, while a file uploads">
                Uploading…
              </Trans>
            ) : (
              <Trans>Upload a CSV file</Trans>
            )}
          </Button>
        </>
      }
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target adds to the button, which the keyboard uses. */}
      <div
        className={cn(
          "flex flex-col gap-3 rounded-lg",
          state === "dropping" && "outline-2 outline-offset-4 outline-ring outline-dashed",
        )}
        onDragOver={(event) => {
          event.preventDefault()
          if (state === "idle") setState("dropping")
        }}
        onDragLeave={() => {
          if (state === "dropping") setState("idle")
        }}
        onDrop={(event) => {
          event.preventDefault()
          setState("idle")
          upload([...event.dataTransfer.files])
        }}
      >
        {files.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Trans>The project has no CSV file yet. Upload one, or drop it here, to start.</Trans>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={areAllChecked}
                  indeterminate={checkedCount > 0 && !areAllChecked}
                  onCheckedChange={() =>
                    setCheckedIds(areAllChecked ? new Set() : new Set(files.map((file) => file.id)))
                  }
                  aria-label={t`Select all the files`}
                />
                {checkedCount === 0 ? (
                  <Trans>Select files to delete them together</Trans>
                ) : (
                  <Plural value={checkedCount} one="# file selected" other="# files selected" />
                )}
              </div>
              {checkedCount > 0 ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setCheckedIds(new Set())}>
                    <Trans comment="Lets go of the files checked in a list">Deselect</Trans>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setState("confirming")}>
                    <Trash2Icon data-icon="inline-start" aria-hidden />
                    <Trans comment="Deletes the files checked in a list">Delete</Trans>
                  </Button>
                </div>
              ) : null}
            </div>
            <ul className="flex flex-col divide-y rounded-lg border">
              {files.map((file) => {
                const fileName = file.fileName
                const size = fileSizeOf(file.size, i18n.locale)
                return (
                  <li key={file.id} className="flex flex-wrap items-center gap-3 p-3">
                    <Checkbox
                      checked={checkedIds.has(file.id)}
                      onCheckedChange={() => toggle(file.id)}
                      aria-label={t`Select the file ${fileName}`}
                    />
                    <FileSpreadsheetIcon
                      aria-hidden
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{fileName}</span>
                      <span className="text-xs text-muted-foreground">
                        <Trans comment="Under the name of a CSV file: its size, and when it was uploaded">
                          {size} · Uploaded <TimeAgo moment={file.createdAt} />
                        </Trans>
                      </span>
                    </div>
                    <ExtractionFileDetails file={file} />
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={t`Use the file ${fileName}`}
                      onClick={() => onChoose(file)}
                    >
                      <Trans comment="Takes a CSV file as the source of a dataset">
                        Use this file
                      </Trans>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
      <ConfirmDialog
        isOpen={state === "confirming"}
        onOpenChange={(isOpen) => setState(isOpen ? "confirming" : "idle")}
        title={<Plural value={checkedCount} one="Delete # file?" other="Delete # files?" />}
        description={
          <Trans>
            The files are deleted for good. The datasets already built from them keep their records.
          </Trans>
        }
        confirmLabel={<Trans>Delete</Trans>}
        isDestructive
        isPending={deleteFiles.isPending}
        onConfirm={() =>
          deleteFiles.mutate(
            checked.map((file) => file.id),
            {
              onSuccess: () => {
                toast.success(t`The files were deleted.`)
                setCheckedIds(new Set())
                setState("idle")
              },
              onError: () => toast.error(t`Some files could not be deleted. Try again.`),
            },
          )
        }
      />
    </SectionCard>
  )
}

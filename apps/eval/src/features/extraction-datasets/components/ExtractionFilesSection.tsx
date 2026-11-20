import {
  EXTRACTION_DATASET_FILE_MIME_TYPE,
  type ExtractionDatasetFileOutputDto,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { FileSpreadsheetIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { SectionCard } from "@/components/shared/SectionCard"
import { TimeAgo } from "@/components/shared/TimeAgo"
import { Button } from "@/components/ui/button"
import { fileSizeOf } from "@/lib/file-size"
import { useDeleteExtractionFile, useUploadExtractionFile } from "../api/mutations"
import { extractionFilesQueryOptions } from "../api/queries"

export type ExtractionFilesSectionProps = {
  project: ProjectParamsDto
  /** Takes a file as the source of the dataset's records. */
  onChoose: (file: { id: string; fileName: string }) => void
}

/**
 * The first step that builds a dataset: the CSV files of the project, the last uploaded first,
 * with the way to upload one. A file is chosen, or deleted after a confirmation.
 */
export function ExtractionFilesSection({ project, onChoose }: ExtractionFilesSectionProps) {
  const { t, i18n } = useLingui()
  const { data: files } = useSuspenseQuery(extractionFilesQueryOptions(project))
  const [deleted, setDeleted] = useState<ExtractionDatasetFileOutputDto | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadFile = useUploadExtractionFile(project)
  const deleteFile = useDeleteExtractionFile(project)
  const deletedName = deleted?.fileName ?? ""
  const upload = (file: File) =>
    uploadFile.mutate(file, {
      // A file just uploaded is the one the person builds the dataset from.
      onSuccess: (uploaded) => onChoose(uploaded),
      onError: () => toast.error(t`The file could not be uploaded. Try again.`),
    })
  return (
    <SectionCard
      title={<Trans>Choose a CSV file</Trans>}
      description={
        <Trans>
          The records of the dataset come from the rows of a CSV file, whose first row names the
          columns. Choose a file of the project, or upload one.
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
              const [file] = event.target.files ?? []
              if (file) upload(file)
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
      {files.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Trans>The project has no CSV file yet. Upload one to start.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {files.map((file) => {
            const fileName = file.fileName
            const size = fileSizeOf(file.size, i18n.locale)
            return (
              <li key={file.id} className="flex flex-wrap items-center gap-3 p-3">
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
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t`Use the file ${fileName}`}
                  onClick={() => onChoose(file)}
                >
                  <Trans comment="Takes a CSV file as the source of a dataset">Use this file</Trans>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t`Delete the file ${fileName}`}
                  onClick={() => setDeleted(file)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmDialog
        isOpen={deleted !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleted(null)
        }}
        title={<Trans>Delete {deletedName}?</Trans>}
        description={
          <Trans>
            The file is deleted for good. The datasets already built from it keep their records.
          </Trans>
        }
        confirmLabel={<Trans>Delete</Trans>}
        isDestructive
        isPending={deleteFile.isPending}
        onConfirm={() => {
          if (!deleted) return
          deleteFile.mutate(deleted.id, {
            onSuccess: () => {
              toast.success(t`The file was deleted.`)
              setDeleted(null)
            },
            onError: () => toast.error(t`The file could not be deleted. Try again.`),
          })
        }}
      />
    </SectionCard>
  )
}

import { Button } from "@caseai-connect/app-ui/components/button"
import { Checkbox } from "@caseai-connect/app-ui/components/checkbox"
import type { ExtractionDatasetFileOutputDto } from "@caseai-connect/eval-contracts"
import { fileSizeOf } from "@caseai-connect/frontend-lib"
import { Trans, useLingui } from "@lingui/react/macro"
import { FileSpreadsheetIcon } from "lucide-react"
import { TimeAgo } from "@/components/shared/TimeAgo"
import { ExtractionFileDetails } from "./ExtractionFileDetails"

export type ExtractionFileRowProps = {
  file: ExtractionDatasetFileOutputDto
  /** Whether the file is among those deleted together. */
  isChecked: boolean
  onToggle: () => void
  /** Takes the file as the source of the dataset. */
  onChoose: () => void
}

/**
 * A CSV file of the project, in the list a dataset is built from: its box, its name, its size
 * and when it was uploaded, its details, and the way to take it.
 */
export function ExtractionFileRow({ file, isChecked, onToggle, onChoose }: ExtractionFileRowProps) {
  const { t, i18n } = useLingui()
  const fileName = file.fileName
  const size = fileSizeOf(file.size, i18n.locale)
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <Checkbox
        checked={isChecked}
        onCheckedChange={onToggle}
        aria-label={t`Select the file ${fileName}`}
      />
      <FileSpreadsheetIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
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
        onClick={onChoose}
      >
        <Trans comment="Takes a CSV file as the source of a dataset">Use this file</Trans>
      </Button>
    </li>
  )
}

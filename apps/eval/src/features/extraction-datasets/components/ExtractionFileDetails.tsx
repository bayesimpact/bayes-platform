import { Button } from "@caseai-connect/app-ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@caseai-connect/app-ui/components/popover"
import type { ExtractionDatasetFileOutputDto } from "@caseai-connect/eval-contracts"
import { fileSizeOf, fullDateTimeOf } from "@caseai-connect/frontend-lib"
import { Trans, useLingui } from "@lingui/react/macro"
import { InfoIcon } from "lucide-react"

export type ExtractionFileDetailsProps = {
  file: ExtractionDatasetFileOutputDto
}

/** The details of a CSV file, behind a button of its row: its name, size, type and dates. */
export function ExtractionFileDetails({ file }: ExtractionFileDetailsProps) {
  const { t, i18n } = useLingui()
  const fileName = file.fileName
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={t`Details of ${fileName}`} />}
      >
        <InfoIcon aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverTitle className="wrap-anywhere">{fileName}</PopoverTitle>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">
            <Trans comment="The size of a file">Size</Trans>
          </dt>
          <dd>{fileSizeOf(file.size, i18n.locale)}</dd>
          <dt className="text-muted-foreground">
            <Trans comment="The media type of a file, such as text/csv">Type</Trans>
          </dt>
          <dd className="font-mono text-xs">{file.mimeType}</dd>
          <dt className="text-muted-foreground">
            <Trans comment="When a file was uploaded">Uploaded</Trans>
          </dt>
          <dd>{fullDateTimeOf(file.createdAt, i18n.locale)}</dd>
          <dt className="text-muted-foreground">
            <Trans comment="When a file last changed">Updated</Trans>
          </dt>
          <dd>{fullDateTimeOf(file.updatedAt, i18n.locale)}</dd>
        </dl>
      </PopoverContent>
    </Popover>
  )
}

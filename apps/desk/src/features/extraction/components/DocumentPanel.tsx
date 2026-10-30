import type { ExtractionDocumentOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { LoaderCircleIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Markdown } from "@/components/shared/Markdown"
import { SidePanel } from "@/components/shared/SidePanel"
import { Button } from "@/components/ui/button"
import { fileSizeOf } from "@/lib/file-size"
import { fullDateTimeOf } from "@/lib/format-time"
import { fileKindOf } from "../extraction-files"
import { FILE_KIND_LABELS } from "../file-kind-labels"

export type DocumentPanelProps = {
  document: ExtractionDocumentOutputDto
  isExtracting: boolean
  /** Whether another document is being extracted, which the panel's action then waits for. */
  isDisabled: boolean
  onExtract: () => void
  onClose: () => void
}

/**
 * A document the person uploaded, in full beside the page: when it came and changed, its file,
 * its language and the text the agent read in it, and the action of its row.
 */
export function DocumentPanel({
  document,
  isExtracting,
  isDisabled,
  onExtract,
  onClose,
}: DocumentPanelProps) {
  const { t, i18n } = useLingui()
  const kind = fileKindOf(document)
  const name = document.fileName ?? t`Untitled document`
  const language = new Intl.DisplayNames([i18n.locale], { type: "language" }).of(document.language)
  const details: { label: string; value: ReactNode }[] = [
    { label: t`Added`, value: fullDateTimeOf(document.createdAt, i18n.locale) },
    { label: t`Last updated`, value: fullDateTimeOf(document.updatedAt, i18n.locale) },
    { label: t`File name`, value: name },
    { label: t`Type`, value: document.mimeType ?? t(FILE_KIND_LABELS[kind]) },
    ...(document.size !== undefined
      ? [{ label: t`Size`, value: fileSizeOf(document.size, i18n.locale) }]
      : []),
    { label: t`Language`, value: language ?? document.language },
  ]

  return (
    <SidePanel
      title={name}
      onClose={onClose}
      footer={
        <Button className="w-full" disabled={isDisabled} onClick={onExtract}>
          {isExtracting ? (
            <LoaderCircleIcon
              data-icon="inline-start"
              aria-hidden
              className="animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {kind === "csv" ? (
            <Trans comment="Opens the setup of a CSV file's extraction">
              Set up the extraction
            </Trans>
          ) : (
            <Trans comment="Starts the extraction of a document">Extract</Trans>
          )}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="flex flex-col divide-y rounded-2xl border">
          {details.map((detail) => (
            <div key={detail.label} className="grid grid-cols-3 gap-2 px-4 py-2.5">
              <dt className="text-muted-foreground">{detail.label}</dt>
              <dd className="col-span-2 min-w-0 break-words">{detail.value}</dd>
            </div>
          ))}
        </dl>
        {/* A CSV file runs row by row: the agent reads no text of the whole file. */}
        {document.content || kind !== "csv" ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">
              <Trans>Text read in the document</Trans>
            </h3>
            {document.content ? (
              <div className="min-w-0 rounded-2xl border px-4 py-3">
                <Markdown>{document.content}</Markdown>
              </div>
            ) : (
              <p className="text-muted-foreground">
                <Trans>The agent reads the document's text in its first extraction.</Trans>
              </p>
            )}
          </section>
        ) : null}
      </div>
    </SidePanel>
  )
}

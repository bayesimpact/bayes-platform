import type { ExtractionDocumentOutputDto } from "@caseai-connect/desk-contracts"
import { Plural, Trans } from "@lingui/react/macro"
import { useId, useState } from "react"
import { DocumentRow } from "./DocumentRow"

/** The documents shown before the person asks for all of them. */
const SHOWN_AT_FIRST = 5

export type RecentDocumentsProps = {
  documents: ExtractionDocumentOutputDto[]
  /** The time the page shows, for the documents' ages. */
  now: number
  /** The document being extracted again, whose row shows it. */
  busyDocumentId: string | null
  /** The document whose details are open beside the page. */
  openDocumentId: string | null
  onOpen: (document: ExtractionDocumentOutputDto) => void
  onExtract: (document: ExtractionDocumentOutputDto) => void
  onDelete: (document: ExtractionDocumentOutputDto) => void
}

/** The documents the person uploaded before, newest first, to see one or extract it again. */
export function RecentDocuments({
  documents,
  now,
  busyDocumentId,
  openDocumentId,
  onOpen,
  onExtract,
  onDelete,
}: RecentDocumentsProps) {
  const [isShowingAll, setIsShowingAll] = useState(false)
  const headingId = useId()
  if (documents.length === 0) return null
  const shown = isShowingAll ? documents : documents.slice(0, SHOWN_AT_FIRST)
  const hiddenCount = documents.length - shown.length

  return (
    <section aria-labelledby={headingId} className="flex w-full flex-col gap-2">
      <h2 id={headingId} className="px-1 text-sm font-medium text-muted-foreground">
        <Trans>Your documents</Trans>
      </h2>
      <ul className="flex flex-col divide-y rounded-2xl border bg-background dark:bg-card">
        {shown.map((document) => (
          <DocumentRow
            key={document.id}
            document={document}
            now={now}
            isBusy={busyDocumentId === document.id}
            isDisabled={busyDocumentId !== null}
            isOpen={openDocumentId === document.id}
            onOpen={() => onOpen(document)}
            onExtract={() => onExtract(document)}
            onDelete={() => onDelete(document)}
          />
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setIsShowingAll(true)}
          className="self-start rounded-md px-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Plural value={hiddenCount} one="Show # more document" other="Show # more documents" />
        </button>
      ) : null}
    </section>
  )
}

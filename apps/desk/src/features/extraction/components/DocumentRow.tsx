import type { ExtractionDocumentOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { LoaderCircleIcon, Trash2Icon } from "lucide-react"
import { RelativeTime } from "@/components/shared/RelativeTime"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { fileSizeOf } from "@/lib/file-size"
import { fileKindOf } from "../extraction-files"
import { FILE_KIND_LABELS } from "../file-kind-labels"
import { FileKindIcon } from "./FileKindIcon"

export type DocumentRowProps = {
  document: ExtractionDocumentOutputDto
  /** The time the page shows, for the document's age. */
  now: number
  isBusy: boolean
  isDisabled: boolean
  /** Whether its details are open beside the page. */
  isOpen: boolean
  onOpen: () => void
  onExtract: () => void
  onDelete: () => void
}

/**
 * A document the person uploaded before: its name, kind, size and age, which open its details,
 * and what to do with it.
 */
export function DocumentRow({
  document,
  now,
  isBusy,
  isDisabled,
  isOpen,
  onOpen,
  onExtract,
  onDelete,
}: DocumentRowProps) {
  const { t, i18n } = useLingui()
  const kind = fileKindOf(document)
  const name = document.fileName ?? t`Untitled document`

  return (
    <li
      data-state={isOpen ? "selected" : undefined}
      className="group/row relative flex items-center gap-3 px-3 py-2.5 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/40 data-[state=selected]:bg-muted"
    >
      <FileKindIcon kind={kind} className="text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Its area covers the row, so a click anywhere but on the actions opens the details. */}
        <button
          type="button"
          aria-label={t`Details of ${name}`}
          aria-expanded={isOpen}
          onClick={onOpen}
          className="truncate text-left text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-inset focus-visible:after:ring-ring/50"
        >
          {name}
        </button>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{t(FILE_KIND_LABELS[kind])}</span>
          {document.size !== undefined ? (
            <>
              <span aria-hidden>·</span>
              <span>{fileSizeOf(document.size, i18n.locale)}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <RelativeTime moment={document.createdAt} now={now} />
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="relative"
        disabled={isDisabled}
        onClick={onExtract}
        aria-label={kind === "csv" ? t`Set up the extraction of ${name}` : t`Extract ${name}`}
      >
        {isBusy ? (
          <LoaderCircleIcon
            data-icon="inline-start"
            aria-hidden
            className="animate-spin motion-reduce:animate-none"
          />
        ) : null}
        {kind === "csv" ? (
          <Trans comment="Opens the setup of a CSV file's extraction">Set up</Trans>
        ) : (
          <Trans comment="Starts the extraction of a document">Extract</Trans>
        )}
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isDisabled}
              aria-label={t`Delete ${name}`}
              onClick={onDelete}
              className="relative text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            />
          }
        >
          <Trash2Icon aria-hidden />
        </TooltipTrigger>
        <TooltipContent>
          <Trans>Delete {name}</Trans>
        </TooltipContent>
      </Tooltip>
    </li>
  )
}

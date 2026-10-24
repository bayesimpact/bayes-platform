import type { ExtractionDocumentOutputDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { LoaderCircleIcon, Trash2Icon } from "lucide-react"
import { RelativeTime } from "@/components/shared/RelativeTime"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { fileSizeOf } from "@/lib/file-size"
import { fileKindOf } from "../extraction-files"
import { FileKindIcon } from "./FileKindIcon"

export type DocumentRowProps = {
  document: ExtractionDocumentOutputDto
  /** The time the page shows, for the document's age. */
  now: number
  isBusy: boolean
  isDisabled: boolean
  onExtract: () => void
  onDelete: () => void
}

/** A document the person uploaded before: its name, kind, size and age, and what to do with it. */
export function DocumentRow({
  document,
  now,
  isBusy,
  isDisabled,
  onExtract,
  onDelete,
}: DocumentRowProps) {
  const { t, i18n } = useLingui()
  const kind = fileKindOf(document)
  const name = document.fileName ?? t`Untitled document`
  const kindLabels = {
    pdf: t({ message: "PDF", comment: "The kind of a document the person uploaded" }),
    image: t({ message: "Image", comment: "The kind of a document the person uploaded" }),
    text: t({ message: "Text", comment: "The kind of a document the person uploaded" }),
    csv: t({ message: "CSV", comment: "The kind of a document the person uploaded" }),
    other: t({ message: "File", comment: "The kind of a document the person uploaded" }),
  } satisfies Record<typeof kind, string>

  return (
    <li className="group/row flex items-center gap-3 px-3 py-2.5 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/40">
      <FileKindIcon kind={kind} className="text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{kindLabels[kind]}</span>
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
              className="text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
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

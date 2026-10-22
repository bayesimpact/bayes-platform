import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { DownloadIcon, FileTextIcon, GlobeIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { openBlankTab } from "@/lib/safe-url"
import { useOpenDocument } from "../api/mutations"
import { documentIsPublicQueryOptions } from "../api/queries"
import type { ChatSource } from "../chat-messages"

export type SourceItemProps = {
  conversation: ConversationParamsDto
  source: ChatSource
}

/**
 * One document a reply relied on, with the passages it cited. A document shared with the
 * project's members can be opened; a crawled web page has no file to open.
 */
export function SourceItem({ conversation, source }: SourceItemProps) {
  const { t } = useLingui()
  const isWebPage = source.documentSourceType === "webCrawl"
  // useQuery: optional data, read only while the sources are open, which hides the button
  // until it knows whether the person may open the document.
  const isPublic = useQuery({
    ...documentIsPublicQueryOptions({ ...conversation, documentId: source.documentId }),
    enabled: !isWebPage,
  })
  const openDocument = useOpenDocument(conversation)
  const title = source.documentTitle ?? t`Untitled document`

  const handleOpen = () => {
    const tab = openBlankTab()
    openDocument.mutate(
      { documentId: source.documentId, tab },
      { onError: () => toast.error(t`The document could not be opened. Try again.`) },
    )
  }

  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {isWebPage ? (
          <GlobeIcon aria-hidden className="size-4 shrink-0" />
        ) : (
          <FileTextIcon aria-hidden className="size-4 shrink-0" />
        )}
        <span className="min-w-0 truncate font-medium text-foreground">{title}</span>
        {isPublic.data === true ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t`Open ${title}`}
            disabled={openDocument.isPending}
            onClick={handleOpen}
          >
            <DownloadIcon aria-hidden />
          </Button>
        ) : null}
      </div>
      {source.chunks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {source.chunks.map((chunk) => (
            <li key={chunk.chunkId}>
              <blockquote className="border-l-2 pl-3 text-xs leading-relaxed">
                {chunk.partialContent}
              </blockquote>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs">
          <Trans>No passage to show.</Trans>
        </p>
      )}
    </li>
  )
}

import { Trans, useLingui } from "@lingui/react/macro"
import { ExternalLinkIcon } from "lucide-react"
import { SidePanel } from "@/components/shared/SidePanel"
import { buttonVariants } from "@/components/ui/button"
import { type OpenedResource, youtubeEmbedUrlOf } from "../resource-media"

export type ResourcePanelProps = {
  resource: OpenedResource
  onClose: () => void
}

/**
 * A resource a reply points to, open beside the conversation, as an artifact opens in the Claude
 * app: a video plays, an image shows, a page or a file shows in a frame. Many sites refuse a
 * frame, which the page cannot tell: the panel says so, and opens the resource in a new tab too.
 */
export function ResourcePanel({ resource, onClose }: ResourcePanelProps) {
  const { t } = useLingui()
  const title = resource.title
  return (
    <SidePanel
      title={title}
      onClose={onClose}
      footer={
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ExternalLinkIcon aria-hidden />
          {resource.kind === "video" ? (
            <Trans>Open on YouTube</Trans>
          ) : (
            <Trans>Open in a new tab</Trans>
          )}
          <span className="sr-only">{t`(opens in a new tab)`}</span>
        </a>
      }
    >
      <div className="flex h-full flex-col gap-3">
        {resource.kind === "video" && resource.videoId ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <iframe
              src={youtubeEmbedUrlOf(resource.videoId)}
              title={title}
              className="size-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : null}
        {resource.kind === "image" ? (
          <img
            src={resource.url}
            alt={title}
            className="w-full rounded-lg bg-muted object-contain"
          />
        ) : null}
        {resource.kind === "page" ? (
          <>
            <iframe
              src={resource.url}
              title={title}
              className="min-h-96 w-full flex-1 rounded-lg border bg-background"
              // The page runs as on its own site, apart from the Desk, and opens no window.
              sandbox="allow-scripts allow-same-origin allow-forms"
              referrerPolicy="no-referrer"
            />
            <p className="text-xs text-muted-foreground">
              <Trans>
                If the page stays blank, its site does not allow being shown here: open it in a new
                tab.
              </Trans>
            </p>
          </>
        ) : null}
        {resource.description && resource.kind !== "page" ? (
          <p className="whitespace-pre-line text-muted-foreground">{resource.description}</p>
        ) : null}
      </div>
    </SidePanel>
  )
}

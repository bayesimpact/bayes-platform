import { Trans, useLingui } from "@lingui/react/macro"
import { ExternalLinkIcon } from "lucide-react"
import { SidePanel } from "@/components/shared/SidePanel"
import { buttonVariants } from "@/components/ui/button"
import { type PlayedVideo, youtubeEmbedUrlOf } from "../resource-media"

export type VideoPanelProps = {
  video: PlayedVideo
  onClose: () => void
}

/**
 * A video a reply points to, playing beside the conversation, as an artifact opens in the Claude
 * app: the person watches it while they read and write. It also opens on YouTube.
 */
export function VideoPanel({ video, onClose }: VideoPanelProps) {
  const { t } = useLingui()
  return (
    <SidePanel
      title={video.title}
      onClose={onClose}
      footer={
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ExternalLinkIcon aria-hidden />
          <Trans>Open on YouTube</Trans>
          <span className="sr-only">{t`(opens in a new tab)`}</span>
        </a>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
          <iframe
            src={youtubeEmbedUrlOf(video.videoId)}
            title={video.title}
            className="size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        {video.description ? (
          <p className="whitespace-pre-line text-muted-foreground">{video.description}</p>
        ) : null}
      </div>
    </SidePanel>
  )
}

import { useLingui } from "@lingui/react/macro"
import { ArrowUpRightIcon, PlayIcon } from "lucide-react"
import { useState } from "react"
import { toResourceUrl } from "@/lib/safe-url"
import type { ChatResource } from "../chat-messages"
import { resourceMediaOf } from "../resource-media"

export type ResourceCardProps = {
  resource: ChatResource
}

/**
 * A resource of the agent's libraries a reply points to, as a card that opens it, with the
 * thumbnail of a video or the image it is. A link that is neither a web page nor a library file
 * shows the card without a link.
 */
export function ResourceCard({ resource }: ResourceCardProps) {
  const { t } = useLingui()
  const [hasMediaFailed, setHasMediaFailed] = useState(false)
  const url = toResourceUrl(resource.link)
  const media = url && !hasMediaFailed ? resourceMediaOf(resource.link, url) : null

  const body = (
    <>
      {media?.kind === "youtube" ? (
        <span className="relative block aspect-video w-full overflow-hidden bg-muted">
          <img
            src={media.thumbnailUrl}
            alt=""
            className="size-full object-cover"
            onError={() => setHasMediaFailed(true)}
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-black/70 text-white">
              <PlayIcon aria-hidden className="size-6 translate-x-0.5 fill-current" />
            </span>
          </span>
        </span>
      ) : null}
      {media?.kind === "image" ? (
        <span className="flex max-h-72 w-full justify-center bg-muted">
          <img
            src={media.url}
            alt=""
            className="max-h-72 w-auto object-contain"
            onError={() => setHasMediaFailed(true)}
          />
        </span>
      ) : null}
      <span className="flex flex-col gap-1 p-3">
        <span className="flex items-center justify-between gap-2 font-medium">
          <span className="min-w-0 truncate">{resource.title}</span>
          {url ? (
            <ArrowUpRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          ) : null}
        </span>
        {resource.description ? (
          <span className="line-clamp-2 text-muted-foreground">{resource.description}</span>
        ) : null}
      </span>
    </>
  )

  const className = "flex h-full flex-col overflow-hidden rounded-xl border text-sm"
  if (url === null) return <div className={className}>{body}</div>
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} transition-colors hover:bg-muted`}
    >
      {body}
      <span className="sr-only">{t`(opens in a new tab)`}</span>
    </a>
  )
}

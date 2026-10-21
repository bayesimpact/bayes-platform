import { useLingui } from "@lingui/react/macro"
import { ArrowUpRightIcon } from "lucide-react"
import type { ChatResource } from "../chat-messages"

export type ResourceCardsProps = {
  resources: ChatResource[]
}

/**
 * Where a resource opens: its URL, or, for a file of a library, the API path that redirects to
 * the file, on this origin's `/api`.
 */
function resolveLink(link: string): string {
  return link.startsWith("/") ? `${window.location.origin}/api${link}` : link
}

/** The resources of the agent's libraries a reply points to, as cards that open them. */
export function ResourceCards({ resources }: ResourceCardsProps) {
  const { t } = useLingui()
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {resources.map((resource) => (
        <li key={resource.id}>
          <a
            href={resolveLink(resource.link)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full flex-col gap-1 rounded-xl border p-3 text-sm transition-colors hover:bg-muted"
          >
            <span className="flex items-center justify-between gap-2 font-medium">
              <span className="min-w-0 truncate">{resource.title}</span>
              <ArrowUpRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </span>
            {resource.description ? (
              <span className="line-clamp-2 text-muted-foreground">{resource.description}</span>
            ) : null}
            <span className="sr-only">{t`(opens in a new tab)`}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

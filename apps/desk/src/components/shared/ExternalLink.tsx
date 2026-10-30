import { Trans } from "@lingui/react/macro"
import { ExternalLinkIcon } from "lucide-react"
import type { ComponentProps } from "react"

export type ExternalLinkProps = Omit<ComponentProps<"a">, "target" | "rel"> & {
  /** Whether the text ends with the icon of an external link; a link that draws its own leaves it. */
  hasIcon?: boolean
}

/**
 * A link that opens in a new tab, away from the Desk: it says so to screen readers, and gives the
 * page it opens no hold on the Desk's.
 */
export function ExternalLink({ children, hasIcon = true, ...props }: ExternalLinkProps) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
      {hasIcon ? <ExternalLinkIcon aria-hidden className="size-3 shrink-0 self-center" /> : null}
      <span className="sr-only">
        <Trans>(opens in a new tab)</Trans>
      </span>
    </a>
  )
}

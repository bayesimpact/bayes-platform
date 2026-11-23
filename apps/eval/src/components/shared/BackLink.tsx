import { Link, type LinkProps } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"
import type { ReactNode } from "react"

export type BackLinkProps = Pick<LinkProps, "to" | "params" | "search"> & {
  children: ReactNode
}

/** The link of the top bar that goes back to the page above. */
export function BackLink({ children, ...link }: BackLinkProps) {
  return (
    <Link
      {...link}
      className="inline-flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <ArrowLeftIcon aria-hidden className="size-4 shrink-0" />
      {/* At phone width, the bar keeps the arrow and the page's actions: the name stays for screen readers. */}
      <span className="truncate max-sm:sr-only">{children}</span>
    </Link>
  )
}

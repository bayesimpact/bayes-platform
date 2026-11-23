import { useRender } from "@base-ui/react/use-render"
import { ArrowRightIcon } from "lucide-react"
import type { ReactNode } from "react"

export type NavCardProps = {
  /** The link the card is, such as a router `Link` with its target. */
  render: useRender.RenderProp
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  /** What sits beside the title, such as a mark on the entry opened last. */
  badge?: ReactNode
}

/** A card that is one link to a part of the app: what it opens, and a line on it. */
export function NavCard({ render, icon, title, description, badge }: NavCardProps) {
  return useRender({
    render,
    props: {
      className:
        "group flex h-full flex-col gap-3 rounded-lg border bg-background p-5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring dark:bg-card",
      children: (
        <>
          <span className="flex items-center justify-between gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-5">
              {icon}
            </span>
            {badge}
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-semibold">{title}</span>
            <ArrowRightIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </span>
          {description ? (
            <span className="text-sm text-muted-foreground">{description}</span>
          ) : null}
        </>
      ),
    },
  })
}

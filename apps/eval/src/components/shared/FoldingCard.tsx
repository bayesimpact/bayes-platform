import { ChevronDownIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export type FoldingCardProps = {
  title: ReactNode
  description: ReactNode
  /** What sits at the end of the title's row, such as a count. */
  aside?: ReactNode
  isOpenAtFirst: boolean
  children: ReactNode
}

/**
 * A card that folds to its header: a title, what sits beside it and a description on a grey band,
 * which opens or folds the card on a click.
 */
export function FoldingCard({
  title,
  description,
  aside,
  isOpenAtFirst,
  children,
}: FoldingCardProps) {
  return (
    <Collapsible
      defaultOpen={isOpenAtFirst}
      render={<section className="overflow-hidden rounded-lg border" />}
    >
      <h3>
        <CollapsibleTrigger className="group/folding flex w-full flex-col gap-1 bg-muted/50 px-3 py-2.5 text-left hover:bg-muted aria-expanded:border-b">
          <span className="flex w-full items-center justify-between gap-2">
            <span className="text-base font-semibold">{title}</span>
            <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
              {aside}
              <ChevronDownIcon
                aria-hidden
                className="size-4 transition-transform group-not-aria-expanded/folding:-rotate-90"
              />
            </span>
          </span>
          <span className="text-muted-foreground">{description}</span>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}

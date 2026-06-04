import { Badge, type BadgeVariant } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { cn } from "@caseai-connect/ui/utils"
import { ArrowRightIcon } from "lucide-react"
import type * as React from "react"
import { useGrid } from "./context"
import { colSpanClasses, getGridItemClassName } from "./GridItem.helpers"
import { useGridCell } from "./grid-cell-context"

type GridCardProps = React.ComponentProps<"div"> & {
  /**
   * Escape hatch for cards rendered outside a <GridContent> (e.g. cols={0}
   * stacked layouts). Ignored when the card is inside a GridContent, where the
   * position is derived automatically.
   */
  span?: "full" | number
}

/**
 * A composable grid card. Inside a <GridContent> it reads its position from
 * context and draws the internal grid borders / last-cell column span; the
 * caller never passes an index. Compose the card from the GridCard.* slots.
 */
function GridCard({ className, span, children, ...props }: GridCardProps) {
  const { cols } = useGrid()
  const cell = useGridCell()

  const gridClasses =
    cell && cols >= 1
      ? getGridItemClassName({ index: cell.index + 1, total: cell.total, cols })
      : span === "full"
        ? "col-span-full border-r-0"
        : span
          ? colSpanClasses[span]
          : undefined

  return (
    <div
      data-slot="grid-card"
      className={cn(
        "relative p-4 flex flex-col items-start justify-center has-data-[slot=grid-card-footer]:pb-0",
        className,
        gridClasses,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function GridCardTopAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="grid-card-top-action"
      className={cn("absolute top-3 right-3 flex items-center gap-1", className)}
      {...props}
    />
  )
}

function GridCardBadge({
  children,
  variant = "secondary",
  className,
}: {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  if (children === null || children === undefined || children === false) return null
  // Auto-wrap plain strings (preserving the capitalize behavior); pass nodes through.
  if (typeof children === "string") {
    return (
      <Badge variant={variant} className={cn("capitalize", className)}>
        {children}
      </Badge>
    )
  }
  return <>{children}</>
}

function GridCardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="grid-card-body" className={cn("py-2 px-1 w-full", className)} {...props} />
}

function GridCardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="grid-card-title"
      className={cn("text-xl font-medium capitalize-first flex items-center gap-2", className)}
      {...props}
    />
  )
}

function GridCardDescription({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="grid-card-description"
      className={cn(
        "text-base text-muted-foreground leading-snug mt-1 mb-4 capitalize-first",
        className,
      )}
      {...props}
    />
  )
}

/** The default arrow navigation button (the old GridItem onClick affordance). */
function GridCardGoButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      data-slot="grid-card-go-button"
      onClick={onClick}
      className={cn("rounded-full", className)}
      size="icon"
      variant="outline"
    >
      <ArrowRightIcon className="size-4" />
    </Button>
  )
}

function GridCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="grid-card-footer" className={cn("w-full mt-auto", className)} {...props} />
}

const GridCardNamespace = Object.assign(GridCard, {
  TopAction: GridCardTopAction,
  Badge: GridCardBadge,
  Body: GridCardBody,
  Title: GridCardTitle,
  Description: GridCardDescription,
  GoButton: GridCardGoButton,
  Footer: GridCardFooter,
})

export { GridCardNamespace as GridCard }

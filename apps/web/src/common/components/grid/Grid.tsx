import { Button } from "@caseai-connect/ui/shad/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { cn } from "@caseai-connect/ui/utils"
import { ArrowLeftIcon } from "lucide-react"
import { Children, isValidElement } from "react"
import { useBreakpoint } from "@/common/hooks/use-breakpoint"
import { GridContext, gridClass, useGrid } from "./context"
import { GridCellContext } from "./grid-cell-context"

export { GridCard } from "./GridCard"

export function Grid({
  children,
  cols,
  ...props
}: React.ComponentProps<"div"> & {
  cols: keyof typeof gridClass
}) {
  const { isShortViewport } = useBreakpoint()
  const adjustedCols = isShortViewport ? 1 : cols
  return (
    <GridContext.Provider value={{ cols: adjustedCols }}>
      <div data-slot="grid" {...props}>
        {children}
      </div>
    </GridContext.Provider>
  )
}

export function GridContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { cols } = useGrid()
  // Position/total are derived from the rendered children so call sites never
  // thread an `index`. Children.toArray drops falsy children, so conditional
  // cells (`{cond && <GridCard/>}`) are skipped automatically. The context
  // providers emit no DOM, so the grid's direct children are the cells.
  const cells = Children.toArray(children)
  const total = cells.length
  return (
    <div data-slot="grid-content" className={cn("grid", gridClass[cols], className)}>
      {cells.map((child, index) => (
        <GridCellContext.Provider
          key={(isValidElement(child) ? child.key : null) ?? index}
          value={{ index, total }}
        >
          {child}
        </GridCellContext.Provider>
      ))}
    </div>
  )
}

type GridHeaderProps = {
  className?: string
  onBack?: () => void
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

export function GridHeader(props: GridHeaderProps) {
  const { activeBreakpoints } = useBreakpoint()
  const isDesktop = activeBreakpoints.includes("sm")

  return (
    <Card
      className={cn(
        "shadow-none rounded-none border-0 border-b border-foreground-muted py-3 sm:py-6",
        props.className,
      )}
    >
      {isDesktop ? <DesktopHeader {...props} /> : <MobileHeader {...props} />}
    </Card>
  )
}

function DesktopHeader({ onBack, title, description, action }: GridHeaderProps) {
  return (
    <CardHeader className="gap-1">
      <CardTitle className="text-2xl flex items-center gap-1 min-w-0">
        {onBack && (
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full mr-2 shrink-0"
            onClick={onBack}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
        )}
        <div className="capitalize-first truncate">{title}</div>
      </CardTitle>

      {description && (
        <CardDescription
          className={cn("text-xl flex items-center gap-2 capitalize-first", onBack && "pl-12")}
        >
          {description}
        </CardDescription>
      )}

      {action && <CardAction className="flex items-center gap-2 flex-wrap">{action}</CardAction>}
    </CardHeader>
  )
}

function MobileHeader({ onBack, title, description, action }: GridHeaderProps) {
  return (
    <CardHeader className="gap-1">
      <CardTitle className="text-base flex items-center gap-1 min-w-0">
        {onBack && (
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full mr-2 shrink-0"
            onClick={onBack}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
        )}
        <div className="capitalize-first truncate">{title}</div>
      </CardTitle>

      {(description || action) && (
        <div className="flex items-center gap-2">
          <CardDescription className="text-sm flex items-center gap-2 capitalize-first shrink-0">
            {description}
          </CardDescription>
          {action && <div className="flex-1 [&>*]:w-full">{action}</div>}
        </div>
      )}
    </CardHeader>
  )
}

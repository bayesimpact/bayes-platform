import { Badge, type BadgeVariant } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { cn } from "@caseai-connect/ui/utils"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"
import { useBreakpoint } from "@/common/hooks/use-breakpoint"
import { GridContext, gridClass, useGrid } from "./context"
import { getGridItemClassName } from "./GridItem.helpers"

export function Grid({
  children,
  cols,
  total,
  extraItems = 0,
  ...props
}: React.ComponentProps<"div"> & {
  cols: keyof typeof gridClass
  total: number
  extraItems?: number
}) {
  const { isShortViewport } = useBreakpoint()
  const adjustedCols = isShortViewport ? 1 : cols
  return (
    <GridContext.Provider value={{ cols: adjustedCols, total: total + extraItems }}>
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
  return <div className={cn("grid", gridClass[cols], className)}>{children}</div>
}

type GridItemProps = {
  className?: string
  title: React.ReactNode
  description?: React.ReactNode
  index?: number
  footer?: React.ReactNode
  badge?: React.ReactNode
  badgeVariant?: BadgeVariant
  topAction?: React.ReactNode
  middleAction?: React.ReactNode
} & ({ onClick: () => void } | { action: React.ReactNode })

export function GridItem({
  className,
  title,
  description,
  footer,
  badge,
  badgeVariant = "secondary",
  index = -1,
  topAction,
  middleAction,
  ...props
}: GridItemProps) {
  const { cols, total } = useGrid()

  const action =
    "action" in props ? (
      props.action
    ) : (
      <Button onClick={props.onClick} className="rounded-full" size="icon" variant="outline">
        <ArrowRightIcon className="size-4" />
      </Button>
    )

  const renderedBadge =
    typeof badge === "string" ? (
      <Badge variant={badgeVariant} className="capitalize">
        {badge}
      </Badge>
    ) : (
      badge
    )

  return (
    <div
      className={cn(
        "relative p-4 flex flex-col items-start justify-center",
        footer && "pb-0",
        className,
        getGridItemClassName({ index: index + 1, total, cols }),
      )}
    >
      {topAction && (
        <div className="absolute top-3 right-3 flex items-center gap-1">{topAction}</div>
      )}

      {renderedBadge}

      <div className="py-2 px-1 w-full">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h2 className="text-xl font-medium capitalize-first flex items-center gap-2">
              {title}
            </h2>

            {description && (
              <h3 className="text-base text-muted-foreground leading-snug mt-1 mb-4 capitalize-first">
                {description}
              </h3>
            )}
          </div>
          {middleAction && <div>{middleAction}</div>}
        </div>

        {action}
      </div>

      {footer && <div className="w-full mt-auto">{footer}</div>}
    </div>
  )
}

export function GridHeader({
  onBack,
  title,
  description,
  action,
  className,
}: {
  className?: string
  onBack?: () => void
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Card
      className={cn(
        "shadow-none rounded-none border-0 border-b border-foreground-muted",
        className,
      )}
    >
      <CardHeader className="gap-0">
        <CardTitle className="text-2xl flex items-center gap-1">
          {onBack && (
            <Button variant="secondary" size="icon" className="rounded-full mr-2" onClick={onBack}>
              <ArrowLeftIcon className="size-4" />
            </Button>
          )}

          <div className="capitalize-first">{title}</div>
        </CardTitle>

        {description && (
          <CardDescription
            className={cn(
              "text-xl flex items-center gap-2 capitalize-first max-w-2/3",
              onBack && "pl-12",
            )}
          >
            {description}
          </CardDescription>
        )}

        {action && (
          <CardAction className="flex items-center gap-2 min-h-full flex-wrap">{action}</CardAction>
        )}
      </CardHeader>
    </Card>
  )
}

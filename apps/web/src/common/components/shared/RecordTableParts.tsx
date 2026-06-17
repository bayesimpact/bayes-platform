import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Input } from "@caseai-connect/ui/shad/input"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { cn } from "@caseai-connect/ui/utils"
import type { Column } from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchCheckIcon,
  SearchIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

export const DEFAULT_PAGE_SIZE = 10

export function TruncatedCell({ value, className }: { value: string; className?: string }) {
  if (!value) return <span className="text-muted-foreground">-</span>

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`truncate block text-left max-w-full cursor-pointer hover:text-foreground/80 ${className ?? ""}`}
        >
          {value}
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-h-80 w-96 overflow-auto">
        <p className="text-sm whitespace-pre-wrap wrap-break-word">{value}</p>
      </PopoverContent>
    </Popover>
  )
}

export function Search({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const hasValue = localValue.length > 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-muted-foreground hover:text-foreground transition-colors data-[state=open]:text-primary",
            hasValue && "text-primary",
          )}
        >
          {hasValue ? (
            <SearchCheckIcon className="size-3.5" />
          ) : (
            <SearchIcon className="size-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <Input
          className="h-7 text-xs font-normal bg-background"
          placeholder={t("actions:search")}
          value={localValue}
          type="search"
          onChange={(event) => {
            setLocalValue(event.target.value)
            onChange(event.target.value)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export function SortableFilterableHeader<TData>({
  column,
  label,
  badge,
  className,
  badgeProps = {
    variant: "outline",
  },
}: {
  column: Column<TData, unknown>
  label: string
  badge?: string
  className?: string
  badgeProps?: React.ComponentProps<typeof Badge>
}) {
  const sorted = column.getIsSorted()
  const filterValue = (column.getFilterValue() as string) ?? ""

  return (
    <div className="flex flex-row gap-1.5">
      <button
        type="button"
        className={cn(
          "flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors",
          className,
        )}
        onClick={column.getToggleSortingHandler()}
      >
        {label}
        {badge && <Badge {...badgeProps}>{badge}</Badge>}
        {sorted === "asc" ? (
          <ArrowUpIcon className="size-3.5" />
        ) : sorted === "desc" ? (
          <ArrowDownIcon className="size-3.5" />
        ) : (
          <ArrowUpDownIcon className="size-3.5" />
        )}
      </button>
      {column.getCanFilter() && (
        <Search value={filterValue} onChange={(value) => column.setFilterValue(value)} />
      )}
    </div>
  )
}

export function PaginationControls({
  pageIndex,
  pageCount,
  total,
  onPageChange,
}: {
  pageIndex: number
  pageCount: number
  total: number
  onPageChange: (pageIndex: number) => void
}) {
  const { t } = useTranslation()
  const from = pageIndex * DEFAULT_PAGE_SIZE + 1
  const to = Math.min((pageIndex + 1) * DEFAULT_PAGE_SIZE, total)

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-sm text-muted-foreground">
        {t("actions:pagination", { from, to, total })}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pageIndex <= 0}
          onClick={() => onPageChange(pageIndex - 1)}
        >
          <ChevronLeftIcon className="size-4" />
          {t("actions:previous")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {pageIndex + 1} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={pageIndex >= pageCount - 1}
          onClick={() => onPageChange(pageIndex + 1)}
        >
          {t("actions:next")}
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}

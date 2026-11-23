import { Trans, useLingui } from "@lingui/react/macro"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export type TablePaginationProps = {
  /** The page shown, counted from 0. */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/** Under a table the API pages: which rows show, and the way to the pages around. */
export function TablePagination({ page, pageSize, total, onPageChange }: TablePaginationProps) {
  const { t, i18n } = useLingui()
  if (total <= pageSize && page === 0) return null
  const first = i18n.number(total === 0 ? 0 : page * pageSize + 1)
  const last = i18n.number(Math.min(total, (page + 1) * pageSize))
  const count = i18n.number(total)
  return (
    <nav
      aria-label={t`Pages of the table`}
      className="flex items-center justify-between gap-2 px-1 text-sm text-muted-foreground"
    >
      <span className="tabular-nums">
        <Trans comment="Which rows of a table show, such as: Rows 11–20 of 42">
          Rows {first}–{last} of {count}
        </Trans>
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t`Previous page`}
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t`Next page`}
          disabled={(page + 1) * pageSize >= total}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
      </div>
    </nav>
  )
}

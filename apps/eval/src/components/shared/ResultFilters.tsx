import { Trans, useLingui } from "@lingui/react/macro"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type ResultFiltersProps<TFilter extends string> = {
  /** The filters offered, each with its name and how many results it keeps. */
  filters: { value: TFilter; label: string; count: number }[]
  value: TFilter
  onChange: (filter: TFilter) => void
}

/**
 * The filters of the table of a run's results, for an agent of any type: one stays on at a time.
 * Nothing shows while there is one filter only.
 */
export function ResultFilters<TFilter extends string>({
  filters,
  value,
  onChange,
}: ResultFiltersProps<TFilter>) {
  const { t, i18n } = useLingui()
  if (filters.length < 2) return null
  return (
    <ToggleGroup
      aria-label={t({
        message: "Filter the results",
        comment: "The label of the filters of the table of a run's results",
      })}
      variant="outline"
      size="sm"
      spacing={0}
      value={[value]}
      // A toggle group lets every item go: the filter stays when the person clicks it again.
      onValueChange={(values) => {
        const next = filters.find((filter) => filter.value === values[0])
        if (next) onChange(next.value)
      }}
    >
      {filters.map((filter) => {
        const filterName = filter.label
        const count = i18n.number(filter.count)
        return (
          <ToggleGroupItem key={filter.value} value={filter.value}>
            <Trans comment="A filter of a run's results and how many it keeps, such as: Errors (1)">
              {filterName} ({count})
            </Trans>
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

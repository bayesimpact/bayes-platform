import { cn } from "@caseai-connect/ui/utils"

const handleGridItemBorder = ({
  currentColumn,
  total,
  cols,
}: {
  currentColumn: number
  total: number
  cols: number
}) => {
  if (total <= 1 || currentColumn === 0) return undefined

  const isLastColumn = currentColumn % cols === 0 || currentColumn === total
  const totalRows = Math.ceil(total / cols)
  const currentRow = Math.ceil(currentColumn / cols)
  const isLastRow = currentRow === totalRows || currentColumn === total

  return cn(
    "border-foreground-muted",
    !isLastColumn && "border-r",
    totalRows > 1 && !isLastRow && "border-b",
  )
}
// Tailwind cannot detect dynamically constructed classes like `col-span-${n}`,
// so we use a static lookup to ensure the CSS is generated.
export const colSpanClasses: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
  7: "col-span-7",
  8: "col-span-8",
  9: "col-span-9",
}

const handleGridItemColSpan = ({
  index,
  total,
  cols,
}: {
  index: number
  total: number
  cols: number
}) => {
  if (total === 1) {
    return "col-span-full border-r-0"
  } else if (index === total && total % cols !== 0) {
    // if it's the last item and the total number of items is not a multiple of cols, it should span the remaining columns
    const remainingCols = cols - (total % cols) + 1
    if (remainingCols === 0) return
    return colSpanClasses[remainingCols]
  }
  return
}

export const getGridItemClassName = ({
  index,
  total,
  cols,
}: {
  index: number
  total: number
  cols: number
}) => {
  return cn(
    handleGridItemBorder({ currentColumn: index, total, cols }),
    handleGridItemColSpan({ index, total, cols }),
  )
}

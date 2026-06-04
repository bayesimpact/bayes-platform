import { createContext, useContext } from "react"

export type GridCellValue = {
  /** 0-based position of this cell within its GridContent. */
  index: number
  /** Total number of cells rendered in this GridContent. */
  total: number
}

export const GridCellContext = createContext<GridCellValue | null>(null)

/**
 * Read this cell's position within the surrounding GridContent. Returns null
 * when a GridCard is rendered outside a GridContent (e.g. cols={0} layouts),
 * in which case the card draws no internal grid borders.
 */
export function useGridCell() {
  return useContext(GridCellContext)
}

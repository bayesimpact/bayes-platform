import { createContext, useContext } from "react"

export const gridClass = {
  0: "grid-cols-none",
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  6: "grid-cols-6",
}

interface GridContextValue {
  cols: keyof typeof gridClass
}

export const GridContext = createContext<GridContextValue | null>(null)

export function useGrid() {
  const context = useContext(GridContext)
  if (!context) {
    throw new Error("useGrid must be used within a Grid")
  }
  return context
}

import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export type TableLoadingRowsProps = {
  /** What loads, for who cannot see the skeleton. */
  children: ReactNode
}

/** What a table shows in place of its rows while its first page loads. */
export function TableLoadingRows({ children }: TableLoadingRowsProps) {
  return (
    <output className="flex flex-col gap-2">
      <span className="sr-only">{children}</span>
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-2/3" />
    </output>
  )
}

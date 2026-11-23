import { Skeleton } from "@/components/ui/skeleton"
import { PageContainer } from "./PageContainer"

export type EvaluationPageSkeletonProps = {
  /** A page with a wide table takes all the width, as the page it stands for. */
  isWide?: boolean
  /** A run's page and a comparison show figures above their table. */
  hasFigures?: boolean
}

/**
 * The shape of a page of the evaluations while it loads: its title, its figures when it has
 * some, its tabs or filters, then its table. As wide as the page it stands for, so the content
 * does not jump when it arrives.
 */
export function EvaluationPageSkeleton({
  isWide = false,
  hasFigures = false,
}: EvaluationPageSkeletonProps) {
  return (
    <PageContainer isWide={isWide}>
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      {hasFigures ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      ) : null}
      <Skeleton className="h-9 w-56 max-w-full" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </PageContainer>
  )
}

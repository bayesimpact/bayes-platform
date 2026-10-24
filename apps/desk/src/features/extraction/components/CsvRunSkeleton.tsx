import { Skeleton } from "@/components/ui/skeleton"
import { CsvRecordsSkeleton } from "./CsvRecordsSkeleton"

/** A CSV run's page while it loads: its heading, its progress, then its table of rows. */
export function CsvRunSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-10 pb-16">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <CsvRecordsSkeleton />
    </div>
  )
}

import { Skeleton } from "@/components/ui/skeleton"

/** An extraction's page while it loads: its heading, then its content. */
export function ExtractionSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-10 pb-16">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  )
}

import { Skeleton } from "@/components/ui/skeleton"

/** A new extraction's page while the person's documents load. */
export function NewExtractionSkeleton() {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-4 pt-16 pb-16 md:pt-24"
    >
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-52 w-full rounded-3xl" />
    </div>
  )
}

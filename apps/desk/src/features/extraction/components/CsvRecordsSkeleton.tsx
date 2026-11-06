import { Skeleton } from "@/components/ui/skeleton"

/** The table of a CSV run's rows while its page loads. */
export function CsvRecordsSkeleton() {
  return <Skeleton aria-busy="true" className="h-96 w-full rounded-2xl" />
}

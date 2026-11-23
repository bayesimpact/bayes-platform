import { Skeleton } from "@/components/ui/skeleton"

/** A conversation's shape while its messages load. */
export function ConversationSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6" aria-busy="true">
      <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="mt-auto h-28 w-full rounded-2xl" />
    </div>
  )
}

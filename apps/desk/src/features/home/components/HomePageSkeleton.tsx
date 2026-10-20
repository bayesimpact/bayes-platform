import { Skeleton } from "@/components/ui/skeleton"

const PLACEHOLDER_CARDS = ["first", "second", "third", "fourth", "fifth", "sixth"]

/** The home's shape while its data loads: a title, a count and a grid of cards. */
export function HomePageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDER_CARDS.map((card) => (
          <Skeleton key={card} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

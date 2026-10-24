import { Skeleton } from "@/components/ui/skeleton"

/** The user menu's place in the bar while the signed-in person loads. */
export function UserMenuSkeleton() {
  return <Skeleton className="h-8 w-32" aria-hidden />
}

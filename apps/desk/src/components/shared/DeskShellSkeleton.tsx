import { Skeleton } from "@/components/ui/skeleton"
import { DeskShell } from "./DeskShell"
import { SidebarEntriesSkeleton } from "./SidebarEntriesSkeleton"

/** The Desk's frame while the agents load: a sidebar of placeholders and an empty center. */
export function DeskShellSkeleton() {
  return (
    <DeskShell
      header={<Skeleton className="h-8 w-full" />}
      sidebar={<SidebarEntriesSkeleton />}
      footer={<Skeleton className="h-8 w-32" />}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-16">
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-32 w-full max-w-2xl rounded-2xl" />
      </div>
    </DeskShell>
  )
}

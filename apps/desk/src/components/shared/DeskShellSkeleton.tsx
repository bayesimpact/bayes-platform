import { SidebarMenuSkeleton } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { DeskShell } from "./DeskShell"

const PLACEHOLDER_ENTRIES = ["first", "second", "third", "fourth", "fifth"]

/** The Desk's frame while the agents load: a sidebar of placeholders and an empty center. */
export function DeskShellSkeleton() {
  return (
    <DeskShell
      header={<Skeleton className="h-12 w-full" />}
      sidebar={
        <div className="flex flex-col gap-1 p-2" aria-busy="true">
          {PLACEHOLDER_ENTRIES.map((entry) => (
            <SidebarMenuSkeleton key={entry} />
          ))}
        </div>
      }
      footer={<Skeleton className="h-8 w-32" />}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-16">
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-32 w-full max-w-2xl rounded-2xl" />
      </div>
    </DeskShell>
  )
}

import { PageContainer } from "@/components/shared/PageContainer"
import { Skeleton } from "@/components/ui/skeleton"

/** The shape of a campaign page while it loads: its title, then its content. */
export function CampaignsPageSkeleton() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-10 w-80 max-w-full" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </PageContainer>
  )
}

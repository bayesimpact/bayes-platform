import { selectProjectsData } from "@/common/features/projects/projects.selectors"
import { projectsActions } from "@/common/features/projects/projects.slice"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { selectTesterContext } from "../features/review-campaigns/tester.selectors"
import { reviewCampaignsTesterActions } from "../features/review-campaigns/tester.slice"

export function CampaignRoute({ children }: { children: React.ReactNode }) {
  const projects = useAppSelector(selectProjectsData)
  const reviewCampaignId = useAppSelector(selectCurrentReviewCampaignId)
  const testerContext = useAppSelector(selectTesterContext)

  useMount({ actions: projectsActions, refreshOn: [reviewCampaignId] })

  useMount({
    actions: {
      mount: reviewCampaignsTesterActions.campaignMount,
      unmount: reviewCampaignsTesterActions.campaignUnmount,
    },
    condition: !!reviewCampaignId,
    refreshOn: [reviewCampaignId],
  })

  if (!reviewCampaignId) return <LoadingRoute />
  return <AsyncRoute data={[projects, testerContext]}>{children}</AsyncRoute>
}

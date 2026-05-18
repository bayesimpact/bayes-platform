import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useParams } from "react-router-dom"
import { HorizontalNavbar } from "@/common/components/sidebar/nav/HorizontalNavbar"
import { selectMe } from "@/common/features/me/me.selectors"
import { organizationsActions } from "@/common/features/organizations/organizations.slice"
import { projectsActions } from "@/common/features/projects/projects.slice"
import { currentReviewCampaignIdActions } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.slice"
import { currentReviewerSessionIdActions } from "@/common/features/review-campaigns/current-reviewer-session-id/current-reviewer-session-id.slice"
import { useInitStore } from "@/common/hooks/use-init-store"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { injectTesterSlices, resetTesterSlices } from "@/tester/store/slices"
import { injectReviewerSlices, resetReviewerSlices } from "../store/slices"
import { ReviewerRoutes } from "./helpers"

const useSetCurrentIds = () => {
  const dispatch = useAppDispatch()
  const params = useParams()
  useEffect(() => {
    const { organizationId, projectId, reviewCampaignId, sessionId } = params
    dispatch(
      organizationsActions.setCurrentOrganizationId({ organizationId: organizationId || null }),
    )
    dispatch(projectsActions.setCurrentProjectId({ projectId: projectId || null }))
    dispatch(
      currentReviewCampaignIdActions.setCurrentReviewCampaignId({
        reviewCampaignId: reviewCampaignId || null,
      }),
    )
    dispatch(
      currentReviewerSessionIdActions.setCurrentReviewerSessionId({
        reviewerSessionId: sessionId || null,
      }),
    )
  }, [dispatch, params])
}

export function ReviewerRoute() {
  const { t } = useTranslation()
  const { initDone } = useInitStore({
    inject: () => {
      injectTesterSlices()
      injectReviewerSlices()
    },
    reset(dispatch) {
      resetTesterSlices(dispatch)
      resetReviewerSlices(dispatch)
    },
    condition: true,
  })
  useSetCurrentIds()
  const me = useAppSelector(selectMe)
  if (!initDone) return <LoadingRoute />
  return (
    <AsyncRoute data={[me]}>
      {([user]) => (
        <>
          <HorizontalNavbar
            user={user}
            homePath={ReviewerRoutes.home.path}
            appName={t("reviewerCampaigns:shell.title")}
          />
          <div className="mx-10 xl:mx-20 my-10 relative border rounded-2xl overflow-hidden">
            <Outlet />
          </div>
        </>
      )}
    </AsyncRoute>
  )
}

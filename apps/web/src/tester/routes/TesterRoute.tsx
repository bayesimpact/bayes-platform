import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useParams } from "react-router-dom"
import { HorizontalNavbar } from "@/common/components/sidebar/nav/HorizontalNavbar"
import { currentAgentSessionIdActions } from "@/common/features/agents/agent-sessions/current-agent-session-id/current-agent-session-id.slice"
import { selectMe } from "@/common/features/me/me.selectors"
import { organizationsActions } from "@/common/features/organizations/organizations.slice"
import { projectsActions } from "@/common/features/projects/projects.slice"
import { currentReviewCampaignIdActions } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.slice"
import { useInitStore } from "@/common/hooks/use-init-store"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { injectTesterSlices, resetTesterSlices } from "../store/slices"
import { TesterRoutes } from "./helpers"

const useSetCurrentIds = () => {
  const dispatch = useAppDispatch()
  const params = useParams()
  useEffect(() => {
    const { organizationId, projectId, reviewCampaignId, agentSessionId } = params
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
      currentAgentSessionIdActions.setCurrentAgentSessionId({
        agentSessionId: agentSessionId || null,
      }),
    )
  }, [dispatch, params])
}

export function TesterRoute() {
  const { t } = useTranslation()
  const { initDone } = useInitStore({
    inject: injectTesterSlices,
    reset: resetTesterSlices,
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
            homePath={TesterRoutes.home.path}
            appName={t("testerCampaigns:shell.title")}
          />
          <Outlet />
        </>
      )}
    </AsyncRoute>
  )
}

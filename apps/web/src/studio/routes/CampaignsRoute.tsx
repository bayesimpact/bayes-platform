import { Button } from "@caseai-connect/ui/shad/button"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMatch, useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { CampaignList } from "../features/review-campaigns/components/CampaignList"
import { selectReviewCampaignsData } from "../features/review-campaigns/review-campaigns.selectors"
import { reviewCampaignsActions } from "../features/review-campaigns/review-campaigns.slice"
import { StudioRoutes } from "./helpers"

// The editor of an existing campaign has a URL, so the report can lead back to it.
export type EditorState =
  | { mode: "create"; campaignId?: undefined }
  | { mode: "edit"; campaignId: string; view: "form" | "report" }
  | null

export function CampaignsRoute() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const campaigns = useAppSelector(selectReviewCampaignsData)
  const agents = useAppSelector(selectAgentsData)
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useAppSelector(selectCurrentReviewCampaignId)
  const isReportOpen = useMatch(StudioRoutes.reviewCampaignReport.path) !== null
  const projectRoute = useGetProjectRoute()
  const handleBack = () => navigate(projectRoute)

  const [isCreating, setIsCreating] = useState(false)

  useMount({ actions: reviewCampaignsActions })

  const editor: EditorState = reviewCampaignId
    ? { mode: "edit", campaignId: reviewCampaignId, view: isReportOpen ? "report" : "form" }
    : isCreating
      ? { mode: "create" }
      : null

  const handleCreate = () => setIsCreating(true)
  const handleEdit = (campaignId: string) =>
    navigate(
      StudioRoutes.reviewCampaign.build({
        organizationId,
        projectId,
        reviewCampaignId: campaignId,
      }),
    )
  const handleCloseEditor = () => {
    setIsCreating(false)
    if (reviewCampaignId)
      navigate(StudioRoutes.reviewCampaigns.build({ organizationId, projectId }))
  }

  return (
    <div className="flex flex-col bg-white">
      <GridHeader
        onBack={handleBack}
        title={t("reviewCampaigns:title")}
        description={t("reviewCampaigns:subtitle")}
        action={
          <Button onClick={handleCreate}>
            <PlusIcon /> {t("reviewCampaigns:new")}
          </Button>
        }
      />

      <div className="p-6">
        <AsyncRoute data={[campaigns, agents]}>
          <CampaignList
            editor={editor}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onCloseEditor={handleCloseEditor}
          />
        </AsyncRoute>
      </div>
    </div>
  )
}

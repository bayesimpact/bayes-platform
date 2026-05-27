"use client"

import { Button } from "@caseai-connect/ui/shad/button"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { CampaignList } from "../features/review-campaigns/components/CampaignList"
import { selectReviewCampaignsData } from "../features/review-campaigns/review-campaigns.selectors"
import { reviewCampaignsActions } from "../features/review-campaigns/review-campaigns.slice"

export type EditorState =
  | { mode: "create"; campaignId?: undefined }
  | { mode: "edit"; campaignId: string }
  | null

export function CampaignsRoute() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const campaigns = useAppSelector(selectReviewCampaignsData)
  const agents = useAppSelector(selectAgentsData)
  const projectRoute = useGetProjectRoute()
  const handleBack = () => navigate(projectRoute)

  const [editor, setEditor] = useState<EditorState>(null)

  useMount({ actions: reviewCampaignsActions })

  return (
    <div className="flex flex-col bg-white">
      <GridHeader
        onBack={handleBack}
        title={t("reviewCampaigns:title")}
        description={t("reviewCampaigns:subtitle")}
        action={
          <Button onClick={() => setEditor({ mode: "create" })}>
            <PlusIcon /> {t("reviewCampaigns:new")}
          </Button>
        }
      />

      <div className="p-6">
        <AsyncRoute data={[campaigns, agents]}>
          <CampaignList editor={editor} setEditor={setEditor} />
        </AsyncRoute>
      </div>
    </div>
  )
}

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { ClipboardCheckIcon } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { useValue } from "@/common/hooks/use-value"
import { selectReviewCampaignsData } from "../review-campaigns.selectors"
import { type CampaignEditor, CampaignEditorSheet } from "./CampaignEditorSheet"
import { CampaignListTable } from "./CampaignListTable"

export function CampaignList({
  editor,
  onCreate,
  onEdit,
  onCloseEditor,
}: {
  editor: CampaignEditor | null
  onCreate: () => void
  onEdit: (campaignId: string) => void
  onCloseEditor: () => void
}) {
  const agents = useValue(selectAgentsData)
  const campaigns = useValue(selectReviewCampaignsData)
  // Review campaigns only support conversation agents as targets;
  // testerService.startSession rejects extraction agents (apps/api/.../tester.service.ts).
  // A campaign tests the published version, so an agent never published (a copy) is left out.
  const agentOptions = useMemo(() => {
    return agents
      .filter((agent) => agent.type === "conversation" && agent.currentRevision)
      .map((agent) => ({ id: agent.id, name: agent.name }))
  }, [agents])

  const membershipCountByCampaign = Object.fromEntries(
    campaigns.map((campaign) => [campaign.id, campaign.memberCount]),
  )

  return (
    <>
      {campaigns.length === 0 ? (
        <EmptyCampaigns />
      ) : (
        <CampaignListTable
          campaigns={campaigns}
          membershipCountByCampaign={membershipCountByCampaign}
          onEdit={onEdit}
          onDelete={onEdit}
          onCreate={onCreate}
        />
      )}
      {editor && (
        <CampaignEditorSheet open editor={editor} agents={agentOptions} onClose={onCloseEditor} />
      )}
    </>
  )
}

function EmptyCampaigns() {
  const { t } = useTranslation()
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ClipboardCheckIcon />
        </EmptyMedia>
        <EmptyTitle>{t("reviewCampaigns:empty.title")}</EmptyTitle>
        <EmptyDescription>{t("reviewCampaigns:empty.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

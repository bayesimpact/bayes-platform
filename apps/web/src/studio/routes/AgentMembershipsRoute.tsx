import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import {
  selectCurrentAgentData,
  selectCurrentAgentId,
} from "@/common/features/agents/agents.selectors"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { selectAgentMemberships } from "@/studio/features/agent-memberships/agent-memberships.selectors"
import { AgentMembershipItem } from "@/studio/features/agent-memberships/components/AgentMembershipItem"
import { MembersCreator } from "@/studio/features/agent-memberships/components/MembersCreator"
import { agentMembershipsActions } from "../features/agent-memberships/agent-memberships.slice"

export function AgentMembershipsRoute() {
  const agentId = useCurrentId(selectCurrentAgentId)
  const memberships = useAppSelector(selectAgentMemberships)

  useMount({ actions: agentMembershipsActions, refreshOn: [agentId] })

  return (
    <AsyncRoute data={[memberships]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const memberships = useValue(selectAgentMemberships)
  const agent = useValue(selectCurrentAgentData)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const agentRoute = useGetAgentRoute()
  const handleBack = () => navigate(agentRoute)

  const cols = memberships.length === 0 ? 0 : 3

  return (
    <Grid cols={cols}>
      <GridHeader
        onBack={handleBack}
        title={t("agentMembership:list.title", { agentName: agent.name })}
        description={t("agentMembership:list.description")}
      />

      <GridContent>
        {memberships.map((membership) => (
          <AgentMembershipItem key={membership.id} membership={membership} />
        ))}

        <GridCard className="bg-muted/35">
          <GridCard.Body>
            <GridCard.Title>{t("agentMembership:create.title")}</GridCard.Title>
            <GridCard.Description>{t("agentMembership:create.description")}</GridCard.Description>
            <MembersCreator agentId={agent.id} />
          </GridCard.Body>
        </GridCard>
      </GridContent>
    </Grid>
  )
}

import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridContent, GridHeader, GridItem } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { useGetPath } from "@/common/hooks/use-build-path"
import { useMount } from "@/common/hooks/use-mount"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import type { AgentMembership } from "@/studio/features/agent-memberships/agent-memberships.models"
import { selectAgentMemberships } from "@/studio/features/agent-memberships/agent-memberships.selectors"
import { AgentMembershipItem } from "@/studio/features/agent-memberships/components/AgentMembershipItem"
import { MembersCreator } from "@/studio/features/agent-memberships/components/MembersCreator"
import { agentMembershipsActions } from "../features/agent-memberships/agent-memberships.slice"

export function AgentMembershipsRoute() {
  const agent = useAppSelector(selectCurrentAgentData)
  const memberships = useAppSelector(selectAgentMemberships)

  useMount({
    actions: agentMembershipsActions,
  })

  return (
    <AsyncRoute data={[memberships, agent]}>
      {([membershipsValue, agentValue]) => (
        <WithData memberships={membershipsValue} agent={agentValue} />
      )}
    </AsyncRoute>
  )
}

function WithData({ memberships, agent }: { memberships: AgentMembership[]; agent: Agent }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getPath } = useGetPath()
  const handleBack = () => {
    const path = getPath("agent")
    navigate(path)
  }
  const cols = memberships.length === 0 ? 0 : 3
  const total = memberships.length

  return (
    <Grid cols={cols} total={total} extraItems={1}>
      <GridHeader
        onBack={handleBack}
        title={t("agentMembership:list.title", { agentName: agent.name })}
        description={t("agentMembership:list.description")}
      />

      <GridContent>
        {memberships.map((membership, index) => (
          <AgentMembershipItem index={index} key={membership.id} membership={membership} />
        ))}

        <GridItem
          index={total}
          title={t("agentMembership:create.title")}
          description={t("agentMembership:create.description")}
          action={<MembersCreator />}
          className="bg-muted/35"
        />
      </GridContent>
    </Grid>
  )
}

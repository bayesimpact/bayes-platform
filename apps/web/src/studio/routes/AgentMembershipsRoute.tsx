import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridContent, GridHeader, GridItem } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { AgentMembership } from "@/studio/features/agent-memberships/agent-memberships.models"
import {
  selectAgentMemberships,
  selectAgentPendingInvitations,
} from "@/studio/features/agent-memberships/agent-memberships.selectors"
import { AgentMembershipItem } from "@/studio/features/agent-memberships/components/AgentMembershipItem"
import { MembersCreator } from "@/studio/features/agent-memberships/components/MembersCreator"
import { PendingInvitationsSection } from "@/studio/features/invitations/components/PendingInvitationsSection"
import type { PendingInvitations } from "@/studio/features/invitations/invitations.models"
import { revokeInvitation } from "@/studio/features/invitations/invitations.thunks"
import { agentMembershipsActions } from "../features/agent-memberships/agent-memberships.slice"

export function AgentMembershipsRoute() {
  const agent = useAppSelector(selectCurrentAgentData)
  const memberships = useAppSelector(selectAgentMemberships)
  const pendingInvitations = useAppSelector(selectAgentPendingInvitations)

  useMount({ actions: agentMembershipsActions })

  return (
    <AsyncRoute data={[memberships, agent, pendingInvitations]}>
      {([membershipsValue, agentValue, pendingInvitationsValue]) => (
        <WithData
          memberships={membershipsValue}
          agent={agentValue}
          pendingInvitations={pendingInvitationsValue}
        />
      )}
    </AsyncRoute>
  )
}

function WithData({
  memberships,
  agent,
  pendingInvitations,
}: {
  memberships: AgentMembership[]
  agent: Agent
  pendingInvitations: PendingInvitations
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const getAgentRoute = useGetAgentRoute()
  const handleBack = () => navigate(getAgentRoute())

  const cols = memberships.length === 0 ? 0 : 3
  const total = memberships.length
  const handleRevokeInvitation = (invitationId: string) => {
    void dispatch(
      revokeInvitation({
        invitationId,
        refreshTarget: { targetType: "agent", targetId: agent.id },
      }),
    )
  }

  return (
    <>
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
            action={<MembersCreator agentId={agent.id} />}
            className="bg-muted/35"
          />
        </GridContent>
      </Grid>
      <PendingInvitationsSection
        invitations={pendingInvitations}
        title={t("agentMembership:pendingInvitations.title")}
        description={t("agentMembership:pendingInvitations.description")}
        onRevoke={handleRevokeInvitation}
      />
    </>
  )
}

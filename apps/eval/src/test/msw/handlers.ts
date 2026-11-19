import {
  EvalAccountRoutes,
  EvalAgentsRoutes,
  EvalMyInvitationsRoutes,
  EvalOrganizationsRoutes,
  EvalProjectsRoutes,
} from "@caseai-connect/eval-contracts"
import { buildMe } from "../factories/account.factory"
import { buildEvalWorld, type EvalWorld } from "../factories/eval-world.factory"
import { agentVersionsOf, campaignHandlers } from "./campaign-handlers"
import { apiError, mockRoute } from "./mock-route"

/** The routes that read a world, for the signed-in person: projects, agents and review campaigns. */
export function worldHandlers(world: EvalWorld, me = buildMe()) {
  return [
    mockRoute(EvalAccountRoutes.getMe, () => me),
    mockRoute(EvalProjectsRoutes.getAllMine, () => world.projects),
    mockRoute(EvalOrganizationsRoutes.getAllMine, () => world.organizations),
    mockRoute(EvalAgentsRoutes.getAllOfProject, ({ params }) =>
      world.agents.filter((agent) => agent.projectId === params.projectId),
    ),
    mockRoute(EvalAgentsRoutes.getVersions, ({ params }) => agentVersionsOf(world, params.agentId)),
    ...campaignHandlers(world, me),
    ...invitationHandlers(world),
  ]
}

/** The person's invitations: an accepted one to a campaign gives them its role there. */
function invitationHandlers(world: EvalWorld) {
  const answer = (invitationId: string, isAccepted: boolean) => {
    const pending = world.myInvitations.find((entry) => entry.invitation.id === invitationId)
    if (!pending) return apiError(404)
    world.myInvitations = world.myInvitations.filter((entry) => entry !== pending)
    const grant = pending.grantsCampaignRole
    if (isAccepted && grant) {
      const roles = world.myCampaignRoles[grant.campaignId] ?? []
      world.myCampaignRoles[grant.campaignId] = [...roles, grant.role]
    }
    return { success: true }
  }
  return [
    mockRoute(EvalMyInvitationsRoutes.getMine, () => ({
      invitations: world.myInvitations.map((entry) => entry.invitation),
    })),
    mockRoute(EvalMyInvitationsRoutes.acceptOne, ({ params }) => answer(params.invitationId, true)),
    mockRoute(EvalMyInvitationsRoutes.declineOne, ({ params }) =>
      answer(params.invitationId, false),
    ),
  ]
}

/** The API as each test starts from it: the signed-in person, and the main world, built afresh. */
export function evalHandlers(world: EvalWorld = buildEvalWorld()) {
  return worldHandlers(world)
}

import { Injectable } from "@nestjs/common"
import { Brackets, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Invitation } from "./invitation.entity"
import type { InvitationStatus, InvitationTargetType } from "./invitation.types"

/** Names shown with an invitation, and whether its target still exists. */
export type InvitationDetails = {
  organizationName: string
  projectName: string
  targetName: string
  /** Review campaign status, null for other targets. */
  targetStatus: string | null
  targetExists: boolean
  /** The agents the invitation also gives that still exist, by name. */
  agents: { id: string; name: string }[]
}

type InvitationDetailsRow = {
  id: string
  organization_name: string | null
  project_name: string | null
  target_name: string | null
  target_status: string | null
  target_exists: boolean
}

@Injectable()
export class InvitationRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async createPending(params: {
    organizationId: string
    projectId: string
    targetType: InvitationTargetType
    targetId: string
    userId: string
    invitedEmail: string
    role: string
    agentIds?: string[]
    invitationToken: string
  }): Promise<Invitation> {
    return this.repo().save(
      this.repo().create({
        ...params,
        agentIds: params.agentIds ?? [],
        status: "pending",
        invitedAt: new Date(),
        acceptedAt: null,
      }),
    )
  }

  async findById(invitationId: string): Promise<Invitation | null> {
    return this.repo().findOne({ where: { id: invitationId } })
  }

  async findPendingByIdForTarget(params: {
    invitationId: string
    targetType: InvitationTargetType
    targetId: string
  }): Promise<Invitation | null> {
    return this.repo().findOne({
      where: {
        id: params.invitationId,
        targetType: params.targetType,
        targetId: params.targetId,
        status: "pending",
      },
    })
  }

  /** Without a role, any pending invitation of the user to the target. */
  async findPendingForUserAndTarget(params: {
    userId: string
    targetType: InvitationTargetType
    targetId: string
    role?: string
  }): Promise<Invitation | null> {
    const { role, ...where } = params
    return this.repo().findOne({
      where: { ...where, ...(role ? { role } : {}), status: "pending" },
    })
  }

  /** The agent's own pending invitations, and the pending workspace invitations that give it. */
  async listPendingForAgent(agentId: string): Promise<Invitation[]> {
    return this.pendingForAgentQuery(agentId).orderBy("invitation.invitedAt", "DESC").getMany()
  }

  async findPendingByIdForAgent(params: {
    invitationId: string
    agentId: string
  }): Promise<Invitation | null> {
    return this.pendingForAgentQuery(params.agentId)
      .andWhere("invitation.id = :invitationId", { invitationId: params.invitationId })
      .getOne()
  }

  /** Takes an agent out of a workspace invitation. */
  async removeAgent(params: { invitationId: string; agentId: string }): Promise<void> {
    await this.transactionService
      .getManager()
      .query(`UPDATE invitation SET agent_ids = array_remove(agent_ids, $2::uuid) WHERE id = $1`, [
        params.invitationId,
        params.agentId,
      ])
  }

  /** Adds agents to a workspace invitation, keeping the ones it already gives. */
  async addAgents(params: { invitationId: string; agentIds: string[] }): Promise<Invitation> {
    await this.transactionService.getManager().query(
      `UPDATE invitation
      SET agent_ids = ARRAY(SELECT DISTINCT unnest(agent_ids || $2::uuid[]))
      WHERE id = $1`,
      [params.invitationId, params.agentIds],
    )
    return this.repo().findOneOrFail({ where: { id: params.invitationId } })
  }

  /** The agents of the project that are not deleted, among the ones given, or all of them. */
  async findLiveAgentIdsOfProject(params: {
    projectId: string
    agentIds?: string[]
  }): Promise<string[]> {
    const rows: { id: string }[] = await this.transactionService.getManager().query(
      `SELECT id FROM agent
      WHERE project_id = $1 AND deleted_at IS NULL AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))`,
      [params.projectId, params.agentIds ?? null],
    )
    return rows.map((row) => row.id)
  }

  async listPendingForUser(userId: string): Promise<Invitation[]> {
    return this.repo().find({
      where: { userId, status: "pending" },
      order: { invitedAt: "DESC" },
    })
  }

  async listPendingForTarget(params: {
    targetType: InvitationTargetType
    targetId: string
  }): Promise<Invitation[]> {
    return this.repo().find({
      where: { ...params, status: "pending" },
      order: { invitedAt: "DESC" },
    })
  }

  async updateStatus(params: {
    invitationId: string
    status: Exclude<InvitationStatus, "pending">
  }): Promise<void> {
    await this.repo().update(
      { id: params.invitationId },
      {
        status: params.status,
        ...(params.status === "accepted" ? { acceptedAt: new Date() } : {}),
      },
    )
  }

  /** Loads the organization, project and target names in one query, keyed by invitation id. */
  async findDetailsByInvitationIds(
    invitationIds: string[],
  ): Promise<Map<string, InvitationDetails>> {
    if (invitationIds.length === 0) return new Map()
    const rows: InvitationDetailsRow[] = await this.transactionService.getManager().query(
      `SELECT
        invitation.id,
        organization.name AS organization_name,
        project.name AS project_name,
        CASE invitation.target_type
          WHEN 'project' THEN project.name
          WHEN 'agent' THEN agent.name
          ELSE review_campaign.name
        END AS target_name,
        review_campaign.status AS target_status,
        CASE invitation.target_type
          WHEN 'project' THEN project.id IS NOT NULL
          WHEN 'agent' THEN agent.id IS NOT NULL
          ELSE review_campaign.id IS NOT NULL
        END AS target_exists
      FROM invitation
      LEFT JOIN organization
        ON organization.id = invitation.organization_id AND organization.deleted_at IS NULL
      LEFT JOIN project
        ON project.id = invitation.project_id AND project.deleted_at IS NULL
      LEFT JOIN agent
        ON invitation.target_type = 'agent'
        AND agent.id = invitation.target_id
        AND agent.deleted_at IS NULL
      LEFT JOIN review_campaign
        ON invitation.target_type = 'review_campaign'
        AND review_campaign.id = invitation.target_id
        AND review_campaign.deleted_at IS NULL
      WHERE invitation.id = ANY($1::uuid[])`,
      [invitationIds],
    )
    const agentsById = await this.findAgentsByInvitationIds(invitationIds)
    return new Map(
      rows.map((row) => [
        row.id,
        {
          organizationName: row.organization_name ?? "",
          projectName: row.project_name ?? "",
          targetName: row.target_name ?? "",
          targetStatus: row.target_status,
          targetExists: row.target_exists,
          agents: agentsById.get(row.id) ?? [],
        },
      ]),
    )
  }

  private async findAgentsByInvitationIds(
    invitationIds: string[],
  ): Promise<Map<string, { id: string; name: string }[]>> {
    const rows: { invitation_id: string; id: string; name: string }[] =
      await this.transactionService.getManager().query(
        `SELECT invitation.id AS invitation_id, agent.id, agent.name
        FROM invitation
        JOIN agent ON agent.id = ANY(invitation.agent_ids) AND agent.deleted_at IS NULL
        WHERE invitation.id = ANY($1::uuid[])
        ORDER BY agent.name`,
        [invitationIds],
      )
    const agentsById = new Map<string, { id: string; name: string }[]>()
    for (const row of rows) {
      const agents = agentsById.get(row.invitation_id) ?? []
      agents.push({ id: row.id, name: row.name })
      agentsById.set(row.invitation_id, agents)
    }
    return agentsById
  }

  private pendingForAgentQuery(agentId: string) {
    return this.repo()
      .createQueryBuilder("invitation")
      .where("invitation.status = 'pending'")
      .andWhere(
        new Brackets((query) => {
          query
            .where("invitation.target_type = 'agent' AND invitation.target_id = :agentId", {
              agentId,
            })
            .orWhere(
              "invitation.target_type = 'project' AND :agentId = ANY(invitation.agent_ids)",
              {
                agentId,
              },
            )
        }),
      )
  }

  private repo(): Repository<Invitation> {
    return this.transactionService.getManager().getRepository(Invitation)
  }
}

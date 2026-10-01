import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
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
    invitationToken: string
  }): Promise<Invitation> {
    return this.repo().save(
      this.repo().create({
        ...params,
        status: "pending",
        invitedAt: new Date(),
        acceptedAt: null,
      }),
    )
  }

  async findById(invitationId: string): Promise<Invitation | null> {
    return this.repo().findOne({ where: { id: invitationId } })
  }

  async findPendingById(invitationId: string): Promise<Invitation | null> {
    return this.repo().findOne({ where: { id: invitationId, status: "pending" } })
  }

  async findPendingForUserAndTarget(params: {
    userId: string
    targetType: InvitationTargetType
    targetId: string
    role: string
  }): Promise<Invitation | null> {
    return this.repo().findOne({ where: { ...params, status: "pending" } })
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
    return new Map(
      rows.map((row) => [
        row.id,
        {
          organizationName: row.organization_name ?? "",
          projectName: row.project_name ?? "",
          targetName: row.target_name ?? "",
          targetStatus: row.target_status,
          targetExists: row.target_exists,
        },
      ]),
    )
  }

  private repo(): Repository<Invitation> {
    return this.transactionService.getManager().getRepository(Invitation)
  }
}

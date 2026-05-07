import { writeFileSync } from "node:fs"
import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { DataSource } from "typeorm"
import { AppModule } from "@/app.module"
import type { InvitationSender } from "@/domains/auth/invitation-sender.interface"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { ask, confirmDatabaseTarget } from "@/scripts/script-bootstrap"

const PLACEHOLDER_AUTH0_ID_PREFIX = "00000000-0000-0000-0000-"

const logger = new Logger("ManageInvitations")

type PendingInvitation = {
  index: number
  invitationId: string
  membershipId: string
  email: string
  userName: string | null
  auth0Id: string
  hasAccount: boolean
  projectName: string
  organizationName: string
  role: string
  sentAt: Date
}

async function listPendingInvitations(dataSource: DataSource): Promise<PendingInvitation[]> {
  const rows = await dataSource
    .createQueryBuilder()
    .select("inv.id", "invitationId")
    .addSelect("pm.id", "membershipId")
    .addSelect("u.email", "email")
    .addSelect("u.name", "userName")
    .addSelect("u.auth0_id", "auth0Id")
    .addSelect("p.name", "projectName")
    .addSelect("o.name", "organizationName")
    .addSelect("inv.role", "role")
    .addSelect("inv.invited_at", "sentAt")
    .from("invitation", "inv")
    .innerJoin("user", "u", "inv.user_id = u.id")
    .innerJoin("project", "p", "inv.target_id = p.id AND inv.target_type = 'project'")
    .innerJoin("organization", "o", "p.organization_id = o.id")
    .innerJoin(
      "project_membership",
      "pm",
      "pm.project_id = inv.target_id AND pm.user_id = inv.user_id",
    )
    .where("inv.status = :status", { status: "pending" })
    .orderBy("o.name", "ASC")
    .addOrderBy("inv.invited_at", "ASC")
    .getRawMany()

  return rows.map((row: Record<string, unknown>, index: number) => {
    const auth0Id = row.auth0Id as string
    return {
      index: index + 1,
      invitationId: row.invitationId as string,
      membershipId: row.membershipId as string,
      email: row.email,
      userName: row.userName,
      auth0Id,
      hasAccount: !auth0Id.startsWith(PLACEHOLDER_AUTH0_ID_PREFIX),
      projectName: row.projectName,
      organizationName: row.organizationName,
      role: row.role,
      sentAt: row.sentAt,
    } as PendingInvitation
  })
}

function printInvitations(invitations: PendingInvitation[]): void {
  if (invitations.length === 0) {
    logger.log("No pending invitations found.")
    return
  }

  logger.log(`Found ${invitations.length} pending invitation(s):`)
  logger.log("")
  for (const invitation of invitations) {
    const accountStatus = invitation.hasAccount ? "has account" : "no account"
    logger.log(
      `  [${invitation.index}] ${invitation.email} — ${invitation.organizationName} / ${invitation.projectName} (${invitation.role}) — ${accountStatus} — sent ${invitation.sentAt.toISOString()}`,
    )
  }
  logger.log("")
}

async function resendInvitation(
  dataSource: DataSource,
  invitationSender: InvitationSender,
  invitation: PendingInvitation,
  inviterName: string,
): Promise<void> {
  const { ticketId } = await invitationSender.sendInvitation({
    inviteeEmail: invitation.email,
    inviterName,
  })

  await dataSource
    .createQueryBuilder()
    .update("project_membership")
    .set({ invitationToken: ticketId })
    .where("id = :id", { id: invitation.membershipId })
    .execute()

  await dataSource
    .createQueryBuilder()
    .update("invitation")
    .set({ invitationToken: ticketId })
    .where("id = :id", { id: invitation.invitationId })
    .execute()

  logger.log(`Invitation resent to ${invitation.email} (new ticketId: ${ticketId})`)
}

async function bootstrapCli(): Promise<void> {
  await confirmDatabaseTarget(logger)

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  })

  try {
    const dataSource = app.get(DataSource)
    const invitationSender = app.get(INVITATION_SENDER)
    const invitations = await listPendingInvitations(dataSource)

    printInvitations(invitations)

    if (invitations.length === 0) {
      return
    }

    const selection = await ask(
      "Enter invitation number(s) to resend (comma-separated), 'all', 'export', or 'q' to quit: ",
    )

    if (selection.toLowerCase() === "q") {
      logger.log("Aborted.")
      return
    }

    if (selection.toLowerCase() === "export") {
      const header = "email,userName,organizationName,projectName,role,hasAccount,sentAt"
      const rows = invitations.map((invitation) =>
        [
          invitation.email,
          invitation.userName ?? "",
          invitation.organizationName,
          invitation.projectName,
          invitation.role,
          invitation.hasAccount ? "yes" : "no",
          invitation.sentAt.toISOString(),
        ].join(","),
      )
      const filePath = "dontsave-pending-invitations.csv"
      writeFileSync(filePath, [header, ...rows].join("\n"))
      logger.log(`Exported to ${filePath}`)
      return
    }

    const inviterName = (await ask("Inviter name (default: CaseAI Connect): ")) || "CaseAI Connect"

    let toResend: PendingInvitation[]
    if (selection.toLowerCase() === "all") {
      toResend = invitations
    } else {
      const indices = selection.split(",").map((str) => Number.parseInt(str.trim(), 10))
      toResend = indices
        .map((index) => invitations.find((invitation) => invitation.index === index))
        .filter((invitation): invitation is PendingInvitation => invitation !== undefined)

      if (toResend.length === 0) {
        logger.warn("No valid selections. Aborting.")
        return
      }
    }

    logger.log(`Resending ${toResend.length} invitation(s)...`)

    for (const invitation of toResend) {
      try {
        await resendInvitation(dataSource, invitationSender, invitation, inviterName)
      } catch (error) {
        logger.error(
          `Failed to resend to ${invitation.email}: ${error instanceof Error ? error.message : "Unknown error"}`,
        )
      }
    }

    logger.log("Done.")
  } finally {
    await app.close()
  }
}

if (require.main === module) {
  void bootstrapCli()
}

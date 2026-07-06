import { readFileSync } from "node:fs"
import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { DataSource } from "typeorm"
import { AppModule } from "@/app.module"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { OrganizationMembershipService } from "@/domains/organizations/memberships/organization-membership.service"
import {
  type InviteWorkspaceOwnerResult,
  type PreviewWorkspaceInvitationResult,
  WorkspaceInvitationService,
} from "@/domains/organizations/provisioning/workspace-invitation.service"
import { confirmDatabaseTarget } from "@/scripts/script-bootstrap"

type CliOptions = {
  csvFilePath: string
  dryRun: boolean
  inviterName: string
}

type CsvRow = {
  email: string
  organizationName: string
  workspaceName?: string
  fullName?: string
}

type CliRowResult =
  | InviteWorkspaceOwnerResult
  | {
      status: "failed"
      email: string
      organizationName: string
      message: string
    }
  | PreviewWorkspaceInvitationResult

export function parseCliOptions(argv: string[]): CliOptions {
  const csvFilePathIndex = argv.indexOf("--file")
  if (csvFilePathIndex < 0 || !argv[csvFilePathIndex + 1]) {
    throw new Error("Missing required argument: --file <path-to-csv>")
  }

  const inviterNameIndex = argv.indexOf("--inviter-name")
  const inviterName =
    inviterNameIndex >= 0 && argv[inviterNameIndex + 1]
      ? argv[inviterNameIndex + 1]!
      : "CaseAI Connect"

  return {
    csvFilePath: argv[csvFilePathIndex + 1]!,
    dryRun: argv.includes("--dry-run"),
    inviterName,
  }
}

export function parseInvitationCsv(csvContent: string): CsvRow[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) {
    return []
  }

  const headerColumns = parseCsvLine(lines[0]!)
  const emailIndex = headerColumns.indexOf("email")
  const organizationNameIndex = headerColumns.indexOf("organizationName")
  const workspaceNameIndex = headerColumns.indexOf("workspaceName")
  const fullNameIndex = headerColumns.indexOf("fullName")

  if (emailIndex < 0 || organizationNameIndex < 0) {
    throw new Error("CSV must include required headers: email, organizationName")
  }

  return lines.slice(1).map((line, lineIndex) => {
    const values = parseCsvLine(line)
    const email = values[emailIndex]?.trim() ?? ""
    const organizationName = values[organizationNameIndex]?.trim() ?? ""
    const workspaceName = workspaceNameIndex >= 0 ? values[workspaceNameIndex]?.trim() : undefined
    const fullName = fullNameIndex >= 0 ? values[fullNameIndex]?.trim() : undefined

    if (!email || !organizationName) {
      throw new Error(
        `Invalid CSV row at line ${lineIndex + 2}: email and organizationName are required`,
      )
    }

    return {
      email,
      organizationName,
      ...(workspaceName ? { workspaceName } : {}),
      ...(fullName ? { fullName } : {}),
    }
  })
}

export async function runInvitationBatch(params: {
  rows: CsvRow[]
  dryRun: boolean
  inviterName: string
  invitationService: WorkspaceInvitationService
}): Promise<CliRowResult[]> {
  const results: CliRowResult[] = []

  for (const row of params.rows) {
    try {
      if (params.dryRun) {
        const preview = await params.invitationService.previewInvitation({
          email: row.email,
          organizationName: row.organizationName,
        })
        results.push(preview)
        continue
      }

      const rowResult = await params.invitationService.inviteWorkspaceOwner({
        email: row.email,
        organizationName: row.organizationName,
        workspaceName: row.workspaceName,
        inviterName: params.inviterName,
        fullName: row.fullName,
      })
      results.push(rowResult)
    } catch (error) {
      results.push({
        status: "failed",
        email: row.email.trim().toLowerCase(),
        organizationName: row.organizationName.trim(),
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return results
}

const logger = new Logger("InviteOrganizationOwners")

function printSummary(results: CliRowResult[]): void {
  const invitedCount = results.filter((result) => result.status === "invited").length
  const skippedCount = results.filter((result) =>
    ["skipped_existing_membership", "would_skip_existing_membership"].includes(result.status),
  ).length
  const failedCount = results.filter((result) => result.status === "failed").length
  const wouldInviteCount = results.filter((result) => result.status === "would_invite").length

  for (const result of results) {
    const message = "message" in result ? ` message=${result.message}` : ""
    logger.log(
      `[${result.status}] email=${result.email} organization=${result.organizationName}${message}`,
    )
  }

  logger.log("-----")
  logger.log(
    `Summary: total=${results.length} invited=${invitedCount} skipped=${skippedCount} failed=${failedCount} would_invite=${wouldInviteCount}`,
  )
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let currentValue = ""
  let insideQuotes = false

  for (const character of line) {
    if (character === '"') {
      insideQuotes = !insideQuotes
      continue
    }

    if (character === "," && !insideQuotes) {
      values.push(currentValue)
      currentValue = ""
      continue
    }

    currentValue += character
  }

  values.push(currentValue)
  return values
}

async function bootstrapCli(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  const csvContent = readFileSync(options.csvFilePath, "utf-8")
  const rows = parseInvitationCsv(csvContent)
  await confirmDatabaseTarget(logger)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  })

  try {
    const dataSource = app.get(DataSource)
    const invitationSender = app.get(INVITATION_SENDER)
    const organizationMembershipService = app.get(OrganizationMembershipService)
    const invitationService = new WorkspaceInvitationService(
      invitationSender,
      dataSource,
      organizationMembershipService,
    )
    logger.log(`Processing ${rows.length} row(s)...`)
    const results = await runInvitationBatch({
      rows,
      dryRun: options.dryRun,
      inviterName: options.inviterName,
      invitationService,
    })
    printSummary(results)
  } finally {
    await app.close()
  }
}

if (require.main === module) {
  void bootstrapCli()
}

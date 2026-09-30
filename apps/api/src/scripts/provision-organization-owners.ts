import { readFileSync } from "node:fs"
import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { DataSource } from "typeorm"
import { AppModule } from "@/app.module"
import { TransactionService } from "@/common/transaction/transaction.service"
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
import {
  type PreviewWorkspaceOwnerProvisioningResult,
  type ProvisionWorkspaceOwnerResult,
  WorkspaceOwnerProvisioningService,
} from "@/domains/organizations/provisioning/workspace-owner-provisioning.service"
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
import { confirmDatabaseTarget } from "@/scripts/script-bootstrap"

type CliOptions = {
  csvFilePath: string
  dryRun: boolean
}

type CsvRow = {
  email: string
  organizationName: string
  workspaceName?: string
  fullName?: string
}

type CliRowResult =
  | ProvisionWorkspaceOwnerResult
  | {
      status: "failed"
      email: string
      organizationName: string
      message: string
    }
  | PreviewWorkspaceOwnerProvisioningResult

export function parseCliOptions(argv: string[]): CliOptions {
  const csvFilePathIndex = argv.indexOf("--file")
  if (csvFilePathIndex < 0 || !argv[csvFilePathIndex + 1]) {
    throw new Error("Missing required argument: --file <path-to-csv>")
  }

  return {
    csvFilePath: argv[csvFilePathIndex + 1]!,
    dryRun: argv.includes("--dry-run"),
  }
}

export function parseOwnersCsv(csvContent: string): CsvRow[] {
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

export async function runProvisioningBatch(params: {
  rows: CsvRow[]
  dryRun: boolean
  provisioningService: WorkspaceOwnerProvisioningService
}): Promise<CliRowResult[]> {
  const results: CliRowResult[] = []

  for (const row of params.rows) {
    try {
      if (params.dryRun) {
        const preview = await params.provisioningService.previewProvisioning({
          email: row.email,
          organizationName: row.organizationName,
        })
        results.push(preview)
        continue
      }

      const rowResult = await params.provisioningService.provisionWorkspaceOwner({
        email: row.email,
        organizationName: row.organizationName,
        workspaceName: row.workspaceName,
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

const logger = new Logger("ProvisionOrganizationOwners")

function printSummary(results: CliRowResult[]): void {
  const grantedCount = results.filter((result) => result.status === "granted").length
  const skippedCount = results.filter((result) =>
    ["skipped_existing_membership", "would_skip_existing_membership"].includes(result.status),
  ).length
  const failedCount = results.filter((result) => result.status === "failed").length
  const wouldGrantCount = results.filter((result) => result.status === "would_grant").length

  for (const result of results) {
    const message = "message" in result ? ` message=${result.message}` : ""
    logger.log(
      `[${result.status}] email=${result.email} organization=${result.organizationName}${message}`,
    )
  }

  logger.log("-----")
  logger.log(
    `Summary: total=${results.length} granted=${grantedCount} skipped=${skippedCount} failed=${failedCount} would_grant=${wouldGrantCount}`,
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
  const rows = parseOwnersCsv(csvContent)
  await confirmDatabaseTarget(logger)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  })

  try {
    const dataSource = app.get(DataSource)
    const organizationMembershipsService = app.get(OrganizationMembershipsService)
    const projectMembershipsService = app.get(ProjectMembershipsService)
    const transactionService = app.get(TransactionService)
    const provisioningService = new WorkspaceOwnerProvisioningService(
      dataSource,
      organizationMembershipsService,
      projectMembershipsService,
      transactionService,
    )
    logger.log(`Processing ${rows.length} row(s)...`)
    const results = await runProvisioningBatch({
      rows,
      dryRun: options.dryRun,
      provisioningService,
    })
    printSummary(results)
  } finally {
    await app.close()
  }
}

if (require.main === module) {
  void bootstrapCli()
}

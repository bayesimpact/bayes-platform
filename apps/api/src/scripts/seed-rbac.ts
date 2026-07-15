import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "@/app.module"
import { RbacService } from "@/domains/rbac/rbac.service"
import { confirmDatabaseTarget } from "@/scripts/script-bootstrap"

const logger = new Logger("SeedRbac")

async function main(): Promise<void> {
  await confirmDatabaseTarget(logger)

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  })

  try {
    const rbacService = app.get(RbacService)
    await rbacService.seedOrganizationRolesAndPermissions()
    const updatedCount = await rbacService.assignRoleIdsToOrganizationMemberships()
    const orgCreatorCount = await rbacService.assignOrgCreatorToEligibleUsers()
    logger.log(`Assigned role_id on ${updatedCount} organization membership(s)`)
    logger.log(`Assigned org_creator on ${orgCreatorCount} user(s)`)
  } finally {
    await app.close()
  }
}

void main()

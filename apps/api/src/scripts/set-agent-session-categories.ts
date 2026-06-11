import { Logger, Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import typeorm from "@/config/typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import {
  parseUniqueCommaSeparatedCategoryNames,
  resolveConfiguredDefaultAgentSessionCategoryNames,
} from "@/domains/agents/session-categories/agent-default-session-category-names"
import { AgentSessionCategoriesService } from "@/domains/agents/session-categories/agent-session-categories.service"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import { ProjectSessionCategory } from "@/domains/agents/session-categories/project-session-category.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { Project } from "@/domains/projects/project.entity"
import { ask, confirmDatabaseTarget } from "@/scripts/script-bootstrap"

const logger = new Logger("SetAgentSessionCategories")

type CliOptions = {
  categoryNames?: string[]
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typeorm],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => configService.get("typeorm")(),
    }),
    TypeOrmModule.forFeature([
      Organization,
      Project,
      Agent,
      ProjectSessionCategory,
      AgentSessionCategory,
    ]),
  ],
  providers: [AgentSessionCategoriesService],
})
class SetAgentSessionCategoriesCliModule {}

function parseCliOptions(argv: string[]): CliOptions {
  const categoriesIndex = argv.indexOf("--categories")
  if (categoriesIndex < 0 || !argv[categoriesIndex + 1]) {
    return {}
  }

  return {
    categoryNames: parseUniqueCommaSeparatedCategoryNames(argv[categoriesIndex + 1]!),
  }
}

function mergeCategoryNameLists(primary: string[], secondary: string[]): string[] {
  const mergedCategoryNames: string[] = []
  const seenCategoryNames = new Set<string>()

  for (const categoryName of primary) {
    if (!seenCategoryNames.has(categoryName)) {
      seenCategoryNames.add(categoryName)
      mergedCategoryNames.push(categoryName)
    }
  }

  for (const categoryName of secondary) {
    if (!seenCategoryNames.has(categoryName)) {
      seenCategoryNames.add(categoryName)
      mergedCategoryNames.push(categoryName)
    }
  }

  return mergedCategoryNames
}

async function selectFromList<T>(params: {
  title: string
  items: T[]
  toLine: (item: T, index: number) => string
}): Promise<T> {
  if (params.items.length === 0) {
    throw new Error(`Cannot select from empty list for "${params.title}"`)
  }

  logger.log(`\n${params.title}`)
  for (const [itemIndex, item] of params.items.entries()) {
    logger.log(`  [${itemIndex + 1}] ${params.toLine(item, itemIndex)}`)
  }

  while (true) {
    const answer = await ask(`Choose ${params.title.toLowerCase()} number (or 'q' to quit): `)
    if (answer.toLowerCase() === "q") {
      logger.log("Aborted.")
      process.exit(0)
    }

    const chosenIndex = Number.parseInt(answer, 10)
    if (!Number.isNaN(chosenIndex) && chosenIndex >= 1 && chosenIndex <= params.items.length) {
      return params.items[chosenIndex - 1]!
    }

    logger.warn("Invalid selection. Please enter one of the listed numbers.")
  }
}

function parseMultiSelectIndexes(value: string, max: number): number[] | null {
  if (value.trim().toLowerCase() === "all") {
    return Array.from({ length: max }, (_unusedValue, itemIndex) => itemIndex)
  }

  const selectedIndexes = new Set<number>()
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (parts.length === 0) {
    return []
  }

  for (const part of parts) {
    const selectedNumber = Number.parseInt(part, 10)
    if (Number.isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > max) {
      return null
    }
    selectedIndexes.add(selectedNumber - 1)
  }

  return Array.from(selectedIndexes)
}

async function selectManyFromList<T>(params: {
  title: string
  items: T[]
  toLine: (item: T, index: number) => string
}): Promise<T[]> {
  if (params.items.length === 0) {
    throw new Error(`Cannot select from empty list for "${params.title}"`)
  }

  logger.log(`\n${params.title}`)
  for (const [itemIndex, item] of params.items.entries()) {
    logger.log(`  [${itemIndex + 1}] ${params.toLine(item, itemIndex)}`)
  }
  logger.log("Type comma-separated numbers (example: 1,3,4), 'all', or 'q' to quit.")

  while (true) {
    const answer = await ask(`Choose ${params.title.toLowerCase()}: `)
    if (answer.toLowerCase() === "q") {
      logger.log("Aborted.")
      process.exit(0)
    }

    const selectedIndexes = parseMultiSelectIndexes(answer, params.items.length)
    if (selectedIndexes === null) {
      logger.warn("Invalid selection. Please enter listed numbers separated by commas, or 'all'.")
      continue
    }
    if (selectedIndexes.length === 0) {
      logger.warn("Select at least one category.")
      continue
    }

    return selectedIndexes.map((selectedIndex) => params.items[selectedIndex]!)
  }
}

function resolveCliSelectedProjectCategories(params: {
  cliOptions: CliOptions
  availableProjectCategories: ProjectSessionCategory[]
}): ProjectSessionCategory[] {
  if (!params.cliOptions.categoryNames || params.cliOptions.categoryNames.length === 0) {
    return []
  }

  const categoryByName = new Map(
    params.availableProjectCategories.map((projectCategory) => [
      projectCategory.name,
      projectCategory,
    ]),
  )
  const requestedCategoryNames = mergeCategoryNameLists(
    resolveConfiguredDefaultAgentSessionCategoryNames(),
    params.cliOptions.categoryNames,
  )
  return requestedCategoryNames
    .map((requestedCategoryName) => categoryByName.get(requestedCategoryName))
    .filter(
      (projectCategory): projectCategory is ProjectSessionCategory => projectCategory !== undefined,
    )
}

async function bootstrapCli(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  await confirmDatabaseTarget(logger)

  const app = await NestFactory.createApplicationContext(SetAgentSessionCategoriesCliModule, {
    logger: ["error", "warn", "log"],
  })

  try {
    const agentSessionCategoriesService = app.get(AgentSessionCategoriesService)
    const organizationRepository = app.get<Repository<Organization>>(
      getRepositoryToken(Organization),
    )
    const projectRepository = app.get<Repository<Project>>(getRepositoryToken(Project))
    const agentRepository = app.get<Repository<Agent>>(getRepositoryToken(Agent))
    const projectSessionCategoryRepository = app.get<Repository<ProjectSessionCategory>>(
      getRepositoryToken(ProjectSessionCategory),
    )

    const organizations = await organizationRepository.find({ order: { name: "ASC" } })
    if (organizations.length === 0) {
      logger.log("No organizations found.")
      return
    }

    const selectedOrganization = await selectFromList({
      title: "Organizations",
      items: organizations,
      toLine: (organization) => `${organization.name} (${organization.id})`,
    })

    const projects = await projectRepository.find({
      where: { organizationId: selectedOrganization.id },
      order: { name: "ASC" },
    })
    if (projects.length === 0) {
      logger.log(`No workspaces found for organization "${selectedOrganization.name}".`)
      return
    }

    const selectedProject = await selectFromList({
      title: `Workspaces in ${selectedOrganization.name}`,
      items: projects,
      toLine: (project) => `${project.name} (${project.id})`,
    })

    const agents = await agentRepository.find({
      where: {
        organizationId: selectedOrganization.id,
        projectId: selectedProject.id,
      },
      order: { name: "ASC" },
    })
    if (agents.length === 0) {
      logger.log(`No agents found in workspace "${selectedProject.name}".`)
      return
    }

    const selectedAgent = await selectFromList({
      title: `Agents in ${selectedProject.name}`,
      items: agents,
      toLine: (agent) => `${agent.name} (${agent.type}) - ${agent.id}`,
    })

    const availableProjectCategories = await projectSessionCategoryRepository.find({
      where: { projectId: selectedProject.id },
      order: { name: "ASC" },
    })
    if (availableProjectCategories.length === 0) {
      logger.log(
        `No project categories found in workspace "${selectedProject.name}". Run project:set-session-categories first.`,
      )
      return
    }

    const activeCategoryNamesBeforeUpdate =
      await agentSessionCategoriesService.listActiveCategoryNamesForAgent(selectedAgent.id)
    logger.log(
      `\nCurrent active categories: ${activeCategoryNamesBeforeUpdate.length > 0 ? activeCategoryNamesBeforeUpdate.join(", ") : "(none)"}`,
    )

    let selectedProjectCategories = resolveCliSelectedProjectCategories({
      cliOptions: options,
      availableProjectCategories,
    })

    if (selectedProjectCategories.length === 0) {
      selectedProjectCategories = await selectManyFromList({
        title: `Project categories in ${selectedProject.name}`,
        items: availableProjectCategories,
        toLine: (projectCategory) => {
          const isAssignedToSelectedAgent = activeCategoryNamesBeforeUpdate.includes(
            projectCategory.name,
          )
          const assignmentMarker = isAssignedToSelectedAgent ? "x" : " "
          return `[${assignmentMarker}] ${projectCategory.name} (${projectCategory.id})`
        },
      })
    }

    logger.log(
      `Selected project categories: ${selectedProjectCategories.map((projectCategory) => projectCategory.name).join(", ")}`,
    )

    const confirmation = await ask(
      "This will replace current active categories for this agent using project categories. Continue? (yes/no): ",
    )
    if (confirmation.toLowerCase() !== "yes") {
      logger.log("Aborted.")
      return
    }

    const result = await agentSessionCategoriesService.replaceActiveCategoriesForAgent(
      selectedAgent.id,
      selectedProjectCategories.map((projectCategory) => ({
        id: projectCategory.id,
        name: projectCategory.name,
      })),
    )

    const activeCategoriesAfterUpdate =
      await agentSessionCategoriesService.listActiveCategoryNamesForAgent(selectedAgent.id)

    logger.log(
      `\nUpdated categories for agent "${selectedAgent.name}" (${selectedAgent.id}): ${activeCategoriesAfterUpdate.join(", ")}`,
    )
    logger.log(
      `Summary: created=${result.createdCount}, restored=${result.restoredCount}, deactivated=${result.deletedCount}`,
    )
  } finally {
    await app.close()
  }
}

if (require.main === module) {
  void bootstrapCli()
}

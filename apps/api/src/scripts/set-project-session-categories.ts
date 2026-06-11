import { Logger, Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import typeorm from "@/config/typeorm"
import {
  AGENT_DEFAULT_CATEGORIES_ENV,
  parseUniqueCommaSeparatedCategoryNames,
  resolveConfiguredDefaultAgentSessionCategoryNames,
} from "@/domains/agents/session-categories/agent-default-session-category-names"
import { ProjectSessionCategory } from "@/domains/agents/session-categories/project-session-category.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { Project } from "@/domains/projects/project.entity"
import { ask, confirmDatabaseTarget } from "@/scripts/script-bootstrap"

const logger = new Logger("SetProjectSessionCategories")

type CliOptions = {
  categoryNames?: string[]
}

type ReplaceProjectCategoriesResult = {
  createdCount: number
  restoredCount: number
  deletedCount: number
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
    TypeOrmModule.forFeature([Organization, Project, ProjectSessionCategory]),
  ],
})
class ProjectSessionCategoriesCliModule {}

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
  const mergedNames: string[] = []
  const seenCategoryNames = new Set<string>()

  for (const categoryName of primary) {
    if (!seenCategoryNames.has(categoryName)) {
      seenCategoryNames.add(categoryName)
      mergedNames.push(categoryName)
    }
  }

  for (const categoryName of secondary) {
    if (!seenCategoryNames.has(categoryName)) {
      seenCategoryNames.add(categoryName)
      mergedNames.push(categoryName)
    }
  }

  return mergedNames
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

async function askIncludeDefaultCategories(configuredDefaults: string[]): Promise<boolean> {
  if (configuredDefaults.length === 0) {
    logger.log(
      `\nNo default categories are available (${AGENT_DEFAULT_CATEGORIES_ENV} is set but empty, or only commas were provided). Unset it to use built-in defaults.`,
    )
    return false
  }

  logger.log(`\nDefault categories available: ${configuredDefaults.join(", ")}`)
  while (true) {
    const answer = await ask("Include these default categories in this update? (yes/no): ")
    const normalizedAnswer = answer.toLowerCase()
    if (normalizedAnswer === "yes") {
      return true
    }
    if (normalizedAnswer === "no") {
      return false
    }
    logger.warn("Please answer yes or no.")
  }
}

async function resolveAdditionalCategoryNames(options: CliOptions): Promise<string[]> {
  if (options.categoryNames && options.categoryNames.length > 0) {
    return options.categoryNames
  }

  const categoryNamesRaw = await ask(
    "Additional categories as comma-separated values (optional, Enter to skip): ",
  )
  if (!categoryNamesRaw) {
    return []
  }
  return parseUniqueCommaSeparatedCategoryNames(categoryNamesRaw)
}

async function resolveFinalCategoryNames(params: {
  options: CliOptions
  includeDefaults: boolean
  configuredDefaults: string[]
}): Promise<string[]> {
  const primaryCategoryNames = params.includeDefaults ? params.configuredDefaults : []
  const additionalCategoryNames = await resolveAdditionalCategoryNames(params.options)
  return mergeCategoryNameLists(primaryCategoryNames, additionalCategoryNames)
}

async function replaceActiveProjectCategories(params: {
  projectId: string
  categoryNames: string[]
  projectSessionCategoryRepository: Repository<ProjectSessionCategory>
}): Promise<ReplaceProjectCategoriesResult> {
  const existingProjectSessionCategories = await params.projectSessionCategoryRepository.find({
    where: { projectId: params.projectId },
    withDeleted: true,
    order: { name: "ASC" },
  })

  const desiredCategoryNames = new Set(params.categoryNames)
  const existingCategoryByName = new Map(
    existingProjectSessionCategories.map((existingCategory) => [
      existingCategory.name,
      existingCategory,
    ]),
  )

  let createdCount = 0
  let restoredCount = 0
  let deletedCount = 0

  for (const categoryName of params.categoryNames) {
    const existingCategory = existingCategoryByName.get(categoryName)
    if (!existingCategory) {
      const createdCategory = params.projectSessionCategoryRepository.create({
        projectId: params.projectId,
        name: categoryName,
      })
      await params.projectSessionCategoryRepository.save(createdCategory)
      createdCount += 1
      continue
    }

    if (existingCategory.deletedAt !== null) {
      await params.projectSessionCategoryRepository.recover(existingCategory)
      restoredCount += 1
    }
  }

  for (const existingCategory of existingProjectSessionCategories) {
    const shouldStayActive = desiredCategoryNames.has(existingCategory.name)
    const isCurrentlyActive = existingCategory.deletedAt === null
    if (!shouldStayActive && isCurrentlyActive) {
      await params.projectSessionCategoryRepository.softDelete(existingCategory.id)
      deletedCount += 1
    }
  }

  return {
    createdCount,
    restoredCount,
    deletedCount,
  }
}

async function bootstrapCli(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  await confirmDatabaseTarget(logger)

  const app = await NestFactory.createApplicationContext(ProjectSessionCategoriesCliModule, {
    logger: ["error", "warn", "log"],
  })

  try {
    const organizationRepository = app.get<Repository<Organization>>(
      getRepositoryToken(Organization),
    )
    const projectRepository = app.get<Repository<Project>>(getRepositoryToken(Project))
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

    const activeCategoriesBeforeUpdate = await projectSessionCategoryRepository.find({
      where: { projectId: selectedProject.id },
      order: { name: "ASC" },
    })
    logger.log(
      `\nCurrent active project categories: ${
        activeCategoriesBeforeUpdate.length > 0
          ? activeCategoriesBeforeUpdate.map((projectCategory) => projectCategory.name).join(", ")
          : "(none)"
      }`,
    )

    const configuredDefaults = resolveConfiguredDefaultAgentSessionCategoryNames()
    const includeDefaults = await askIncludeDefaultCategories(configuredDefaults)

    let categoryNames = await resolveFinalCategoryNames({
      options,
      includeDefaults,
      configuredDefaults,
    })

    while (categoryNames.length === 0) {
      logger.warn(
        "At least one category is required (enable defaults, use --categories, or type additional names).",
      )
      const retryRaw = await ask("Enter categories as comma-separated values (required): ")
      categoryNames = parseUniqueCommaSeparatedCategoryNames(retryRaw)
    }

    logger.log(`Requested categories: ${categoryNames.join(", ")}`)

    const confirmation = await ask(
      "This will replace current active project categories for this workspace. Continue? (yes/no): ",
    )
    if (confirmation.toLowerCase() !== "yes") {
      logger.log("Aborted.")
      return
    }

    const result = await replaceActiveProjectCategories({
      projectId: selectedProject.id,
      categoryNames,
      projectSessionCategoryRepository,
    })

    const activeCategoriesAfterUpdate = await projectSessionCategoryRepository.find({
      where: { projectId: selectedProject.id },
      order: { name: "ASC" },
    })

    logger.log(
      `\nUpdated project categories for workspace "${selectedProject.name}" (${selectedProject.id}): ${activeCategoriesAfterUpdate.map((projectCategory) => projectCategory.name).join(", ")}`,
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

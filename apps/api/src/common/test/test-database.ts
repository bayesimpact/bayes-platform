import { randomUUID } from "node:crypto"
import type { DynamicModule, Provider, Type } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { Test, type TestingModule, type TestingModuleBuilder } from "@nestjs/testing"
import { getDataSourceToken, getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm"
import type { DataSource, EntityManager, ObjectLiteral, QueryRunner, Repository } from "typeorm"
import { ALL_ENTITIES } from "../all-entities"
import { type AllRepositories, buildAllRepositories } from "./test-all-repositories"

export type { AllRepositories } from "./test-all-repositories"

export const RandomUuid = {
  Organization: randomUUID(),
  Project: randomUUID(),
  Document: randomUUID(),
} as const

export type SetupTestDatabaseParams = {
  providers?: Provider[]
  additionalImports?: Array<Type<unknown> | DynamicModule>
  applyOverrides?: (moduleBuilder: TestingModuleBuilder) => TestingModuleBuilder
}

/**
 * **E2E / full Nest app tests** — use this with `clearTestDatabase` in `beforeEach` (or `afterEach`).
 *
 * One `DataSource` and the normal connection pool, so `@InjectDataSource()`, `DataSource.query()`,
 * HTTP handlers, and anything else that does not go through the transactional `EntityManager`
 * override still sees consistent data. Isolation comes from truncating tables, not from rolling
 * back a per-test transaction.
 */
export interface E2eTestDatabaseSetup {
  module: TestingModule
  dataSource: DataSource
  getRepository: <T extends ObjectLiteral>(entity: new () => T) => Repository<T>
  getAllRepositories: () => AllRepositories
  /**
   * Prefer `clearTestDatabase` for e2e isolation. Kept for rare cases that need an explicit runner.
   */
  startTransaction: () => Promise<QueryRunner>
  getRepositoryForTransaction: <T extends ObjectLiteral>(
    entity: new () => T,
    entityManager: EntityManager,
  ) => Repository<T>
}

/**
 * @deprecated Use {@link setupE2eTestDatabase} for new code; the name reflects the intended hybrid pattern.
 */
export async function setupTestDatabase(
  providers: Provider[] = [],
  additionalImports: Array<Type<unknown> | DynamicModule> = [],
): Promise<E2eTestDatabaseSetup> {
  return setupE2eTestDatabase({ providers, additionalImports })
}

export async function setupE2eTestDatabase(
  params: SetupTestDatabaseParams = {},
): Promise<E2eTestDatabaseSetup> {
  const { providers = [], additionalImports = [], applyOverrides } = params

  const testDatabaseUrl = process.env.DATABASE_URL
  if (!testDatabaseUrl) {
    throw new Error("DATABASE_URL not found in environment. Make sure .env.test is loaded.")
  }

  let moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
      }),
      TypeOrmModule.forRoot({
        type: "postgres",
        url: testDatabaseUrl,
        entities: ALL_ENTITIES,
        synchronize: true,
        logging: false,
        dropSchema: false,
      }),
      TypeOrmModule.forFeature(ALL_ENTITIES),
      ...additionalImports,
    ],
    providers,
  })

  if (applyOverrides) {
    moduleBuilder = applyOverrides(moduleBuilder)
  }

  const module = await moduleBuilder.compile()

  const dataSource = module.get<DataSource>(getDataSourceToken())

  const getRepository = <T extends ObjectLiteral>(entity: new () => T): Repository<T> => {
    return module.get<Repository<T>>(getRepositoryToken(entity))
  }

  const getAllRepositories = (): AllRepositories => buildAllRepositories(getRepository)

  const startTransaction = async (): Promise<QueryRunner> => {
    const queryRunner = dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()
    return queryRunner
  }

  const getRepositoryForTransaction = <T extends ObjectLiteral>(
    entity: new () => T,
    entityManager: EntityManager,
  ): Repository<T> => {
    return entityManager.getRepository(entity)
  }

  return {
    module,
    dataSource,
    getRepository,
    getAllRepositories,
    startTransaction,
    getRepositoryForTransaction,
  }
}

/**
 * Clears all test data from the database.
 * Tables are cleared in the correct order to respect foreign key constraints.
 * Uses TRUNCATE CASCADE for faster and safer cleanup that respects foreign keys.
 */
export async function clearTestDatabase(dataSource: DataSource): Promise<void> {
  if (!dataSource || !dataSource.isInitialized) {
    return
  }

  // Use a transaction to ensure atomic cleanup
  const queryRunner = dataSource.createQueryRunner()
  try {
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      // Delete in order: child tables first, then parent tables
      await queryRunner.query(`DELETE FROM "activity"`)
      await queryRunner.query(`DELETE FROM "agent_csv_extraction_run_record"`)
      await queryRunner.query(`DELETE FROM "agent_csv_extraction_run"`)
      await queryRunner.query(`DELETE FROM "evaluation_extraction_run_record"`)
      await queryRunner.query(`DELETE FROM "evaluation_extraction_run"`)
      await queryRunner.query(`DELETE FROM "evaluation_extraction_dataset_document"`)
      await queryRunner.query(`DELETE FROM "evaluation_extraction_dataset_record"`)
      await queryRunner.query(`DELETE FROM "evaluation_extraction_dataset"`)
      await queryRunner.query(`DELETE FROM "document_document_tag"`)
      await queryRunner.query(`DELETE FROM "agent_document_tag"`)
      await queryRunner.query(`DELETE FROM "document_tag"`)
      await queryRunner.query(`DELETE FROM "agent_resource_library"`)
      await queryRunner.query(`DELETE FROM "resource_library"`)
      await queryRunner.query(`DELETE FROM "feature_flag"`)
      await queryRunner.query(`DELETE FROM "evaluation_report"`)
      await queryRunner.query(`DELETE FROM "evaluation"`)
      await queryRunner.query(`DELETE FROM "agent_message_feedback"`)
      await queryRunner.query(`DELETE FROM "agent_message"`)
      await queryRunner.query(`DELETE FROM "agent_message_attachment_document"`)
      await queryRunner.query(`DELETE FROM "tester_session_feedback"`)
      await queryRunner.query(`DELETE FROM "tester_campaign_survey"`)
      await queryRunner.query(`DELETE FROM "review_campaign_membership"`)
      await queryRunner.query(`DELETE FROM "user_membership"`)
      await queryRunner.query(`DELETE FROM "invitation"`)
      await queryRunner.query(`DELETE FROM "extraction_agent_session"`)
      await queryRunner.query(`DELETE FROM "form_agent_session"`)
      await queryRunner.query(`DELETE FROM "conversation_agent_session"`)
      await queryRunner.query(`DELETE FROM "review_campaign"`)
      await queryRunner.query(`DELETE FROM "organization_membership"`)
      await queryRunner.query(`DELETE FROM "project_membership"`)
      await queryRunner.query(`DELETE FROM "document"`)
      await queryRunner.query(`DELETE FROM "agent_mcp_server"`)
      await queryRunner.query(`DELETE FROM "agent_sub_agent"`)
      await queryRunner.query(`DELETE FROM "agent_membership"`)
      await queryRunner.query(`DELETE FROM "agent_settings"`)
      await queryRunner.query(`DELETE FROM "agent"`)
      await queryRunner.query(`DELETE FROM "mcp_server"`)
      await queryRunner.query(`DELETE FROM "project"`)
      await queryRunner.query(`DELETE FROM "organization"`)
      await queryRunner.query(`DELETE FROM "terms_acceptance"`)
      await queryRunner.query(`DELETE FROM "user"`)
      await queryRunner.query(`DELETE FROM "terms_document"`)
      // Reseed the three required terms documents the production migration
      // installs as a permanent invariant — `getMe` and other handlers throw
      // 404 if any type is missing. The e2e setup uses `synchronize: true`,
      // so the migration's seed never runs.
      await queryRunner.query(
        `INSERT INTO "terms_document" ("type", "url", "version") VALUES
          ('general_conditions', '', 0),
          ('privacy_policy', '', 0),
          ('ai_usage_policy', '', 0)`,
      )

      await queryRunner.commitTransaction()
    } catch (error) {
      await queryRunner.rollbackTransaction()
      throw error
    }
  } finally {
    await queryRunner.release()
  }
}

/**
 * Cleans up e2e test database connection (clears data, then closes the module).
 * Pair with {@link setupE2eTestDatabase}; service tests that use
 * {@link setupTransactionalTestDatabase} should use `teardownTestDatabase` from
 * `test-transaction-manager` instead.
 */
export async function teardownE2eTestDatabase(setup: E2eTestDatabaseSetup): Promise<void> {
  await clearTestDatabase(setup.dataSource)
  await setup.dataSource.destroy()
  await setup.module.close()
}

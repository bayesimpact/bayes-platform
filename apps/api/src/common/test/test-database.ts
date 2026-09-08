import { randomUUID } from "node:crypto"
import type { DynamicModule, Provider, Type } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { Test, type TestingModule, type TestingModuleBuilder } from "@nestjs/testing"
import { getDataSourceToken, getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm"
import type { DataSource, EntityManager, ObjectLiteral, QueryRunner, Repository } from "typeorm"
import { ALL_ENTITIES } from "../all-entities"
import { TransactionModule } from "../transaction/transaction.module"
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
      TransactionModule,
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
      await queryRunner.query(`
WITH
  del_activity AS (
    DELETE FROM "activity"
  ),
  del_agent_csv_extraction_run_record AS (
    DELETE FROM "agent_csv_extraction_run_record"
  ),
  del_agent_csv_extraction_run AS (
    DELETE FROM "agent_csv_extraction_run"
  ),
  del_evaluation_extraction_run_record AS (
    DELETE FROM "evaluation_extraction_run_record"
  ),
  del_evaluation_extraction_run AS (
    DELETE FROM "evaluation_extraction_run"
  ),
  del_evaluation_extraction_dataset_document AS (
    DELETE FROM "evaluation_extraction_dataset_document"
  ),
  del_evaluation_extraction_dataset_record AS (
    DELETE FROM "evaluation_extraction_dataset_record"
  ),
  del_evaluation_extraction_dataset AS (
    DELETE FROM "evaluation_extraction_dataset"
  ),
  del_evaluation_conversation_run_record AS (
    DELETE FROM "evaluation_conversation_run_record"
  ),
  del_evaluation_conversation_run AS (
    DELETE FROM "evaluation_conversation_run"
  ),
  del_evaluation_conversation_dataset_record AS (
    DELETE FROM "evaluation_conversation_dataset_record"
  ),
  del_evaluation_conversation_dataset AS (
    DELETE FROM "evaluation_conversation_dataset"
  ),
  del_document_document_tag AS (
    DELETE FROM "document_document_tag"
  ),
  del_agent_document_tag AS (
    DELETE FROM "agent_document_tag"
  ),
  del_document_tag AS (
    DELETE FROM "document_tag"
  ),
  del_agent_resource_library AS (
    DELETE FROM "agent_resource_library"
  ),
  del_resource_library AS (
    DELETE FROM "resource_library"
  ),
  del_feature_flag AS (
    DELETE FROM "feature_flag"
  ),
  del_agent_message_feedback AS (
    DELETE FROM "agent_message_feedback"
  ),
  del_agent_message AS (
    DELETE FROM "agent_message"
  ),
  del_agent_message_attachment_document AS (
    DELETE FROM "agent_message_attachment_document"
  ),
  del_tester_session_feedback AS (
    DELETE FROM "tester_session_feedback"
  ),
  del_tester_campaign_survey AS (
    DELETE FROM "tester_campaign_survey"
  ),
  del_user_membership AS (
    DELETE FROM "user_membership"
  )
SELECT 1;`)
      // Legacy membership tables are kept in production for now; test DBs may still
      // have them from older migrations or synchronize.
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'review_campaign_membership'
          ) THEN
            DELETE FROM "review_campaign_membership";
          END IF;
          IF EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'organization_membership'
          ) THEN
            DELETE FROM "organization_membership";
          END IF;
          IF EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'project_membership'
          ) THEN
            DELETE FROM "project_membership";
          END IF;
          IF EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'agent_membership'
          ) THEN
            DELETE FROM "agent_membership";
          END IF;
        END $$;
      `)
      await queryRunner.query(`
WITH
  del_invitation AS (
    DELETE FROM "invitation"
  ),
  del_extraction_agent_session AS (
    DELETE FROM "extraction_agent_session"
  ),
  del_conversation_retention_sweep_run AS (
    DELETE FROM "conversation_retention_sweep_run"
  ),
  del_conversation_agent_session AS (
    DELETE FROM "conversation_agent_session"
  ),
  del_reviewer_session_review AS (
    DELETE FROM "reviewer_session_review"
  ),
  del_review_campaign AS (
    DELETE FROM "review_campaign"
  ),
  del_document AS (
    DELETE FROM "document"
  ),
  del_agent_mcp_server AS (
    DELETE FROM "agent_mcp_server"
  ),
  del_agent_sub_agent AS (
    DELETE FROM "agent_sub_agent"
  ),
  del_agent_settings AS (
    DELETE FROM "agent_settings"
  ),
  del_agent AS (
    DELETE FROM "agent"
  ),
  del_mcp_server AS (
    DELETE FROM "mcp_server"
  ),
  del_project AS (
    DELETE FROM "project"
  ),
  del_organization AS (
    DELETE FROM "organization"
  ),
  del_terms_acceptance AS (
    DELETE FROM "terms_acceptance"
  ),
  del_user AS (
    DELETE FROM "user"
  ),
  del_terms_document AS (
    DELETE FROM "terms_document"
  )
SELECT 1;
`)
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

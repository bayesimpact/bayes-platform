import { AgentModel, EvaluationReportsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { evaluationFactory } from "@/domains/evaluations/evaluation.factory"
import { EvaluationsModule } from "@/domains/evaluations/evaluations.module"
import { evaluationReportFactory } from "@/domains/evaluations/reports/evaluation-report.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"

describe("Evaluation Reports - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let evaluationId: string
  let evaluationReportId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvaluationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { agentSettings: { model: AgentModel._Mock } },
    )
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const evaluation = evaluationFactory.transient({ organization, project }).build({
      input: "test input",
      expectedOutput: "test output",
    })
    await repositories.evaluationRepository.save(evaluation)
    evaluationId = evaluation.id

    const evaluationReport = evaluationReportFactory
      .transient({ organization, project, agent, agentSettings, evaluation })
      .build()
    await repositories.evaluationReportRepository.save(evaluationReport)
    evaluationReportId = evaluationReport.id
  }

  const subject = async () =>
    request({
      route: EvaluationReportsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId, evaluationId }),
      token: accessToken,
    })

  it("should get all evaluation reports", async () => {
    await createContext()

    const res = await subject()
    expectResponse(res, 200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data).toContainEqual(expect.objectContaining({ id: evaluationReportId }))
  })
})

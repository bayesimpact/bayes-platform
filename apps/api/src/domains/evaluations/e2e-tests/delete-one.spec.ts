import { randomUUID } from "node:crypto"
import { EvaluationsRoutes } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { EvaluationsModule } from "@/domains/evaluations/evaluations.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"

describe("Evaluations - deleteOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let evaluationId: string
  let accessToken: string | undefined = "token"
  let auth0Id = `auth0|${randomUUID()}`
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvaluationsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
    })
    organizationId = organization.id
    projectId = project.id
  }

  const createEvaluation = async (payload: { input: string; expectedOutput: string }) => {
    const response = await request({
      route: EvaluationsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
      request: { payload },
    })
    expectResponse(response, 201)
    evaluationId = response.body.data.id
    return response
  }

  const subject = async () =>
    request({
      route: EvaluationsRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationId }),
      token: accessToken,
    })

  const fetchEvaluation = async (id: string) => {
    const listRes = await request({
      route: EvaluationsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })
    return listRes.body.data.evaluations.find((evaluation) => evaluation.id === id)
  }

  it("should delete evaluation successfully", async () => {
    await createContext()
    await createEvaluation({
      input: "test input",
      expectedOutput: "test output",
    })

    const res = await subject()

    expectResponse(res)
    expect(res.body.data).toMatchObject({
      success: true,
    })
    await expectActivityCreated("evaluation.delete")
  })

  it("should return 404 when deleting non-existent evaluation", async () => {
    await createContext()
    await createEvaluation({
      input: "test input",
      expectedOutput: "test output",
    })

    const res = await request({
      route: EvaluationsRoutes.deleteOne,
      pathParams: removeNullish({
        organizationId,
        projectId,
        evaluationId: "00000000-0000-0000-0000-000000000000",
      }),
      token: accessToken,
    })
    expectResponse(res, 404)
  })

  it("should remove evaluation from list after deletion", async () => {
    await createContext()

    const createRes = await createEvaluation({
      input: "test input for deletion",
      expectedOutput: "test output for deletion",
    })
    const newEvaluationId = createRes.body.data.id

    const foundBefore = await fetchEvaluation(newEvaluationId)
    expect(foundBefore).toBeDefined()

    await request({
      route: EvaluationsRoutes.deleteOne,
      pathParams: removeNullish({
        organizationId,
        projectId,
        evaluationId: newEvaluationId,
      }),
      token: accessToken,
    })

    const foundAfter = await fetchEvaluation(newEvaluationId)
    expect(foundAfter).toBeUndefined()
  })

  it("should return 404 when trying to delete already deleted evaluation", async () => {
    await createContext()

    const createRes = await createEvaluation({
      input: "test input",
      expectedOutput: "test output",
    })
    const idToDelete = createRes.body.data.id

    await request({
      route: EvaluationsRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationId: idToDelete }),
      token: accessToken,
    })

    const res = await request({
      route: EvaluationsRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, evaluationId: idToDelete }),
      token: accessToken,
    })
    expectResponse(res, 404)
  })
})

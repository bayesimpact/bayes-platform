import { setupE2eTestDatabase, teardownE2eTestDatabase } from "@/common/test/test-database"
import { EvaluationContextModule } from "./evaluation-context.module"
import { AgentSessionInCampaignContextResolver } from "./resolvers/agent-session-in-campaign-context.resolver"
import { AgentSessionReviewCampaignContextResolver } from "./resolvers/agent-session-review-campaign-context.resolver"
import { EvaluationConversationDatasetContextResolver } from "./resolvers/evaluation-conversation-dataset-context.resolver"
import { EvaluationConversationRunContextResolver } from "./resolvers/evaluation-conversation-run-context.resolver"
import { EvaluationExtractionDatasetContextResolver } from "./resolvers/evaluation-extraction-dataset-context.resolver"
import { EvaluationExtractionDatasetDocumentContextResolver } from "./resolvers/evaluation-extraction-dataset-document-context.resolver"
import { EvaluationExtractionRunContextResolver } from "./resolvers/evaluation-extraction-run-context.resolver"
import { ReviewCampaignContextResolver } from "./resolvers/review-campaign-context.resolver"

// `ResourceContextGuard` takes each resolver as optional: a resolver the module cannot build
// would only fail at the first request that needs its context. This proves each one is built.
describe("EvaluationContextModule", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [EvaluationContextModule] })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  it.each([
    ReviewCampaignContextResolver,
    AgentSessionInCampaignContextResolver,
    AgentSessionReviewCampaignContextResolver,
    EvaluationConversationDatasetContextResolver,
    EvaluationConversationRunContextResolver,
    EvaluationExtractionDatasetContextResolver,
    EvaluationExtractionDatasetDocumentContextResolver,
    EvaluationExtractionRunContextResolver,
  ])("provides %p", (resolverClass) => {
    const resolver = setup.module
      .select(EvaluationContextModule)
      .get(resolverClass, { strict: true })
    expect(resolver).toBeInstanceOf(resolverClass)
  })
})

import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { EvaluationConversationDataset } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-dataset.entity"
import { EvaluationConversationRun } from "@/domains/evaluations/conversation/runs/evaluation-conversation-run.entity"
import { EvaluationsModule } from "@/domains/evaluations/evaluations.module"
import { EvaluationExtractionDataset } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.entity"
import { EvaluationExtractionRun } from "@/domains/evaluations/extraction/runs/evaluation-extraction-run.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { AgentSessionInCampaignContextResolver } from "./resolvers/agent-session-in-campaign-context.resolver"
import { AgentSessionReviewCampaignContextResolver } from "./resolvers/agent-session-review-campaign-context.resolver"
import { EvaluationConversationDatasetContextResolver } from "./resolvers/evaluation-conversation-dataset-context.resolver"
import { EvaluationConversationRunContextResolver } from "./resolvers/evaluation-conversation-run-context.resolver"
import { EvaluationExtractionDatasetContextResolver } from "./resolvers/evaluation-extraction-dataset-context.resolver"
import { EvaluationExtractionDatasetDocumentContextResolver } from "./resolvers/evaluation-extraction-dataset-document-context.resolver"
import { EvaluationExtractionRunContextResolver } from "./resolvers/evaluation-extraction-run-context.resolver"
import { ReviewCampaignContextResolver } from "./resolvers/review-campaign-context.resolver"

export const EVALUATION_CONTEXT_RESOLVERS = [
  ReviewCampaignContextResolver,
  AgentSessionInCampaignContextResolver,
  AgentSessionReviewCampaignContextResolver,
  EvaluationConversationDatasetContextResolver,
  EvaluationConversationRunContextResolver,
  EvaluationExtractionDatasetContextResolver,
  EvaluationExtractionDatasetDocumentContextResolver,
  EvaluationExtractionRunContextResolver,
]

/**
 * Gives a module the contexts of the evaluation app beyond those of `ResourceContextModule`:
 * `reviewCampaign`, `agentSessionInCampaign`, `agentSessionReviewCampaign`,
 * `evaluationConversationDataset`, `evaluationConversationRun`, `evaluationExtractionDataset`,
 * `evaluationExtractionDatasetDocument` and `evaluationExtractionRun`, with the repositories they
 * read. A module of another domain uses it so it does not import the entities of these domains. It
 * goes with `ResourceContextModule`, which gives the guard and the other resolvers.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReviewCampaign,
      ConversationAgentSession,
      EvaluationConversationDataset,
      EvaluationConversationRun,
      EvaluationExtractionDataset,
      EvaluationExtractionRun,
    ]),
    // The dataset document resolver reads the document through its custom repository.
    EvaluationsModule,
  ],
  providers: [...EVALUATION_CONTEXT_RESOLVERS],
  exports: [...EVALUATION_CONTEXT_RESOLVERS],
})
export class EvaluationContextModule {}

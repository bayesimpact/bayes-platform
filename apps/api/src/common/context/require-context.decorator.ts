import { SetMetadata } from "@nestjs/common"

export const REQUIRE_CONTEXT_KEY = "require_context"
export const ADD_CONTEXT_KEY = "add_context"

export type ContextResource =
  | "organization"
  | "project"
  | "projectMembership"
  | "agent"
  | "agentMembership"
  | "agentSession"
  | "agentCsvExtractionRun"
  | "document"
  | "documentTag"
  | "resourceLibrary"
  | "evaluationConversationDataset"
  | "evaluationConversationRun"
  | "evaluationExtractionDataset"
  | "evaluationExtractionRun"
  | "reviewCampaign"
  | "reviewCampaignMembership"
  | "agentSessionInCampaign"
  | "invitationScope"
  | "mcpServer"

export const RequireContext = (...resources: ContextResource[]) =>
  SetMetadata(REQUIRE_CONTEXT_KEY, resources)

export const AddContext = (...resources: ContextResource[]) =>
  SetMetadata(ADD_CONTEXT_KEY, resources)

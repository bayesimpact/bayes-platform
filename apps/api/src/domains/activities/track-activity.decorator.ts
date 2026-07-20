import { SetMetadata } from "@nestjs/common"

export const TRACK_ACTIVITY_METADATA_KEY = "track_activity"

/**
 * Resolved resource on `EndpointRequest` (and variants) whose `.id` is stored as `entity_id`
 * / `entity_type` when the action is not a `.create`.
 */
export type TrackActivityEntityFrom =
  | "organizationMembership"
  | "project"
  | "projectMembership"
  | "memberProjectMembership"
  | "agent"
  | "agentMembership"
  | "memberAgentMembership"
  | "document"
  | "documentTag"
  | "resourceLibrary"
  | "agentSession"
  | "evaluationConversationDataset"
  | "evaluationConversationRun"
  | "evaluationExtractionDataset"

export type TrackActivityOptions = {
  action: string
  /** When set, `entity_id` / `entity_type` come from `request[entityFrom].id` and this key. */
  entityFrom?: TrackActivityEntityFrom
}

export const TrackActivity = (options: TrackActivityOptions) =>
  SetMetadata(TRACK_ACTIVITY_METADATA_KEY, options)

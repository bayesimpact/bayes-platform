import type { TrackActivityEntityFrom } from "./track-activity.decorator"

type TrackedActivityContext = {
  organizationId?: string
  projectId?: string
  entityFrom?: TrackActivityEntityFrom
  entityId?: string
}

/**
 * Copies scope and entity onto the request in the shape ActivitiesInterceptor reads.
 * `project` is an object with `id`; `organizationId` is a string.
 */
export function attachTrackedActivity(request: object, context: TrackedActivityContext): void {
  const trackedRequest = request as Record<string, unknown>
  if (context.organizationId !== undefined) {
    trackedRequest.organizationId = context.organizationId
  }
  if (context.projectId !== undefined) {
    trackedRequest.project = { id: context.projectId }
  }
  if (context.entityFrom !== undefined && context.entityId !== undefined) {
    trackedRequest[context.entityFrom] = { id: context.entityId }
  }
}

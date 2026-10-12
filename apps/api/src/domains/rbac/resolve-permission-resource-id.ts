import type {
  EndpointRequestWithAgent,
  EndpointRequestWithOrganizationMembership,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import type { PermissionResourceType } from "./permission.types"

type PermissionRequest = EndpointRequestWithOrganizationMembership &
  Partial<EndpointRequestWithProject> &
  Partial<EndpointRequestWithAgent> & {
    params?: Record<string, string | undefined>
  }

/**
 * Reads the resource id for a permission check.
 *
 * Prefer the id already resolved onto the request by ResourceContextGuard
 * (product routes nest under an organization and cross-check ownership).
 * Fall back to the route param for routes that identify the resource by id
 * alone (e.g. backoffice `/backoffice/projects/:projectId`).
 */
export function resolvePermissionResourceId(
  request: PermissionRequest,
  resourceType: PermissionResourceType,
): string | undefined {
  switch (resourceType) {
    case "organization":
      return request.organizationId ?? request.params?.organizationId
    case "project":
      return request.project?.id ?? request.params?.projectId
    case "agent":
    case "temp_agent":
      return request.agent?.id ?? request.params?.agentId
  }
}

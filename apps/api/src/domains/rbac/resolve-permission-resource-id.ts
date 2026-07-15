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

/** Reads the resource id already resolved onto the request by context guards. */
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
      return request.agent?.id ?? request.params?.agentId
  }
}

import type { FeatureFlagKey } from "../feature-flags/feature-flags.dto"
import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  BackofficeAgentDetailDto,
  BackofficeOrganizationDetailDto,
  BackofficeProjectDetailDto,
  BackofficeUserDetailDto,
  ListTermsDocumentsResponseDto,
  PaginatedBackofficeAgentsDto,
  PaginatedBackofficeOrganizationsDto,
  PaginatedBackofficeProjectsDto,
  PaginatedBackofficeUsersDto,
  UpdateTermsDocumentsRequestDto,
} from "./backoffice.dto"

export const BackofficeRoutes = {
  listOrganizations: defineRoute<ResponseData<PaginatedBackofficeOrganizationsDto>>({
    method: "get",
    path: "backoffice/organizations",
  }),
  getOrganization: defineRoute<ResponseData<BackofficeOrganizationDetailDto>>({
    method: "get",
    path: "backoffice/organizations/:organizationId",
  }),
  listAgents: defineRoute<ResponseData<PaginatedBackofficeAgentsDto>>({
    method: "get",
    path: "backoffice/agents",
  }),
  getAgent: defineRoute<ResponseData<BackofficeAgentDetailDto>>({
    method: "get",
    path: "backoffice/agents/:agentId",
  }),
  listUsers: defineRoute<ResponseData<PaginatedBackofficeUsersDto>>({
    method: "get",
    path: "backoffice/users",
  }),
  getUser: defineRoute<ResponseData<BackofficeUserDetailDto>>({
    method: "get",
    path: "backoffice/users/:userId",
  }),
  listProjects: defineRoute<ResponseData<PaginatedBackofficeProjectsDto>>({
    method: "get",
    path: "backoffice/projects",
  }),
  getProject: defineRoute<ResponseData<BackofficeProjectDetailDto>>({
    method: "get",
    path: "backoffice/projects/:projectId",
  }),
  addFeatureFlag: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<{ featureFlagKey: FeatureFlagKey }>
  >({
    method: "post",
    path: "backoffice/projects/:projectId/feature-flags",
  }),
  removeFeatureFlag: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "backoffice/projects/:projectId/feature-flags/:featureFlagKey",
  }),
  listTermsDocuments: defineRoute<ResponseData<ListTermsDocumentsResponseDto>>({
    method: "get",
    path: "backoffice/terms-documents",
  }),
  updateTermsDocuments: defineRoute<
    ResponseData<ListTermsDocumentsResponseDto>,
    RequestPayload<UpdateTermsDocumentsRequestDto>
  >({
    method: "put",
    path: "backoffice/terms-documents",
  }),
}

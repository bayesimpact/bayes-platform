import type { FeatureFlagKey } from "../feature-flags/feature-flags.dto"
import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  BackofficeAgentDetailDto,
  BackofficeOrganizationDetailDto,
  BackofficeOrganizationDto,
  BackofficeProjectDetailDto,
  BackofficeRbacCatalogDto,
  BackofficeUserDetailDto,
  CreateBackofficeOrganizationRequestDto,
  ListTermsDocumentsResponseDto,
  PaginatedBackofficeAgentsDto,
  PaginatedBackofficeOrganizationsDto,
  PaginatedBackofficeProjectsDto,
  PaginatedBackofficeUsersDto,
  UpdateBackofficeUserGlobalRoleRequestDto,
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
  createOrganization: defineRoute<
    ResponseData<BackofficeOrganizationDto>,
    RequestPayload<CreateBackofficeOrganizationRequestDto>
  >({
    method: "post",
    path: "backoffice/organizations",
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
  grantUserGlobalRole: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<UpdateBackofficeUserGlobalRoleRequestDto>
  >({
    method: "post",
    path: "backoffice/users/:userId/global-roles",
  }),
  revokeUserGlobalRole: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "backoffice/users/:userId/global-roles/:roleKey",
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
  getRbacCatalog: defineRoute<ResponseData<BackofficeRbacCatalogDto>>({
    method: "get",
    path: "backoffice/rbac/catalog",
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

import type { FeatureFlagKey } from "../feature-flags/feature-flags.dto"
import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  BackofficeUserDetailDto,
  ListTermsDocumentsResponseDto,
  PaginatedBackofficeOrganizationsDto,
  PaginatedBackofficeUsersDto,
  UpdateTermsDocumentsRequestDto,
} from "./backoffice.dto"

export const BackofficeRoutes = {
  listOrganizations: defineRoute<ResponseData<PaginatedBackofficeOrganizationsDto>>({
    method: "get",
    path: "backoffice/organizations",
  }),
  listUsers: defineRoute<ResponseData<PaginatedBackofficeUsersDto>>({
    method: "get",
    path: "backoffice/users",
  }),
  getUser: defineRoute<ResponseData<BackofficeUserDetailDto>>({
    method: "get",
    path: "backoffice/users/:userId",
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

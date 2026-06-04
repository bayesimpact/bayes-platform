import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { OrganizationDto, UpdateOrganizationRequestDto } from "./organizations.dto"

export const OrganizationsRoutes = {
  createOrganization: defineRoute<
    ResponseData<OrganizationDto>,
    RequestPayload<Pick<OrganizationDto, "name">>
  >({
    method: "post",
    path: "organizations",
  }),
  updateOrganization: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<UpdateOrganizationRequestDto>
  >({
    method: "patch",
    path: "organizations/:organizationId",
  }),
}

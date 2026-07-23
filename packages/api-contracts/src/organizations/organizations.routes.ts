import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { OrganizationDto, UpdateOrganizationRequestDto } from "./organizations.dto"

export const OrganizationsRoutes = {
  getAllMine: defineRoute<ResponseData<OrganizationDto[]>>({
    method: "get",
    path: "organizations/mine",
  }),
  createOne: defineRoute<
    ResponseData<OrganizationDto>,
    RequestPayload<Pick<OrganizationDto, "name">>
  >({
    method: "post",
    path: "organizations",
  }),
  updateOne: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<UpdateOrganizationRequestDto>
  >({
    method: "patch",
    path: "organizations/:organizationId",
  }),
}

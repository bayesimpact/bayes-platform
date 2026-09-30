import type { RequestPayload, ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type {
  CreateMemberGrantsRequestDto,
  CreateMemberGrantsResponseDto,
} from "./member-grants.dto"

export const MemberGrantsRoutes = {
  createMany: defineRoute<
    ResponseData<CreateMemberGrantsResponseDto>,
    RequestPayload<CreateMemberGrantsRequestDto>
  >({
    method: "post",
    path: "member-grants",
  }),
}

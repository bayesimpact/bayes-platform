import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { AcceptTermsRequestDto, MeResponseDto } from "./me.dto"

export const MeRoutes = {
  getMe: defineRoute<ResponseData<MeResponseDto>>({
    path: "me",
    method: "get",
  }),
  acceptTerms: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<AcceptTermsRequestDto>>(
    {
      method: "post",
      path: "me/terms-acceptances",
    },
  ),
}

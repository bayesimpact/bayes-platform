import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AcceptTermsRequestDto,
  MeResponseDto,
  UpdateMeRequestDto,
  UpdateMeResponseDto,
} from "./me.dto"

export const MeRoutes = {
  getMe: defineRoute<ResponseData<MeResponseDto>>({
    path: "me",
    method: "get",
  }),
  patchMe: defineRoute<ResponseData<UpdateMeResponseDto>, RequestPayload<UpdateMeRequestDto>>({
    method: "patch",
    path: "me",
  }),
  acceptTerms: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<AcceptTermsRequestDto>>(
    {
      method: "post",
      path: "me/terms-acceptances",
    },
  ),
}

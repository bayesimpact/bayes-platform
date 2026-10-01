import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { MemberGrantResult } from "./member-grants.models"
import type { CreateMemberGrantsParams } from "./member-grants.spi"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const createMemberGrants = createAsyncThunk<
  MemberGrantResult,
  CreateMemberGrantsParams,
  ThunkConfig
>(
  "memberGrants/createMany",
  async (params, { extra: { services } }) => await services.memberGrants.createMany(params),
)

import type { MemberGrantResult, MemberGrantTargetType } from "./member-grants.models"

export type CreateMemberGrantsParams = {
  targetType: MemberGrantTargetType
  targetId: string
  emails: string[]
  role?: string
}

export interface IMemberGrantsSpi {
  createMany: (params: CreateMemberGrantsParams) => Promise<MemberGrantResult>
}

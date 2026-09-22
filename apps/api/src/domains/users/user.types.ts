export const USER_TYPE_HUMAN = "human" as const
export const USER_TYPE_SERVICE = "service" as const

export const USER_TYPES = [USER_TYPE_HUMAN, USER_TYPE_SERVICE] as const

export type UserType = (typeof USER_TYPES)[number]

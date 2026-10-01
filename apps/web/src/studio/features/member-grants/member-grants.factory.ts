import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { MemberGrantResult } from "./member-grants.models"

export const memberGrantResultFactory = Factory.define<MemberGrantResult>(({ params }) => ({
  grantedEmails: (params.grantedEmails as string[] | undefined) ?? [
    faker.internet.email().toLowerCase(),
  ],
}))

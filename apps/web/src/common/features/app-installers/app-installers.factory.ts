import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { AppInstaller } from "./app-installers.models"

class AppInstallerFactory extends Factory<AppInstaller> {}

/** A colleague by default. Pass `{ kind: "me" }` or `{ kind: "former-member" }` for the others. */
export const appInstallerFactory = AppInstallerFactory.define(({ params }): AppInstaller => {
  if (params.kind === "me" || params.kind === "former-member") return { kind: params.kind }
  const member = "name" in params || "email" in params ? params : {}
  return {
    kind: "member",
    name: member.name === undefined ? faker.person.fullName() : member.name,
    email: member.email ?? faker.internet.email(),
  }
})

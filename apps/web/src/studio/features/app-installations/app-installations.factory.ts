import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { AppInstallation } from "./app-installations.models"

type AppInstallationTransientParams = {
  project: Project
}

const APP_NAMES = ["Helpful Assistant", "Site Crawler", "Pricing Sync", "Support Inbox"]

class AppInstallationFactory extends Factory<AppInstallation, AppInstallationTransientParams> {}

export const appInstallationFactory = AppInstallationFactory.define(
  ({ params, transientParams }) => {
    const { project } = transientParams
    if (!project) {
      throw new Error("Project must be provided in transient params to build an AppInstallation")
    }

    return {
      id: params.id ?? faker.string.uuid(),
      appName: params.appName ?? faker.helpers.arrayElement(APP_NAMES),
      description: params.description !== undefined ? params.description : faker.lorem.sentence(),
      logoUrl: params.logoUrl ?? null,
      permissions: params.permissions ?? ["document.read", "document.create"],
      createdAt: params.createdAt ?? faker.date.past().getTime(),
    }
  },
)

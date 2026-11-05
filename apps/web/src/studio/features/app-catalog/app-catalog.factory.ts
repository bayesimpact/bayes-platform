import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Project } from "@/common/features/projects/projects.models"
import type { AppCatalogEntry } from "./app-catalog.models"

type AppCatalogEntryTransientParams = {
  project: Project
}

const APP_NAMES = ["Helpful Assistant", "Site Crawler", "Pricing Sync", "Support Inbox"]

class AppCatalogEntryFactory extends Factory<AppCatalogEntry, AppCatalogEntryTransientParams> {}

export const appCatalogEntryFactory = AppCatalogEntryFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.project) {
      throw new Error("Project must be provided in transient params to build an AppCatalogEntry")
    }

    return {
      id: params.id ?? faker.string.uuid(),
      name: params.name ?? faker.helpers.arrayElement(APP_NAMES),
      description: params.description !== undefined ? params.description : faker.lorem.sentence(),
      logoUrl: params.logoUrl ?? null,
      appUrl: params.appUrl !== undefined ? params.appUrl : faker.internet.url(),
      installInstructions:
        params.installInstructions !== undefined
          ? params.installInstructions
          : faker.lorem.sentence(),
      grantablePermissions: params.grantablePermissions ?? [
        "document.read",
        "document.create",
        "project.read",
      ],
      installed: params.installed ?? false,
    }
  },
)

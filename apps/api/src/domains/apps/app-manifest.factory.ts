import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import { DOCUMENT_CREATE_PERMISSION, DOCUMENT_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import type { AppManifest } from "./app-manifest.entity"

export const appManifestFactory = Factory.define<AppManifest>(({ sequence, params }) => {
  const now = new Date()
  return {
    id: params.id || randomUUID(),
    name: params.name ?? "Helpful Assistant",
    slug: params.slug ?? `helpful-assistant-${sequence}`,
    description: params.description ?? "A generic assistant used in tests.",
    logoUrl: params.logoUrl ?? null,
    grantablePermissions: params.grantablePermissions ?? [
      DOCUMENT_READ_PERMISSION,
      DOCUMENT_CREATE_PERMISSION,
    ],
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: params.deletedAt ?? null,
  } satisfies AppManifest
})

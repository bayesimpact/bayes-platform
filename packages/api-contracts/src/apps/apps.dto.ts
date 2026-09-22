import { z } from "zod"
import type { TimeType } from "../generic"
import { APP_GRANTABLE_PERMISSIONS, type AppGrantablePermission } from "../rbac/permissions"

export type { AppGrantablePermission }

export type AppManifestDto = {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  grantablePermissions: AppGrantablePermission[]
  createdAt: TimeType
}

export const appManifestSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case")

const grantablePermissionSchema = z.enum(
  APP_GRANTABLE_PERMISSIONS as unknown as [AppGrantablePermission, ...AppGrantablePermission[]],
)

const emptyToNull = (value: string | null | undefined) => (value ? value : null)

export const createAppManifestSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    slug: appManifestSlugSchema,
    description: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((value) => emptyToNull(value)),
    logoUrl: z
      .union([z.string().url(), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" || value === undefined ? null : value)),
    grantablePermissions: z.array(grantablePermissionSchema),
  })
  .strict()

export type CreateAppManifestRequestDto = z.infer<typeof createAppManifestSchema>

export const updateAppManifestSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    slug: appManifestSlugSchema.optional(),
    description: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((value) => (value === undefined ? undefined : emptyToNull(value))),
    logoUrl: z
      .union([z.string().url(), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "" ? null : value)),
    grantablePermissions: z.array(grantablePermissionSchema).optional(),
  })
  .strict()

export type UpdateAppManifestRequestDto = {
  name?: string
  slug?: string
  description?: string | null
  logoUrl?: string | null
  grantablePermissions?: AppGrantablePermission[]
}

export type AppInstallProjectDto = {
  id: string
  name: string
  organizationId: string
  organizationName: string
}

export type AppInstallPageDto = {
  app: {
    id: string
    name: string
    slug: string
    description: string | null
    logoUrl: string | null
    grantablePermissions: AppGrantablePermission[]
  }
  projects: AppInstallProjectDto[]
}

export const authorizeAppInstallSchema = z
  .object({
    projectId: z.string().uuid(),
    permissions: z.array(grantablePermissionSchema),
    redirectUri: z.string().url(),
    state: z.string().min(1).max(512),
  })
  .strict()

export type AuthorizeAppInstallRequestDto = z.infer<typeof authorizeAppInstallSchema>

export type AuthorizeAppInstallResponseDto = {
  clientId: string
  clientSecret: string
  redirectUri: string
  state: string
}

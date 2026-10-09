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
  allowedRedirectUris: string[]
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

const httpRedirectUriSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === "http:" || url.protocol === "https:"
    } catch {
      return false
    }
  }, "Must be an http(s) URL")

export const allowedRedirectUrisSchema = z.array(httpRedirectUriSchema).max(20)

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
    allowedRedirectUris: allowedRedirectUrisSchema.optional().transform((value) => value ?? []),
  })
  .strict()

export type CreateAppManifestRequestDto = {
  name: string
  slug: string
  description?: string | null
  logoUrl?: string | null
  grantablePermissions: AppGrantablePermission[]
  /** Omitted on create → empty allowlist (loopback install still works). */
  allowedRedirectUris?: string[]
}

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
    allowedRedirectUris: allowedRedirectUrisSchema.optional(),
  })
  .strict()

export type UpdateAppManifestRequestDto = {
  name?: string
  slug?: string
  description?: string | null
  logoUrl?: string | null
  grantablePermissions?: AppGrantablePermission[]
  allowedRedirectUris?: string[]
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
    allowedRedirectUris: string[]
  }
  projects: AppInstallProjectDto[]
}

export type AppInstallationSummaryDto = {
  id: string
  appName: string
  description: string | null
  logoUrl: string | null
  permissions: string[]
  clientId: string | null
  createdAt: TimeType
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

export const appClientCredentialsTokenSchema = z
  .object({
    grant_type: z.literal("client_credentials"),
    client_id: z.string().uuid(),
    client_secret: z.string().min(1).max(256),
  })
  .strict()

export type AppClientCredentialsTokenRequestDto = z.infer<typeof appClientCredentialsTokenSchema>

export type AppAccessTokenResponseDto = {
  access_token: string
  token_type: "Bearer"
  expires_in: number
}

export type AppMeResponseDto = {
  userId: string
  projectId: string
  projectName: string
  organizationId: string
  organizationName: string
  installationId: string
}

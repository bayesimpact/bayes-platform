import {
  AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION,
  APP_GRANTABLE_PERMISSIONS,
  type AppGrantablePermission,
} from "@caseai-connect/permissions"

// The catalog lives in @caseai-connect/permissions, shared with the contracts of the Desk and
// Evaluation. The labels below are text the Studio shows, so they stay here.
export * from "@caseai-connect/permissions"

/** Product labels for the resource-type prefix of an App-grantable permission. */
export const APP_GRANTABLE_RESOURCE_LABELS = {
  document: "Document",
  document_source: "Document source",
  document_tag: "Document tag",
  project: "Workspace",
  agent: "Agent",
  organization: "Organization",
} as const

export type AppGrantableResourceType = keyof typeof APP_GRANTABLE_RESOURCE_LABELS

export type AppGrantablePermissionGroup = {
  resourceType: string
  label: string
  permissions: AppGrantablePermission[]
}

export function groupAppGrantablePermissions(
  permissions: readonly AppGrantablePermission[] = APP_GRANTABLE_PERMISSIONS,
): AppGrantablePermissionGroup[] {
  const groups: AppGrantablePermissionGroup[] = []
  for (const permission of permissions) {
    const resourceType = permission.split(".")[0] ?? permission
    const existingGroup = groups.find((group) => group.resourceType === resourceType)
    if (existingGroup) {
      existingGroup.permissions.push(permission)
      continue
    }
    const label =
      resourceType in APP_GRANTABLE_RESOURCE_LABELS
        ? APP_GRANTABLE_RESOURCE_LABELS[resourceType as AppGrantableResourceType]
        : resourceType
    groups.push({ resourceType, label, permissions: [permission] })
  }
  return groups
}

/** Action labels that the permission key does not spell well on its own. */
const APP_GRANTABLE_ACTION_LABELS: Partial<Record<AppGrantablePermission, string>> = {
  [AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION]: "Chat for people outside Bayes",
}

export function appGrantablePermissionActionLabel(permission: AppGrantablePermission): string {
  const label = APP_GRANTABLE_ACTION_LABELS[permission]
  if (label) return label
  const action = permission.slice(permission.indexOf(".") + 1)
  if (!action) return permission
  return action.charAt(0).toUpperCase() + action.slice(1)
}

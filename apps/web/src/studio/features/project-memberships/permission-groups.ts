/**
 * Areas used to display permission keys, in display order. A key belongs to the area with the
 * longest matching prefix, so `evaluation.ui.read` lands in "apps" rather than an evaluation area.
 * Each key has a heading in the `permissionGroup` locale namespace.
 */
const PERMISSION_GROUPS = [
  { key: "project", prefixes: ["project."] },
  { key: "apps", prefixes: ["desk.ui.", "studio.ui.", "evaluation.ui."] },
  { key: "agent", prefixes: ["agent."] },
  { key: "document", prefixes: ["document."] },
  { key: "documentSource", prefixes: ["document_source."] },
  { key: "documentTag", prefixes: ["document_tag."] },
  { key: "csvExtractionRun", prefixes: ["csv_extraction_run."] },
  { key: "csvExtractionRunPlayground", prefixes: ["csv_extraction_run.playground."] },
  { key: "evaluationExtraction", prefixes: ["evaluation.extraction."] },
  { key: "evaluationConversation", prefixes: ["evaluation.conversation."] },
  { key: "resourceLibrary", prefixes: ["resource_library."] },
  { key: "organization", prefixes: ["organization.", "user."] },
  { key: "platform", prefixes: ["backoffice.", "app.", "trace."] },
] as const

export type PermissionGroupKey = (typeof PERMISSION_GROUPS)[number]["key"] | "other"

export type PermissionGroup = { key: PermissionGroupKey; permissions: string[] }

const ACTION_ORDER = ["read", "create", "update", "delete"]

function findGroupKey(permission: string): PermissionGroupKey {
  let bestKey: PermissionGroupKey = "other"
  let bestLength = 0
  for (const group of PERMISSION_GROUPS) {
    for (const prefix of group.prefixes) {
      if (permission.startsWith(prefix) && prefix.length > bestLength) {
        bestKey = group.key
        bestLength = prefix.length
      }
    }
  }
  return bestKey
}

/** `agent.analytics.read` → subject `agent.analytics`, action `read`. */
function splitPermission(permission: string) {
  const separatorIndex = permission.lastIndexOf(".")
  const subject = permission.slice(0, separatorIndex)
  const rank = ACTION_ORDER.indexOf(permission.slice(separatorIndex + 1))
  return {
    subject,
    subjectDepth: subject.split(".").length,
    actionRank: rank === -1 ? ACTION_ORDER.length : rank,
  }
}

// Shallow subjects first (`agent.read` before `agent.analytics.read`), one subject at a time,
// each in read, create, update, delete order.
function comparePermissions(left: string, right: string): number {
  const leftParts = splitPermission(left)
  const rightParts = splitPermission(right)
  return (
    leftParts.subjectDepth - rightParts.subjectDepth ||
    leftParts.subject.localeCompare(rightParts.subject) ||
    leftParts.actionRank - rightParts.actionRank ||
    left.localeCompare(right)
  )
}

/** Splits permission keys into display areas, each sorted read, create, update, delete. */
export function groupPermissions(permissions: string[]): PermissionGroup[] {
  const permissionsByGroup = new Map<PermissionGroupKey, string[]>()
  for (const permission of permissions) {
    const groupKey = findGroupKey(permission)
    permissionsByGroup.set(groupKey, [...(permissionsByGroup.get(groupKey) ?? []), permission])
  }
  const groupOrder: PermissionGroupKey[] = [...PERMISSION_GROUPS.map((group) => group.key), "other"]
  return groupOrder.flatMap((groupKey) => {
    const groupPermissionKeys = permissionsByGroup.get(groupKey)
    if (!groupPermissionKeys) return []
    return [{ key: groupKey, permissions: [...groupPermissionKeys].sort(comparePermissions) }]
  })
}

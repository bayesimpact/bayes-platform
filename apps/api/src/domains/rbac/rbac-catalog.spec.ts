import { ALL_RBAC_ROLES } from "./rbac.constants"
import { APP_ACTIONS, APP_SUBJECTS, RBAC_CATALOG } from "./rbac-catalog"

describe("RBAC_CATALOG", () => {
  it("has the expected total rule count (sync with docs/rbac-permission-catalog.md §4)", () => {
    expect(RBAC_CATALOG).toHaveLength(157)
  })

  it("references only known roles", () => {
    const knownRoles = new Set<string>(ALL_RBAC_ROLES)
    const unknown = RBAC_CATALOG.filter((rule) => !knownRoles.has(rule.role))
    expect(unknown).toEqual([])
  })

  it("references only known subjects", () => {
    const knownSubjects = new Set<string>(APP_SUBJECTS)
    const unknown = RBAC_CATALOG.filter((rule) => !knownSubjects.has(rule.subject))
    expect(unknown).toEqual([])
  })

  it("references only known actions", () => {
    const knownActions = new Set<string>(APP_ACTIONS)
    const unknown = RBAC_CATALOG.filter((rule) => !knownActions.has(rule.action))
    expect(unknown).toEqual([])
  })

  it("has no exact duplicate (role, action, subject, conditions) tuples", () => {
    const seen = new Map<string, number>()
    for (const rule of RBAC_CATALOG) {
      const key = `${rule.role}|${rule.action}|${rule.subject}|${JSON.stringify(rule.conditions ?? null)}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1)
    expect(duplicates).toEqual([])
  })
})

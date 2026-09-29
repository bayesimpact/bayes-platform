import {
  AGENT_ANALYTICS_READ_PERMISSION,
  AGENT_ROLE_PERMISSIONS,
  APP_GRANTABLE_PERMISSIONS,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_DELETE_PERMISSION,
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_SOURCE_CREATE_PERMISSION,
  DOCUMENT_SOURCE_DELETE_PERMISSION,
  DOCUMENT_SOURCE_READ_PERMISSION,
  DOCUMENT_SOURCE_UPDATE_PERMISSION,
  DOCUMENT_UPDATE_PERMISSION,
  EVALUATION_ACCESS_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_READ_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION,
  intersectWithAppGrantablePermissions,
  ORGANIZATION_ROLE_PERMISSIONS,
  PROJECT_ANALYTICS_READ_PERMISSION,
  PROJECT_CREATE_PERMISSION,
  PROJECT_DELETE_PERMISSION,
  PROJECT_READ_PERMISSION,
  PROJECT_ROLE_PERMISSIONS,
  PROJECT_UPDATE_PERMISSION,
  RESOURCE_TYPE_PERMISSIONS_MAP,
} from "./rbac.constants"

describe("intersectWithAppGrantablePermissions", () => {
  it("does not allow granting project.create", () => {
    expect(APP_GRANTABLE_PERMISSIONS).not.toContain(PROJECT_CREATE_PERMISSION)
  })

  it("keeps only allowlisted permissions, grouped by resource type", () => {
    expect(
      intersectWithAppGrantablePermissions([
        DOCUMENT_READ_PERMISSION,
        DOCUMENT_CREATE_PERMISSION,
        "organization.delete",
        DOCUMENT_UPDATE_PERMISSION,
        DOCUMENT_DELETE_PERMISSION,
        DOCUMENT_SOURCE_READ_PERMISSION,
        DOCUMENT_SOURCE_CREATE_PERMISSION,
        DOCUMENT_SOURCE_UPDATE_PERMISSION,
        DOCUMENT_SOURCE_DELETE_PERMISSION,
        "agent.create",
        PROJECT_READ_PERMISSION,
        PROJECT_UPDATE_PERMISSION,
        PROJECT_DELETE_PERMISSION,
        PROJECT_CREATE_PERMISSION,
      ]),
    ).toEqual([...APP_GRANTABLE_PERMISSIONS])
  })

  it("drops permissions that are not on the allowlist", () => {
    expect(intersectWithAppGrantablePermissions(["organization.delete", "app.install"])).toEqual([])
  })

  it("deduplicates while preserving first-seen order", () => {
    expect(
      intersectWithAppGrantablePermissions([
        DOCUMENT_CREATE_PERMISSION,
        DOCUMENT_READ_PERMISSION,
        DOCUMENT_CREATE_PERMISSION,
      ]),
    ).toEqual([DOCUMENT_CREATE_PERMISSION, DOCUMENT_READ_PERMISSION])
  })

  it("returns an empty list for an empty input", () => {
    expect(intersectWithAppGrantablePermissions([])).toEqual([])
  })
})

describe("analytics permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  it("grants project analytics to project owners and admins only", () => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, PROJECT_ANALYTICS_READ_PERMISSION)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, PROJECT_ANALYTICS_READ_PERMISSION)).toEqual(
      [],
    )
  })

  it("grants agent analytics to agent owners and admins only", () => {
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, AGENT_ANALYTICS_READ_PERMISSION)).toEqual([
      "agent_owner",
      "agent_admin",
    ])
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, AGENT_ANALYTICS_READ_PERMISSION)).toEqual([])
  })

  it("never inherits analytics from a parent resource", () => {
    const inheritable: readonly string[] = [
      ...RESOURCE_TYPE_PERMISSIONS_MAP.project,
      ...RESOURCE_TYPE_PERMISSIONS_MAP.agent,
    ]
    expect(inheritable).not.toContain(PROJECT_ANALYTICS_READ_PERMISSION)
    expect(inheritable).not.toContain(AGENT_ANALYTICS_READ_PERMISSION)
  })
})

describe("evaluation extraction dataset permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const evaluationExtractionDatasetPermissions = [
    EVALUATION_EXTRACTION_DATASET_READ_PERMISSION,
    EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
    EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION,
    EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION,
  ]

  it.each(
    evaluationExtractionDatasetPermissions,
  )("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits evaluation extraction datasets from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of evaluationExtractionDatasetPermissions) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("evaluation access permission", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  it("grants evaluation.access to project owners and admins only", () => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, EVALUATION_ACCESS_PERMISSION)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, EVALUATION_ACCESS_PERMISSION)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, EVALUATION_ACCESS_PERMISSION)).toEqual([])
  })

  it("never inherits evaluation.access from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    expect(inheritable).not.toContain(EVALUATION_ACCESS_PERMISSION)
  })
})

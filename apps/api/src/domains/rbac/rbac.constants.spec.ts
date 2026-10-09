import {
  AGENT_ANALYTICS_READ_PERMISSION,
  AGENT_CONVERSATION_SESSION_CREATE_PERMISSION,
  AGENT_CONVERSATION_SESSION_DELETE_PERMISSION,
  AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION,
  AGENT_CONVERSATION_SESSION_PLAYGROUND_CREATE_PERMISSION,
  AGENT_CONVERSATION_SESSION_PLAYGROUND_DELETE_PERMISSION,
  AGENT_CONVERSATION_SESSION_PLAYGROUND_READ_PERMISSION,
  AGENT_CONVERSATION_SESSION_READ_PERMISSION,
  AGENT_DRAFT_READ_PERMISSION,
  AGENT_EXTRACTION_SESSION_CREATE_PERMISSION,
  AGENT_EXTRACTION_SESSION_DELETE_PERMISSION,
  AGENT_EXTRACTION_SESSION_PLAYGROUND_CREATE_PERMISSION,
  AGENT_EXTRACTION_SESSION_PLAYGROUND_DELETE_PERMISSION,
  AGENT_EXTRACTION_SESSION_PLAYGROUND_READ_PERMISSION,
  AGENT_EXTRACTION_SESSION_READ_PERMISSION,
  AGENT_MEMBER_DELETE_PERMISSION,
  AGENT_MEMBER_INVITE_PERMISSION,
  AGENT_MEMBER_READ_PERMISSION,
  AGENT_READ_PERMISSION,
  AGENT_ROLE_PERMISSIONS,
  AGENT_SETTINGS_ARCHIVE_PERMISSION,
  AGENT_SETTINGS_DRAFT_PUBLISH_PERMISSION,
  AGENT_SETTINGS_DRAFT_READ_PERMISSION,
  AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION,
  AGENT_SETTINGS_RESTORE_PERMISSION,
  AGENT_SUB_AGENT_READ_PERMISSION,
  AGENT_SUB_AGENT_UPDATE_PERMISSION,
  APP_GRANTABLE_PERMISSIONS,
  CSV_EXTRACTION_RUN_CREATE_PERMISSION,
  CSV_EXTRACTION_RUN_DELETE_PERMISSION,
  CSV_EXTRACTION_RUN_PLAYGROUND_CREATE_PERMISSION,
  CSV_EXTRACTION_RUN_PLAYGROUND_DELETE_PERMISSION,
  CSV_EXTRACTION_RUN_PLAYGROUND_READ_PERMISSION,
  CSV_EXTRACTION_RUN_PLAYGROUND_UPDATE_PERMISSION,
  CSV_EXTRACTION_RUN_READ_PERMISSION,
  CSV_EXTRACTION_RUN_UPDATE_PERMISSION,
  DESK_UI_READ_PERMISSION,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_DELETE_PERMISSION,
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_SOURCE_CREATE_PERMISSION,
  DOCUMENT_SOURCE_DELETE_PERMISSION,
  DOCUMENT_SOURCE_READ_PERMISSION,
  DOCUMENT_SOURCE_UPDATE_PERMISSION,
  DOCUMENT_TAG_CREATE_PERMISSION,
  DOCUMENT_TAG_DELETE_PERMISSION,
  DOCUMENT_TAG_READ_PERMISSION,
  DOCUMENT_TAG_UPDATE_PERMISSION,
  DOCUMENT_UPDATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_READ_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_READ_PERMISSION,
  EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_READ_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_READ_PERMISSION,
  EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION,
  EVALUATION_UI_READ_PERMISSION,
  intersectWithAppGrantablePermissions,
  ORGANIZATION_ROLE_PERMISSIONS,
  PROJECT_AGENT_MESSAGE_FEEDBACK_CREATE_PERMISSION,
  PROJECT_AGENT_MESSAGE_FEEDBACK_READ_PERMISSION,
  PROJECT_AGENT_SESSION_CATEGORY_CREATE_PERMISSION,
  PROJECT_AGENT_SESSION_CATEGORY_DELETE_PERMISSION,
  PROJECT_ANALYTICS_READ_PERMISSION,
  PROJECT_CREATE_PERMISSION,
  PROJECT_DELETE_PERMISSION,
  PROJECT_MCP_SERVER_CREATE_PERMISSION,
  PROJECT_MCP_SERVER_DELETE_PERMISSION,
  PROJECT_MCP_SERVER_READ_PERMISSION,
  PROJECT_MCP_SERVER_UPDATE_PERMISSION,
  PROJECT_MEMBER_DELETE_PERMISSION,
  PROJECT_MEMBER_INVITE_PERMISSION,
  PROJECT_MEMBER_READ_PERMISSION,
  PROJECT_READ_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION,
  PROJECT_ROLE_PERMISSIONS,
  PROJECT_UPDATE_PERMISSION,
  RESOURCE_LIBRARY_CREATE_PERMISSION,
  RESOURCE_LIBRARY_DELETE_PERMISSION,
  RESOURCE_LIBRARY_READ_PERMISSION,
  RESOURCE_LIBRARY_UPDATE_PERMISSION,
  RESOURCE_TYPE_PERMISSIONS_MAP,
  STUDIO_UI_READ_PERMISSION,
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
        DOCUMENT_TAG_READ_PERMISSION,
        DOCUMENT_TAG_CREATE_PERMISSION,
        DOCUMENT_TAG_UPDATE_PERMISSION,
        DOCUMENT_TAG_DELETE_PERMISSION,
        "agent.create",
        PROJECT_READ_PERMISSION,
        PROJECT_UPDATE_PERMISSION,
        PROJECT_DELETE_PERMISSION,
        PROJECT_CREATE_PERMISSION,
        AGENT_READ_PERMISSION,
        "agent.update",
        AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION,
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

describe("agent draft and sub-agent permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  it("grants agent drafts to project owners and admins only", () => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, AGENT_DRAFT_READ_PERMISSION)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, AGENT_DRAFT_READ_PERMISSION)).toEqual([])
  })

  it.each([
    AGENT_SUB_AGENT_READ_PERMISSION,
    AGENT_SUB_AGENT_UPDATE_PERMISSION,
  ])("grants %s to agent owners and admins only", (permission) => {
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual(["agent_owner", "agent_admin"])
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits agent drafts or sub-agents from a parent resource", () => {
    const inheritable: readonly string[] = [
      ...RESOURCE_TYPE_PERMISSIONS_MAP.project,
      ...RESOURCE_TYPE_PERMISSIONS_MAP.agent,
    ]
    expect(inheritable).not.toContain(AGENT_DRAFT_READ_PERMISSION)
    expect(inheritable).not.toContain(AGENT_SUB_AGENT_READ_PERMISSION)
    expect(inheritable).not.toContain(AGENT_SUB_AGENT_UPDATE_PERMISSION)
  })
})

describe("agent settings permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const agentSettingsChangePermissions = [
    AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION,
    AGENT_SETTINGS_DRAFT_PUBLISH_PERMISSION,
    AGENT_SETTINGS_RESTORE_PERMISSION,
    AGENT_SETTINGS_ARCHIVE_PERMISSION,
  ]

  it("grants the settings history to project owners and admins only", () => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, AGENT_SETTINGS_DRAFT_READ_PERMISSION)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(
      rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, AGENT_SETTINGS_DRAFT_READ_PERMISSION),
    ).toEqual([])
  })

  it.each(
    agentSettingsChangePermissions,
  )("grants %s to agent owners and admins only", (permission) => {
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual(["agent_owner", "agent_admin"])
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("passes the settings history down from the project to its agents", () => {
    expect(RESOURCE_TYPE_PERMISSIONS_MAP.agent).toContain(AGENT_SETTINGS_DRAFT_READ_PERMISSION)
  })

  it("never inherits the settings changes from a parent resource", () => {
    const inheritable: readonly string[] = [
      ...RESOURCE_TYPE_PERMISSIONS_MAP.project,
      ...RESOURCE_TYPE_PERMISSIONS_MAP.agent,
    ]
    for (const permission of agentSettingsChangePermissions) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("invitation permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  it("lets project owners and admins invite to a project and its campaigns", () => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, PROJECT_MEMBER_INVITE_PERMISSION)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, PROJECT_MEMBER_INVITE_PERMISSION)).toEqual(
      [],
    )
  })

  it("lets agent owners and admins invite to their agent only", () => {
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, AGENT_MEMBER_INVITE_PERMISSION)).toEqual([
      "agent_owner",
      "agent_admin",
    ])
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, AGENT_MEMBER_INVITE_PERMISSION)).toEqual([])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, AGENT_MEMBER_INVITE_PERMISSION)).toEqual([])
  })

  it("never inherits the invitation permissions from a parent resource", () => {
    const inheritable: readonly string[] = [
      ...RESOURCE_TYPE_PERMISSIONS_MAP.project,
      ...RESOURCE_TYPE_PERMISSIONS_MAP.agent,
    ]
    expect(inheritable).not.toContain(PROJECT_MEMBER_INVITE_PERMISSION)
    expect(inheritable).not.toContain(AGENT_MEMBER_INVITE_PERMISSION)
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

describe("user interface permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  it("grants desk.ui.read to every project role", () => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, DESK_UI_READ_PERMISSION)).toEqual([
      "project_owner",
      "project_admin",
      "project_member",
    ])
  })

  it.each([
    STUDIO_UI_READ_PERMISSION,
    EVALUATION_UI_READ_PERMISSION,
  ])("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
  })

  it.each([
    DESK_UI_READ_PERMISSION,
    STUDIO_UI_READ_PERMISSION,
    EVALUATION_UI_READ_PERMISSION,
  ])("never grants %s on an organization or agent role, nor inherits it", (permission) => {
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    expect(inheritable).not.toContain(permission)
  })
})

describe("evaluation extraction run permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const evaluationExtractionRunPermissions = [
    EVALUATION_EXTRACTION_RUN_READ_PERMISSION,
    EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION,
    EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION,
    EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION,
  ]

  it.each(
    evaluationExtractionRunPermissions,
  )("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits evaluation extraction runs from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of evaluationExtractionRunPermissions) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("evaluation conversation dataset permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const evaluationConversationDatasetPermissions = [
    EVALUATION_CONVERSATION_DATASET_READ_PERMISSION,
    EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
    EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
    EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  ]

  it.each(
    evaluationConversationDatasetPermissions,
  )("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits evaluation conversation datasets from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of evaluationConversationDatasetPermissions) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("evaluation conversation run permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const evaluationConversationRunPermissions = [
    EVALUATION_CONVERSATION_RUN_READ_PERMISSION,
    EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
    EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
    EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
  ]

  it.each(
    evaluationConversationRunPermissions,
  )("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits evaluation conversation runs from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of evaluationConversationRunPermissions) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("resource library permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const resourceLibraryPermissions = [
    RESOURCE_LIBRARY_READ_PERMISSION,
    RESOURCE_LIBRARY_CREATE_PERMISSION,
    RESOURCE_LIBRARY_UPDATE_PERMISSION,
    RESOURCE_LIBRARY_DELETE_PERMISSION,
  ]

  it.each(
    resourceLibraryPermissions,
  )("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits resource libraries from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of resourceLibraryPermissions) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("CSV extraction run permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const csvExtractionRunPermissions = [
    CSV_EXTRACTION_RUN_READ_PERMISSION,
    CSV_EXTRACTION_RUN_CREATE_PERMISSION,
    CSV_EXTRACTION_RUN_UPDATE_PERMISSION,
    CSV_EXTRACTION_RUN_DELETE_PERMISSION,
  ]

  it.each(csvExtractionRunPermissions)("grants %s to every project role only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
      "project_member",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  const playgroundCsvExtractionRunPermissions = [
    CSV_EXTRACTION_RUN_PLAYGROUND_READ_PERMISSION,
    CSV_EXTRACTION_RUN_PLAYGROUND_CREATE_PERMISSION,
    CSV_EXTRACTION_RUN_PLAYGROUND_UPDATE_PERMISSION,
    CSV_EXTRACTION_RUN_PLAYGROUND_DELETE_PERMISSION,
  ]

  it.each(
    playgroundCsvExtractionRunPermissions,
  )("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits CSV extraction runs from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of [
      ...csvExtractionRunPermissions,
      CSV_EXTRACTION_RUN_PLAYGROUND_CREATE_PERMISSION,
      CSV_EXTRACTION_RUN_PLAYGROUND_DELETE_PERMISSION,
      CSV_EXTRACTION_RUN_PLAYGROUND_READ_PERMISSION,
      CSV_EXTRACTION_RUN_PLAYGROUND_UPDATE_PERMISSION,
    ]) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("conversation agent session permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const liveSessionPermissions = [
    AGENT_CONVERSATION_SESSION_READ_PERMISSION,
    AGENT_CONVERSATION_SESSION_CREATE_PERMISSION,
    AGENT_CONVERSATION_SESSION_DELETE_PERMISSION,
  ]

  it.each(liveSessionPermissions)("grants %s to every project role only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
      "project_member",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  const playgroundSessionPermissions = [
    AGENT_CONVERSATION_SESSION_PLAYGROUND_READ_PERMISSION,
    AGENT_CONVERSATION_SESSION_PLAYGROUND_CREATE_PERMISSION,
    AGENT_CONVERSATION_SESSION_PLAYGROUND_DELETE_PERMISSION,
  ]

  it.each(
    playgroundSessionPermissions,
  )("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits conversation sessions from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of [...liveSessionPermissions, ...playgroundSessionPermissions]) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("extraction agent session permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const liveSessionPermissions = [
    AGENT_EXTRACTION_SESSION_READ_PERMISSION,
    AGENT_EXTRACTION_SESSION_CREATE_PERMISSION,
    AGENT_EXTRACTION_SESSION_DELETE_PERMISSION,
  ]

  it.each(liveSessionPermissions)("grants %s to every project role only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
      "project_member",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  const playgroundSessionPermissions = [
    AGENT_EXTRACTION_SESSION_PLAYGROUND_READ_PERMISSION,
    AGENT_EXTRACTION_SESSION_PLAYGROUND_CREATE_PERMISSION,
    AGENT_EXTRACTION_SESSION_PLAYGROUND_DELETE_PERMISSION,
  ]

  it.each(
    playgroundSessionPermissions,
  )("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits extraction sessions from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of [...liveSessionPermissions, ...playgroundSessionPermissions]) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("project agent session category permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const sessionCategoryPermissions = [
    PROJECT_AGENT_SESSION_CATEGORY_CREATE_PERMISSION,
    PROJECT_AGENT_SESSION_CATEGORY_DELETE_PERMISSION,
  ]

  it.each(
    sessionCategoryPermissions,
  )("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits session categories from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of sessionCategoryPermissions) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("project agent message feedback permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  it("grants project.agent_message_feedback.create to every project role only", () => {
    const permission = PROJECT_AGENT_MESSAGE_FEEDBACK_CREATE_PERMISSION
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
      "project_member",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("grants project.agent_message_feedback.read to project owners and admins only", () => {
    const permission = PROJECT_AGENT_MESSAGE_FEEDBACK_READ_PERMISSION
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits message feedback from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of [
      PROJECT_AGENT_MESSAGE_FEEDBACK_CREATE_PERMISSION,
      PROJECT_AGENT_MESSAGE_FEEDBACK_READ_PERMISSION,
    ]) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("document tag permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const documentTagPermissions = [
    DOCUMENT_TAG_READ_PERMISSION,
    DOCUMENT_TAG_CREATE_PERMISSION,
    DOCUMENT_TAG_UPDATE_PERMISSION,
    DOCUMENT_TAG_DELETE_PERMISSION,
  ]

  it.each(documentTagPermissions)("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits document tags from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of documentTagPermissions) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("project MCP server permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  it("grants project.mcp_server.read to every project role only", () => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, PROJECT_MCP_SERVER_READ_PERMISSION)).toEqual([
      "project_owner",
      "project_admin",
      "project_member",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, PROJECT_MCP_SERVER_READ_PERMISSION)).toEqual(
      [],
    )
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, PROJECT_MCP_SERVER_READ_PERMISSION)).toEqual([])
  })

  const mcpServerWritePermissions = [
    PROJECT_MCP_SERVER_CREATE_PERMISSION,
    PROJECT_MCP_SERVER_UPDATE_PERMISSION,
    PROJECT_MCP_SERVER_DELETE_PERMISSION,
  ]

  it.each(
    mcpServerWritePermissions,
  )("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits MCP servers from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of [PROJECT_MCP_SERVER_READ_PERMISSION, ...mcpServerWritePermissions]) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("project review campaign permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const reviewCampaignPermissions = [
    PROJECT_REVIEW_CAMPAIGN_READ_PERMISSION,
    PROJECT_REVIEW_CAMPAIGN_CREATE_PERMISSION,
    PROJECT_REVIEW_CAMPAIGN_UPDATE_PERMISSION,
    PROJECT_REVIEW_CAMPAIGN_DELETE_PERMISSION,
    PROJECT_REVIEW_CAMPAIGN_MEMBER_DELETE_PERMISSION,
  ]

  it.each(
    reviewCampaignPermissions,
  )("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits review campaigns from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of reviewCampaignPermissions) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("project member permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const projectMemberPermissions = [
    PROJECT_MEMBER_READ_PERMISSION,
    PROJECT_MEMBER_DELETE_PERMISSION,
  ]

  it.each(projectMemberPermissions)("grants %s to project owners and admins only", (permission) => {
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([
      "project_owner",
      "project_admin",
    ])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits project members from the organization", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.project
    for (const permission of projectMemberPermissions) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

describe("agent member permissions", () => {
  const rolesHolding = (rolePermissions: Record<string, readonly string[]>, permission: string) =>
    Object.entries(rolePermissions)
      .filter(([_roleKey, permissions]) => permissions.includes(permission))
      .map(([roleKey]) => roleKey)

  const agentMemberPermissions = [AGENT_MEMBER_READ_PERMISSION, AGENT_MEMBER_DELETE_PERMISSION]

  it.each(agentMemberPermissions)("grants %s to agent owners and admins only", (permission) => {
    expect(rolesHolding(AGENT_ROLE_PERMISSIONS, permission)).toEqual(["agent_owner", "agent_admin"])
    expect(rolesHolding(PROJECT_ROLE_PERMISSIONS, permission)).toEqual([])
    expect(rolesHolding(ORGANIZATION_ROLE_PERMISSIONS, permission)).toEqual([])
  })

  it("never inherits agent members from a parent resource", () => {
    const inheritable: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP.agent
    for (const permission of agentMemberPermissions) {
      expect(inheritable).not.toContain(permission)
    }
  })
})

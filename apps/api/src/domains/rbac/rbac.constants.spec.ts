import {
  APP_GRANTABLE_PERMISSIONS,
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_DELETE_PERMISSION,
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_UPDATE_PERMISSION,
  intersectWithAppGrantablePermissions,
} from "./rbac.constants"

describe("intersectWithAppGrantablePermissions", () => {
  it("keeps only the V0 document permissions", () => {
    expect(
      intersectWithAppGrantablePermissions([
        DOCUMENT_READ_PERMISSION,
        DOCUMENT_CREATE_PERMISSION,
        "organization.delete",
        DOCUMENT_UPDATE_PERMISSION,
        DOCUMENT_DELETE_PERMISSION,
        "agent.create",
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

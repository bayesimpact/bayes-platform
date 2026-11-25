import { describe, expect, it } from "vitest"
import { adoptDeskSession } from "./adopt-desk-session"

const memoryStorage = (): Storage => {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe("adoptDeskSession", () => {
  const settings = { authority: "https://idp.example.org", client_id: "platform-web" }
  const deskKey = "desk.oidc.user:https://idp.example.org:platform-web"
  const sharedKey = "oidc.user:https://idp.example.org:platform-web"

  it("makes the Desk's own session the shared one when there is none", () => {
    const storage = memoryStorage()
    storage.setItem(deskKey, "desk session")

    adoptDeskSession(settings, storage)

    expect(storage.getItem(sharedKey)).toBe("desk session")
    expect(storage.getItem(deskKey)).toBeNull()
  })

  it("keeps the shared session, and forgets the Desk's own", () => {
    const storage = memoryStorage()
    storage.setItem(sharedKey, "shared session")
    storage.setItem(deskKey, "desk session")

    adoptDeskSession(settings, storage)

    expect(storage.getItem(sharedKey)).toBe("shared session")
    expect(storage.getItem(deskKey)).toBeNull()
  })
})

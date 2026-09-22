import {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  verifyClientSecret,
} from "./client-credentials"

describe("client credentials", () => {
  it("hashes a secret so it can be verified later and never stored as plaintext", async () => {
    const secret = generateClientSecret()
    const storedHash = await hashClientSecret(secret)

    expect(storedHash).toContain("scrypt$")
    expect(storedHash).not.toContain(secret)
    await expect(verifyClientSecret(secret, storedHash)).resolves.toBe(true)
    await expect(verifyClientSecret("wrong-secret", storedHash)).resolves.toBe(false)
  })

  it("generates a UUID client id", () => {
    expect(generateClientId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })
})

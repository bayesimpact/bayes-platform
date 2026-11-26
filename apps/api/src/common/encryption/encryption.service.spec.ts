import { randomBytes } from "node:crypto"
import type { ConfigService } from "@nestjs/config"
import { EncryptionService } from "./encryption.service"

const VALID_KEY_HEX = randomBytes(32).toString("hex")

const buildConfigService = (key: string | undefined) =>
  ({ get: () => key }) as unknown as ConfigService

const buildService = (key: string | undefined = VALID_KEY_HEX) =>
  new EncryptionService(buildConfigService(key))

const splitEncrypted = (encrypted: string) => {
  const [iv, authTag, ciphertext] = encrypted.split(":")
  if (!iv || !authTag || !ciphertext) throw new Error(`Unexpected format: ${encrypted}`)
  return { iv, authTag, ciphertext }
}

const flipFirstByte = (base64: string) => {
  const bytes = Buffer.from(base64, "base64")
  bytes[0] = (bytes[0] ?? 0) ^ 0xff
  return bytes.toString("base64")
}

describe("EncryptionService", () => {
  describe("constructor", () => {
    it("should throw when MCP_ENCRYPTION_KEY is missing", () => {
      expect(() => new EncryptionService(buildConfigService(undefined))).toThrow(
        "MCP_ENCRYPTION_KEY env var is required",
      )
    })

    it("should throw when MCP_ENCRYPTION_KEY is not 32 bytes", () => {
      expect(() => buildService(randomBytes(16).toString("hex"))).toThrow(
        "MCP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
      )
    })

    it("should accept a 64-character hex key", () => {
      expect(() => buildService()).not.toThrow()
    })
  })

  describe("encrypt / decrypt", () => {
    it("should round-trip a plaintext", () => {
      const service = buildService()
      const plaintext = JSON.stringify({ url: "https://example.com/mcp", apiKey: "sk-secret" })

      expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext)
    })

    it("should round-trip an empty string", () => {
      const service = buildService()

      expect(service.decrypt(service.encrypt(""))).toBe("")
    })

    it("should round-trip multi-byte characters", () => {
      const service = buildService()
      const plaintext = "clé secrète – 秘密 🔐"

      expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext)
    })

    it("should produce iv:authTag:ciphertext without leaking the plaintext", () => {
      const service = buildService()
      const encrypted = service.encrypt("sk-secret")

      const { iv, authTag } = splitEncrypted(encrypted)
      expect(encrypted.split(":")).toHaveLength(3)
      expect(Buffer.from(iv, "base64")).toHaveLength(16)
      expect(Buffer.from(authTag, "base64")).toHaveLength(16)
      expect(encrypted).not.toContain("sk-secret")
    })

    it("should use a fresh IV so the same plaintext encrypts differently", () => {
      const service = buildService()

      expect(service.encrypt("same")).not.toBe(service.encrypt("same"))
    })

    it("should reject a ciphertext produced with another key", () => {
      const encrypted = buildService().encrypt("secret")
      const otherService = buildService(randomBytes(32).toString("hex"))

      expect(() => otherService.decrypt(encrypted)).toThrow()
    })

    it("should reject a tampered ciphertext", () => {
      const service = buildService()
      const { iv, authTag, ciphertext } = splitEncrypted(service.encrypt("secret"))

      expect(() => service.decrypt(`${iv}:${authTag}:${flipFirstByte(ciphertext)}`)).toThrow()
    })

    it("should reject a tampered auth tag", () => {
      const service = buildService()
      const { iv, authTag, ciphertext } = splitEncrypted(service.encrypt("secret"))

      expect(() => service.decrypt(`${iv}:${flipFirstByte(authTag)}:${ciphertext}`)).toThrow()
    })

    it.each([
      "",
      "onlyone",
      "two:parts",
      "a::c",
      ":b:c",
      "a:b:c:d",
    ])("should reject the malformed value %p", (malformed) => {
      const service = buildService()

      expect(() => service.decrypt(malformed)).toThrow(
        "Invalid encrypted format — expected iv:authTag:ciphertext",
      )
    })
  })
})

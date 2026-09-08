import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConfigService } from "@nestjs/config"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

@Injectable()
export class EncryptionService {
  private readonly key: Buffer

  constructor(configService: ConfigService) {
    const hex = configService.get<string>("MCP_ENCRYPTION_KEY")
    if (!hex) {
      throw new Error("MCP_ENCRYPTION_KEY env var is required")
    }
    this.key = Buffer.from(hex, "hex")
    if (this.key.length !== 32) {
      throw new Error("MCP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH })
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
    const authTag = cipher.getAuthTag()
    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`
  }

  decrypt(encrypted: string): string {
    const parts = encrypted.split(":")
    const [ivB64, authTagB64, ciphertextB64] = parts
    if (parts.length !== 3 || !ivB64 || !authTagB64 || ciphertextB64 === undefined) {
      throw new Error("Invalid encrypted format — expected iv:authTag:ciphertext")
    }
    const iv = Buffer.from(ivB64, "base64")
    const authTag = Buffer.from(authTagB64, "base64")
    const ciphertext = Buffer.from(ciphertextB64, "base64")
    const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)
    return decipher.update(ciphertext) + decipher.final("utf8")
  }
}

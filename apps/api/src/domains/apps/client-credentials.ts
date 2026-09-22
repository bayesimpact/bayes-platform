import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(scrypt)
const SCRYPT_KEY_LENGTH = 64

export function generateClientId(): string {
  return randomUUID()
}

export function generateClientSecret(): string {
  return randomBytes(32).toString("base64url")
}

export async function hashClientSecret(secret: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = (await scryptAsync(secret, salt, SCRYPT_KEY_LENGTH)) as Buffer
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`
}

export async function verifyClientSecret(secret: string, storedHash: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = storedHash.split("$")
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false

  const derived = (await scryptAsync(
    secret,
    Buffer.from(saltHex, "hex"),
    SCRYPT_KEY_LENGTH,
  )) as Buffer
  const expected = Buffer.from(hashHex, "hex")
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

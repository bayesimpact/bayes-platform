import { createSign, createVerify } from "node:crypto"

export const DEFAULT_APPS_JWT_ISSUER = "https://api.bayes.io/apps"
export const DEFAULT_APPS_JWT_AUDIENCE = "bayes-apps"
export const APPS_JWT_TTL_SECONDS = 60 * 60

export type AppJwtClaims = {
  iss: string
  aud: string
  sub: string
  project_id: string
  installation_id: string
  iat: number
  exp: number
}

export class InvalidAppJwtError extends Error {
  constructor(message = "Invalid App access token") {
    super(message)
    this.name = "InvalidAppJwtError"
  }
}

export function signAppJwt(params: {
  privateKey: string
  issuer: string
  audience: string
  subject: string
  projectId: string
  installationId: string
  ttlSeconds?: number
  nowSeconds?: number
}): string {
  const issuedAt = params.nowSeconds ?? Math.floor(Date.now() / 1000)
  const ttlSeconds = params.ttlSeconds ?? APPS_JWT_TTL_SECONDS
  const claims: AppJwtClaims = {
    iss: params.issuer,
    aud: params.audience,
    sub: params.subject,
    project_id: params.projectId,
    installation_id: params.installationId,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  }
  const header = encodeSegment({ alg: "RS256", typ: "JWT" })
  const payload = encodeSegment(claims)
  const signingInput = `${header}.${payload}`
  const signer = createSign("RSA-SHA256")
  signer.update(signingInput)
  signer.end()
  const signature = signer.sign(normalizePem(params.privateKey), "base64url")
  return `${signingInput}.${signature}`
}

export function verifyAppJwt(params: {
  token: string
  publicKey: string
  issuer: string
  audience: string
  nowSeconds?: number
  clockSkewSeconds?: number
}): AppJwtClaims {
  const [headerSegment, payloadSegment, signatureSegment] = params.token.split(".")
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    throw new InvalidAppJwtError()
  }

  const header = decodeSegment(headerSegment) as { alg?: unknown; typ?: unknown }
  if (header.alg !== "RS256") throw new InvalidAppJwtError()

  const signingInput = `${headerSegment}.${payloadSegment}`
  const verifier = createVerify("RSA-SHA256")
  verifier.update(signingInput)
  verifier.end()
  const signature = Buffer.from(signatureSegment, "base64url")
  let verified = false
  try {
    verified = verifier.verify(normalizePem(params.publicKey), signature)
  } catch {
    throw new InvalidAppJwtError()
  }
  if (!verified) throw new InvalidAppJwtError()

  const claims = decodeSegment(payloadSegment) as Partial<AppJwtClaims>
  if (!isAppJwtClaims(claims)) throw new InvalidAppJwtError()
  if (claims.iss !== params.issuer) throw new InvalidAppJwtError()
  if (claims.aud !== params.audience) throw new InvalidAppJwtError()

  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000)
  const clockSkewSeconds = params.clockSkewSeconds ?? 30
  if (claims.exp + clockSkewSeconds < nowSeconds) throw new InvalidAppJwtError()
  if (claims.iat - clockSkewSeconds > nowSeconds) throw new InvalidAppJwtError()

  return claims
}

export function normalizePem(value: string): string {
  return value.replaceAll("\\n", "\n").trim()
}

function encodeSegment(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
}

function decodeSegment(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"))
  } catch {
    throw new InvalidAppJwtError()
  }
}

function isAppJwtClaims(value: Partial<AppJwtClaims>): value is AppJwtClaims {
  return (
    typeof value.iss === "string" &&
    typeof value.aud === "string" &&
    typeof value.sub === "string" &&
    typeof value.project_id === "string" &&
    typeof value.installation_id === "string" &&
    typeof value.iat === "number" &&
    typeof value.exp === "number"
  )
}

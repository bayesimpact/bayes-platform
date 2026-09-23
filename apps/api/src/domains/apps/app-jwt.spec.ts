import { generateKeyPairSync } from "node:crypto"
import { InvalidAppJwtError, signAppJwt, verifyAppJwt } from "./app-jwt"

function testKeys() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  })
}

describe("App JWT", () => {
  const issuer = "https://api.bayes.io/apps"
  const audience = "bayes-apps"

  it("round-trips claims with RS256", () => {
    const { privateKey, publicKey } = testKeys()
    const token = signAppJwt({
      privateKey,
      issuer,
      audience,
      subject: "user-1",
      projectId: "project-1",
      installationId: "install-1",
      nowSeconds: 1_700_000_000,
    })
    expect(verifyAppJwt({ token, publicKey, issuer, audience, nowSeconds: 1_700_000_000 })).toEqual(
      {
        iss: issuer,
        aud: audience,
        sub: "user-1",
        project_id: "project-1",
        installation_id: "install-1",
        iat: 1_700_000_000,
        exp: 1_700_000_000 + 3600,
      },
    )
  })

  it("rejects a token signed with another key", () => {
    const signer = testKeys()
    const other = testKeys()
    const token = signAppJwt({
      privateKey: signer.privateKey,
      issuer,
      audience,
      subject: "user-1",
      projectId: "project-1",
      installationId: "install-1",
    })
    expect(() => verifyAppJwt({ token, publicKey: other.publicKey, issuer, audience })).toThrow(
      InvalidAppJwtError,
    )
  })

  it("rejects the wrong issuer or audience", () => {
    const { privateKey, publicKey } = testKeys()
    const token = signAppJwt({
      privateKey,
      issuer,
      audience,
      subject: "user-1",
      projectId: "project-1",
      installationId: "install-1",
    })
    expect(() =>
      verifyAppJwt({ token, publicKey, issuer: "https://evil.example", audience }),
    ).toThrow(InvalidAppJwtError)
    expect(() => verifyAppJwt({ token, publicKey, issuer, audience: "other" })).toThrow(
      InvalidAppJwtError,
    )
  })

  it("accepts PEM keys that used escaped newlines", () => {
    const { privateKey, publicKey } = testKeys()
    const token = signAppJwt({
      privateKey: privateKey.replaceAll("\n", "\\n"),
      issuer,
      audience,
      subject: "user-1",
      projectId: "project-1",
      installationId: "install-1",
    })
    expect(
      verifyAppJwt({
        token,
        publicKey: publicKey.replaceAll("\n", "\\n"),
        issuer,
        audience,
      }).sub,
    ).toBe("user-1")
  })

  it("rejects an expired token", () => {
    const { privateKey, publicKey } = testKeys()
    const token = signAppJwt({
      privateKey,
      issuer,
      audience,
      subject: "user-1",
      projectId: "project-1",
      installationId: "install-1",
      nowSeconds: 1_000,
      ttlSeconds: 60,
    })
    expect(() =>
      verifyAppJwt({ token, publicKey, issuer, audience, nowSeconds: 2_000, clockSkewSeconds: 0 }),
    ).toThrow(InvalidAppJwtError)
  })
})

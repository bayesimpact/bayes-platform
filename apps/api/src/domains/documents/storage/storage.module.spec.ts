import type { ConfigService } from "@nestjs/config"
import { resolveStorageBackend } from "./storage.module"

const configWith = (settings: Record<string, string>) =>
  ({ get: (key: string) => settings[key] }) as unknown as ConfigService

describe("resolveStorageBackend", () => {
  it("uses STORAGE_BACKEND when it is set", () => {
    expect(resolveStorageBackend(configWith({ STORAGE_BACKEND: "s3" }))).toBe("s3")
    expect(
      resolveStorageBackend(
        configWith({ STORAGE_BACKEND: "local", GCS_STORAGE_BUCKET_NAME: "a-bucket" }),
      ),
    ).toBe("local")
  })

  it("falls back to local", () => {
    expect(resolveStorageBackend(configWith({}))).toBe("local")
  })

  it("rejects a GCS bucket without STORAGE_BACKEND", () => {
    expect(() =>
      resolveStorageBackend(configWith({ GCS_STORAGE_BUCKET_NAME: "a-bucket" })),
    ).toThrow("GCS_STORAGE_BUCKET_NAME is no longer read")
  })

  it("rejects an unknown backend", () => {
    expect(() => resolveStorageBackend(configWith({ STORAGE_BACKEND: "gcs" }))).toThrow(
      "Invalid STORAGE_BACKEND: gcs. Use s3 or local.",
    )
  })
})

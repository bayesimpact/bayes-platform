import { getBullMqConnection } from "./bullmq.config"

describe("getBullMqConnection", () => {
  it("defaults to a plain local Redis", () => {
    expect(getBullMqConnection({})).toEqual({ host: "localhost", port: 6379 })
  })

  it("reads host, port and credentials from the URL", () => {
    expect(getBullMqConnection({ BULLMQ_REDIS_URL: "redis://user:secret@redis:6380" })).toEqual({
      host: "redis",
      port: 6380,
      username: "user",
      password: "secret",
    })
  })

  it("enables TLS with the system store for rediss without a CA", () => {
    expect(getBullMqConnection({ BULLMQ_REDIS_URL: "rediss://:secret@10.0.0.3:6378" })).toEqual({
      host: "10.0.0.3",
      port: 6378,
      password: "secret",
      tls: {},
    })
  })

  it("verifies the server against BULLMQ_REDIS_TLS_CA when set", () => {
    expect(
      getBullMqConnection({ BULLMQ_REDIS_URL: "rediss://10.0.0.3:6378", BULLMQ_REDIS_TLS_CA: "PEM\n" }),
    ).toEqual({ host: "10.0.0.3", port: 6378, tls: { ca: "PEM" } })
  })

  it("ignores the CA without TLS", () => {
    expect(getBullMqConnection({ BULLMQ_REDIS_URL: "redis://redis", BULLMQ_REDIS_TLS_CA: "PEM" })).toEqual(
      { host: "redis", port: 6379 },
    )
  })
})

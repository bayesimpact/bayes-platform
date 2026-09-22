import { HttpException, HttpStatus } from "@nestjs/common"
import { AppTokenRateLimiter } from "./app-token-rate-limiter"

describe("AppTokenRateLimiter", () => {
  it("allows a burst then rejects further attempts in the window", () => {
    const limiter = new AppTokenRateLimiter()
    for (let attempt = 0; attempt < 30; attempt += 1) {
      limiter.consume("127.0.0.1")
    }
    try {
      limiter.consume("127.0.0.1")
      throw new Error("expected rate limit")
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException)
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
    }
  })

  it("tracks keys independently", () => {
    const limiter = new AppTokenRateLimiter()
    for (let attempt = 0; attempt < 30; attempt += 1) {
      limiter.consume("10.0.0.1")
    }
    expect(() => limiter.consume("10.0.0.2")).not.toThrow()
  })
})

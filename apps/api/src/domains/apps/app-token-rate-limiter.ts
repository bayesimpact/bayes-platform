import { HttpException, HttpStatus, Injectable } from "@nestjs/common"

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 30

type WindowState = {
  startedAt: number
  count: number
}

@Injectable()
export class AppTokenRateLimiter {
  private readonly windows = new Map<string, WindowState>()

  consume(key: string): void {
    const now = Date.now()
    const current = this.windows.get(key)
    if (!current || now - current.startedAt >= WINDOW_MS) {
      this.windows.set(key, { startedAt: now, count: 1 })
      return
    }
    current.count += 1
    if (current.count > MAX_ATTEMPTS) {
      throw new HttpException("Too many token requests", HttpStatus.TOO_MANY_REQUESTS)
    }
  }
}

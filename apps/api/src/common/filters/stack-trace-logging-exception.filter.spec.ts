import {
  type ArgumentsHost,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common"
import { StackTraceLoggingExceptionFilter } from "./stack-trace-logging-exception.filter"

function httpHost(method: string, url: string): ArgumentsHost {
  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({ method, url }),
      getResponse: () => ({}),
    }),
  } as unknown as ArgumentsHost
}

describe("StackTraceLoggingExceptionFilter", () => {
  let filter: StackTraceLoggingExceptionFilter
  let warn: jest.SpyInstance
  let error: jest.SpyInstance

  beforeEach(() => {
    filter = new StackTraceLoggingExceptionFilter()
    // The response is built by the base filter; not under test here.
    jest
      .spyOn(Object.getPrototypeOf(StackTraceLoggingExceptionFilter.prototype), "catch")
      .mockImplementation(() => {})
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {})
    error = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {})
  })

  afterEach(() => jest.restoreAllMocks())

  it("logs a client error as a warning, without a stack", () => {
    filter.catch(new NotFoundException("Cannot GET /api/.env"), httpHost("GET", "/api/.env"))
    expect(warn).toHaveBeenCalledWith("Cannot GET /api/.env (GET /api/.env)")
    expect(error).not.toHaveBeenCalled()
  })

  it("logs a server error with its stack", () => {
    const exception = new InternalServerErrorException("boom")
    filter.catch(exception, httpHost("POST", "/api/agents"))
    expect(error).toHaveBeenCalledWith("boom (POST /api/agents)", exception.stack)
    expect(warn).not.toHaveBeenCalled()
  })

  it("logs a non-HTTP error with its stack", () => {
    const exception = new Error("connection lost")
    filter.catch(exception, httpHost("GET", "/api/healthz"))
    expect(error).toHaveBeenCalledWith("connection lost (GET /api/healthz)", exception.stack)
  })

  it("logs a non-Error value as an error", () => {
    filter.catch("oops", httpHost("GET", "/api/x"))
    expect(error).toHaveBeenCalledWith("Non-Error exception thrown: 'oops' (GET /api/x)")
  })
})

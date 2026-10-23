import { APICallError } from "ai"
import {
  CONTEXT_WINDOW_EXCEEDED_MESSAGE,
  isContextWindowExceededError,
  userFacingStreamErrorMessage,
} from "./stream-error-message"

describe("stream-error-message", () => {
  it("replaces a vLLM context length error with a readable message", () => {
    const error = new Error(
      "This model's maximum context length is 131072 tokens. However, you requested 16384 output tokens and your prompt contains at least 114689 input tokens",
    )

    expect(isContextWindowExceededError(error)).toBe(true)
    expect(userFacingStreamErrorMessage(error)).toBe(CONTEXT_WINDOW_EXCEEDED_MESSAGE)
  })

  it("reads the provider wording from the response body of an APICallError", () => {
    const error = new APICallError({
      message: "Bad Request",
      url: "https://llm.example/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 400,
      responseBody: JSON.stringify({
        error: { message: "context_length_exceeded", code: 400 },
      }),
    })

    expect(userFacingStreamErrorMessage(error)).toBe(CONTEXT_WINDOW_EXCEEDED_MESSAGE)
  })

  it("keeps the message of any other error", () => {
    expect(userFacingStreamErrorMessage(new Error("provider down"))).toBe("provider down")
    expect(userFacingStreamErrorMessage("not an error")).toBe("Unknown error occurred")
  })
})

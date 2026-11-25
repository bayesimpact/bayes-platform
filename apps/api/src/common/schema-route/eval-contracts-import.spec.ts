import { EvalAccountRoutes } from "@caseai-connect/eval-contracts"

describe("eval-contracts in the API", () => {
  it("gives a route with its schemas", () => {
    expect(EvalAccountRoutes.getMe.method).toBe("get")
    expect(EvalAccountRoutes.getMe.schemas.response.safeParse({ data: {} }).success).toBe(false)
  })
})

import { DeskAccountRoutes } from "@bayes-platform/desk-contracts"

describe("desk-contracts in the API", () => {
  it("gives a route with its schemas", () => {
    expect(DeskAccountRoutes.getMe.method).toBe("get")
    expect(DeskAccountRoutes.getMe.schemas.response.safeParse({ data: {} }).success).toBe(false)
  })
})

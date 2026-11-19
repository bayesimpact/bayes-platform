import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { conversationDatasetUrlOf } from "@/test/eval-urls"
import { buildConversationDatasetRecord } from "@/test/factories/conversation-datasets.factory"
import { buildEvalWorld } from "@/test/factories/eval-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"
import { required } from "@/test/required"

describe("a conversation dataset", () => {
  it("shows all its records, beyond one page of the API", async () => {
    const world = buildEvalWorld()
    const dataset = required(
      world.conversationDatasets.find((entry) => entry.dataset.name === "Onboarding questions"),
      "the empty dataset",
    )
    // More than the 100 records the API returns at most in one page.
    dataset.records = Array.from({ length: 130 }, (_unused, index) =>
      buildConversationDatasetRecord({ input: `Question ${index + 1}` }),
    )
    server.use(...worldHandlers(world))
    renderApp(conversationDatasetUrlOf(world, "Onboarding questions"))

    expect(await screen.findByText("130 records")).toBeInTheDocument()
    expect(screen.getByText("Question 1")).toBeInTheDocument()
    expect(screen.getByText("Question 130")).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Pages of the table" })).not.toBeInTheDocument()
  })
})

import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { conversationDatasetUrlOf, evaluationsUrlOf } from "@/test/eval-urls"
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

describe("the conversation datasets of a project", () => {
  it("renames a dataset from the list, and says so", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(evaluationsUrlOf(world))

    await userEvent.click(
      await screen.findByRole("button", { name: "More actions on Pricing questions" }),
    )
    await userEvent.click(await screen.findByRole("menuitem", { name: "Rename" }))
    const dialog = await screen.findByRole("dialog")
    const name = within(dialog).getByRole("textbox", { name: "Name" })
    await userEvent.clear(name)
    await userEvent.type(name, "Billing questions")
    await userEvent.click(within(dialog).getByRole("button", { name: "Rename" }))

    expect(await screen.findByText("The dataset was renamed.")).toBeInTheDocument()
    // In the table, and in the sidebar's menu.
    expect(await screen.findAllByRole("link", { name: "Billing questions" })).not.toHaveLength(0)
    expect(world.conversationDatasets.map((entry) => entry.dataset.name)).toContain(
      "Billing questions",
    )
  })

  it("deletes a dataset after a confirmation", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(evaluationsUrlOf(world))

    await userEvent.click(
      await screen.findByRole("button", { name: "More actions on Onboarding questions" }),
    )
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete Onboarding questions?",
    })
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("The dataset was deleted.")).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryAllByRole("link", { name: "Onboarding questions" })).toHaveLength(0),
    )
    expect(world.conversationDatasets.map((entry) => entry.dataset.name)).not.toContain(
      "Onboarding questions",
    )
  })
})

describe("the records of a conversation dataset", () => {
  it("changes a record, and says so", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(conversationDatasetUrlOf(world, "Pricing questions"))

    const [firstActions] = await screen.findAllByRole("button", {
      name: "More actions on the record",
    })
    await userEvent.click(required(firstActions, "the actions of the first record"))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }))
    const dialog = await screen.findByRole("dialog", { name: "Edit the record" })
    const input = within(dialog).getByRole("textbox", { name: "Input" })
    await userEvent.clear(input)
    await userEvent.type(input, "Which plan fits a team of ten?")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))

    expect(await screen.findByText("The record was saved.")).toBeInTheDocument()
    expect(await screen.findByText("Which plan fits a team of ten?")).toBeInTheDocument()
  })

  it("deletes a record after a confirmation", async () => {
    const world = buildEvalWorld()
    const dataset = required(
      world.conversationDatasets.find((entry) => entry.dataset.name === "Pricing questions"),
      "the dataset",
    )
    const recordCount = dataset.records.length
    server.use(...worldHandlers(world))
    renderApp(conversationDatasetUrlOf(world, "Pricing questions"))

    const [firstActions] = await screen.findAllByRole("button", {
      name: "More actions on the record",
    })
    await userEvent.click(required(firstActions, "the actions of the first record"))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this record?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(await screen.findByText("The record was deleted.")).toBeInTheDocument()
    expect(dataset.records).toHaveLength(recordCount - 1)
  })
})

import { composeStories, setProjectAnnotations } from "@storybook/react-vite"
import { render, screen, within } from "@testing-library/react"
import { userEvent } from "storybook/test"
import { describe, expect, it } from "vitest"
import previewAnnotations from "../../.storybook/preview"
import * as extractionEvaluationStories from "./ExtractionEvaluations.stories"

setProjectAnnotations(previewAnnotations)

const { NewDataset, ChooseColumns, RunEvaluation, ...pageStories } = composeStories(
  extractionEvaluationStories,
)

/** Each story of a page, and what it shows once that page loaded: every story is listed. */
const PAGES = {
  DatasetList: {
    Story: pageStories.DatasetList,
    loaded: () => screen.findByRole("link", { name: "Open Support messages" }),
  },
  NoDataset: {
    Story: pageStories.NoDataset,
    loaded: () => screen.findByText("No dataset yet"),
  },
  ChooseFile: {
    Story: pageStories.ChooseFile,
    loaded: () => screen.findByRole("button", { name: "Use the file product-feedback.csv" }),
  },
  Dataset: {
    Story: pageStories.Dataset,
    // Its records, with the columns it keeps: the one it ignores is left out.
    loaded: async () => {
      await screen.findByText("8 records")
      expect(screen.queryByRole("columnheader", { name: /internal_note/ })).not.toBeInTheDocument()
      return screen.findByText("Search fails on accented words")
    },
  },
  DatasetRuns: {
    Story: pageStories.DatasetRuns,
    loaded: async () => {
      await screen.findByText("4 runs")
      return screen.findByRole("columnheader", { name: "Match rate" })
    },
  },
  CompletedRun: {
    Story: pageStories.CompletedRun,
    // Its figures: five records of eight match on both compared fields.
    loaded: async () => {
      await screen.findByText("Took 2 min 5 sec")
      await screen.findByText("63%")
      return screen.findByText("5 / 8")
    },
  },
  RunUnderWay: {
    Story: pageStories.RunUnderWay,
    loaded: () => screen.findByRole("button", { name: "Cancel the run" }),
  },
  FailedRun: {
    Story: pageStories.FailedRun,
    loaded: () => screen.findByText("This run failed before it asked a record."),
  },
  CompareRuns: {
    Story: pageStories.CompareRuns,
    loaded: () => screen.findByRole("heading", { name: "Record by record" }),
  },
} satisfies Record<keyof typeof pageStories, unknown>

/** The pages the app shows when something went wrong. */
const ERROR_PAGES = ["This page could not load", "Page not found"]

describe("the stories of the extraction evaluations", () => {
  it.each(Object.entries(PAGES))("%s opens its page", async (_name, { Story, loaded }) => {
    await Story.load()
    render(<Story />)

    expect(await loaded()).toBeInTheDocument()
    for (const title of ERROR_PAGES) expect(screen.queryByText(title)).not.toBeInTheDocument()
  })

  it("NewDataset asks the name of the dataset, and says its records come from a file", async () => {
    await NewDataset.load()
    render(<NewDataset />)

    const dialog = await screen.findByRole("dialog", { name: "New dataset" })
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toBeInTheDocument()
    expect(within(dialog).getByText(/Its records come from a CSV file/)).toBeInTheDocument()
  })

  it("ChooseColumns gives the columns of the file their roles, then builds the dataset", async () => {
    await ChooseColumns.load()
    render(<ChooseColumns />)
    await userEvent.click(
      await screen.findByRole("button", { name: "Use the file support-messages.csv" }),
    )

    // Each column starts left out.
    const messageRole = await screen.findByRole("combobox", { name: "Role of the column message" })
    expect(messageRole).toHaveValue("ignore")
    await userEvent.selectOptions(messageRole, "input")

    // Two columns checked take a role at once.
    await userEvent.click(screen.getByRole("checkbox", { name: "Select the column title" }))
    await userEvent.click(screen.getByRole("checkbox", { name: "Select the column category" }))
    expect(screen.getByText("2 columns selected")).toBeInTheDocument()
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Role of the selected columns" }),
      "target",
    )
    expect(screen.getByRole("combobox", { name: "Role of the column title" })).toHaveValue("target")
    expect(screen.getByRole("combobox", { name: "Role of the column category" })).toHaveValue(
      "target",
    )

    // Built, the dataset shows its records, with the columns that have a role.
    await userEvent.click(screen.getByRole("button", { name: "Build the dataset" }))
    expect(await screen.findByText("8 records")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /category/ })).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: /source/ })).not.toBeInTheDocument()
  })

  it("Dataset narrows its records with a search", async () => {
    const { Dataset } = pageStories
    await Dataset.load()
    render(<Dataset />)

    await userEvent.type(
      await screen.findByRole("searchbox", { name: "Search the records" }),
      "invoice",
    )
    expect(await screen.findByText("Invoice with a company address")).toBeInTheDocument()
    expect(screen.queryByText("Search fails on accented words")).not.toBeInTheDocument()
  })

  it("RunEvaluation pairs the agent's fields with the target columns, then opens the run", async () => {
    await RunEvaluation.load()
    render(<RunEvaluation />)

    expect(await screen.findByRole("heading", { name: "Run an evaluation" })).toBeInTheDocument()
    // A field takes the target column of its name; one with no such column waits for a choice.
    expect(
      screen.getByRole("combobox", { name: "Column the field title is compared with" }),
    ).toHaveDisplayValue("title")
    expect(
      screen.getByRole("combobox", { name: "Column the field summary is compared with" }),
    ).toHaveValue("")

    // A compared field with no column stops the run.
    await userEvent.click(screen.getByRole("button", { name: "Run" }))
    expect(
      await screen.findByText("Give each compared field a column, or only show it."),
    ).toBeInTheDocument()

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "How the run reads the field summary" }),
      "fyi",
    )
    await userEvent.click(screen.getByRole("button", { name: "Run" }))
    expect(await screen.findByRole("button", { name: "Cancel the run" })).toBeInTheDocument()
  })

  it("DatasetRuns compares the runs a person checks", async () => {
    const { DatasetRuns } = pageStories
    await DatasetRuns.load()
    render(<DatasetRuns />)

    // Two runs are over: their sub-tab lists them.
    await userEvent.click(await screen.findByRole("tab", { name: "Completed (2)" }))
    expect(screen.getByRole("button", { name: "Compare runs" })).toBeDisabled()
    const boxes = await screen.findAllByRole("checkbox", { name: /^Compare the run of/ })
    for (const box of boxes) await userEvent.click(box)

    await userEvent.click(await screen.findByRole("link", { name: "Compare 2 runs" }))
    expect(await screen.findByRole("heading", { name: "Compare runs" })).toBeInTheDocument()
    // The record the earlier run got wrong on both fields.
    expect(await screen.findByText("0 / 2 fields")).toBeInTheDocument()
  })

  it("CompletedRun narrows its results to the mismatches, and opens one whole in a sheet", async () => {
    const { CompletedRun } = pageStories
    await CompletedRun.load()
    render(<CompletedRun />)

    const filters = await screen.findByRole("group", { name: "Filter the results" })
    await userEvent.click(within(filters).getByRole("button", { name: "Mismatches (2)" }))
    expect(screen.queryByText("Charged twice for the Pro plan")).not.toBeInTheDocument()
    // Under a value that differs, the value expected.
    expect(screen.getByText("Expected: Product")).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", { name: /^Open the result of: The export button/ }),
    )
    const sheet = await screen.findByRole("dialog", { name: "Result" })
    expect(within(sheet).getByText("Expected (category)")).toBeInTheDocument()
    expect(within(sheet).getByText("Not compared")).toBeInTheDocument()
  })

  it("CompletedRun says what the run used, in two tabs of its side panel", async () => {
    const { CompletedRun } = pageStories
    await CompletedRun.load()
    render(<CompletedRun />)

    // The window of the tests is narrow: the panel starts closed.
    const toggle = await screen.findByRole("button", { name: "Agent and fields" })
    if (toggle.getAttribute("aria-pressed") !== "true") await userEvent.click(toggle)
    const panel = await screen.findByRole("complementary", { name: "Agent and fields" })
    expect(within(panel).getByText("Document Reader")).toBeInTheDocument()

    await userEvent.click(within(panel).getByRole("tab", { name: "Fields" }))
    expect(await within(panel).findByText("Compared with category")).toBeInTheDocument()
    expect(within(panel).getByText("Only shown")).toBeInTheDocument()
  })
})

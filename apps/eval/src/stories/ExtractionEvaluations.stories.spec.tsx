import { composeStories, setProjectAnnotations } from "@storybook/react-vite"
import { render, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "storybook/test"
import { describe, expect, it } from "vitest"
import previewAnnotations from "../../.storybook/preview"
import * as extractionEvaluationStories from "./ExtractionEvaluations.stories"

setProjectAnnotations(previewAnnotations)

const { NewDataset, ChooseColumns, FileWithoutDataRows, RunEvaluation, ...pageStories } =
  composeStories(extractionEvaluationStories)

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
    // Its records, with every column of the dataset and its role, the ignored one too.
    loaded: async () => {
      await screen.findByText("8 records")
      await screen.findByRole("columnheader", { name: /internal_note/ })
      return screen.findByText("Search fails on accented words")
    },
  },
  LargeDataset: {
    Story: pageStories.LargeDataset,
    // The first page of its records, of the three the API holds.
    loaded: () => screen.findByText("Rows 1–50 of 120"),
  },
  LargeRun: {
    Story: pageStories.LargeRun,
    loaded: () => screen.findByText("Rows 1–50 of 120"),
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
  ResultsFailToLoad: {
    Story: pageStories.ResultsFailToLoad,
    // The table says its results could not load, with the way to read them again.
    loaded: async () => {
      await screen.findByText("The results could not load.")
      return screen.findByRole("button", { name: "Try again" })
    },
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
    expect(screen.getByRole("columnheader", { name: /category.*Target/ })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /source.*Ignore/ })).toBeInTheDocument()
  })

  it("FileWithoutDataRows says that the file has no data row, and leads back to the files", async () => {
    await FileWithoutDataRows.load()
    render(<FileWithoutDataRows />)
    await userEvent.click(
      await screen.findByRole("button", { name: "Use the file messages-template.csv" }),
    )

    // No form to fill in for a file that builds nothing.
    expect(
      await screen.findByText("This file has no data row. Choose another file."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Build the dataset" })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Choose another file" }))
    expect(
      await screen.findByRole("button", { name: "Use the file support-messages.csv" }),
    ).toBeInTheDocument()
  })

  it("LargeDataset pages, searches and sorts its records through the API", async () => {
    const { LargeDataset } = pageStories
    await LargeDataset.load()
    render(<LargeDataset />)

    // A page at a time: the next one holds the records after the fiftieth.
    expect(await screen.findByText("Rows 1–50 of 120")).toBeInTheDocument()
    expect(screen.queryByText(/^#51 /)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Next page" }))
    expect(await screen.findByText("Rows 51–100 of 120")).toBeInTheDocument()
    expect(screen.getByText(/^#51 /)).toBeInTheDocument()

    // A filter looks for a text in one column, in the whole dataset, and goes back to page one.
    const column = screen.getByRole("combobox", { name: "Column to filter" })
    const text = screen.getByRole("searchbox", { name: "Text the column holds" })
    await userEvent.selectOptions(column, "title")
    await userEvent.type(text, "invoice")
    await userEvent.click(screen.getByRole("button", { name: "Filter" }))
    expect(await screen.findByText("15 records pass the filters")).toBeInTheDocument()
    expect(screen.getByText(/^#6 /)).toBeInTheDocument()
    expect(screen.queryByText(/^#51 /)).not.toBeInTheDocument()

    // A second filter, on another column, adds to the first; each one goes away on its own.
    await userEvent.selectOptions(column, "source")
    await userEvent.type(text, "chat")
    await userEvent.click(screen.getByRole("button", { name: "Filter" }))
    expect(await screen.findByText("No record passes the filters")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Remove the filter on source" }))
    expect(await screen.findByText("15 records pass the filters")).toBeInTheDocument()

    // A row opens its record whole, with each of its values.
    await userEvent.click(screen.getByRole("button", { name: "Open the record of row 1" }))
    const sheet = await screen.findByRole("dialog", { name: "Record" })
    expect(within(sheet).getByText("Invoice with a company address")).toBeInTheDocument()
    await userEvent.keyboard("{Escape}")

    // A header sorts by its column: the API gives the order.
    await userEvent.click(screen.getByRole("button", { name: /^message/ }))
    await waitFor(() =>
      expect(screen.getByRole("columnheader", { name: /^message/ })).toHaveAttribute(
        "aria-sort",
        "ascending",
      ),
    )
  })

  it("ChooseFile refuses a file that is not a CSV, uploads one that is, and deletes files together", async () => {
    const { ChooseFile } = pageStories
    await ChooseFile.load()
    render(<ChooseFile />)

    const input = await screen.findByLabelText("CSV file to upload")
    await userEvent.upload(input, new File(["x"], "notes.pdf", { type: "application/pdf" }), {
      applyAccept: false,
    })
    expect(await screen.findByText("notes.pdf is not a CSV file.")).toBeInTheDocument()

    await userEvent.upload(input, new File(["a,b\n1,2"], "new-rows.csv", { type: "text/csv" }))
    expect(await screen.findByText("new-rows.csv was uploaded.")).toBeInTheDocument()
    // The person stays on the list, where the new file shows.
    expect(
      await screen.findByRole("button", { name: "Use the file new-rows.csv" }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole("checkbox", { name: "Select all the files" }))
    expect(screen.getByText("3 files selected")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Delete 3 files?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))
    expect(await screen.findByText(/The project has no CSV file yet/)).toBeInTheDocument()
  })

  it("Dataset opens the form that starts a run beside its records, and closes it", async () => {
    const { Dataset } = pageStories
    await Dataset.load()
    render(<Dataset />)

    await userEvent.click(await screen.findByRole("link", { name: "Run evaluation" }))
    const panel = await screen.findByRole("complementary", { name: "Run an evaluation" })
    expect(within(panel).getByRole("button", { name: "Run" })).toBeInTheDocument()
    // The dataset stays in view beside the form.
    expect(screen.getByText("8 records")).toBeInTheDocument()
    // The button that opened the form is now gray, as the toggle of a side panel.
    expect(screen.getByRole("link", { name: "Run evaluation" })).toHaveClass("bg-secondary")

    await userEvent.click(within(panel).getByRole("button", { name: "Cancel" }))
    await waitFor(() =>
      expect(
        screen.queryByRole("complementary", { name: "Run an evaluation" }),
      ).not.toBeInTheDocument(),
    )
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
    // A run that is over offers its results as a CSV file, beside the filters.
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeInTheDocument()
    await userEvent.click(within(filters).getByRole("button", { name: "Mismatches (2)" }))
    // The API keeps the mismatches only.
    await waitFor(() =>
      expect(screen.queryByText("Charged twice for the Pro plan")).not.toBeInTheDocument(),
    )
    // Beside what the agent returned, the value expected, in a column of its own.
    expect(screen.getByRole("columnheader", { name: /category.*target/ })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /category.*agent/ })).toBeInTheDocument()

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

    // The agent's settings: which documents it searches, and what it returns.
    expect(within(panel).getByText("All the documents")).toBeInTheDocument()
    expect(within(panel).getByText("Output schema")).toBeInTheDocument()
    expect(within(panel).getByRole("link", { name: /Open in Studio/ })).toBeInTheDocument()

    await userEvent.click(within(panel).getByRole("tab", { name: "Fields" }))
    expect(await within(panel).findByText("Compared with category")).toBeInTheDocument()
    expect(within(panel).getByText("Only shown")).toBeInTheDocument()
  })
})

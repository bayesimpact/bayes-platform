/**
 * The roots of the query keys of the runs, for each type of agent. The runs' features build their
 * keys on them, and the datasets' features invalidate them: the API deletes a dataset's runs with
 * the dataset.
 */
export const CONVERSATION_RUNS_QUERY_KEY = ["conversation-runs"] as const
export const EXTRACTION_RUNS_QUERY_KEY = ["extraction-runs"] as const

import {
  AgentModel,
  agentTypeSchema,
  duplicateAgentSchema,
  EVALUATION_CONVERSATION_DATASET_NAME_MIN_LENGTH,
  EVALUATION_CONVERSATION_DATASET_RECORD_MAX_LENGTH,
  EVALUATION_CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH,
  outputJsonSchemaSchema,
} from "@caseai-connect/api-contracts"
import { type CallToolResult, McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { getMcpServerTitle } from "@/config/mcp-server-title"
import { AGENT_DEFAULT_MODELS } from "@/domains/agents/settings/agent-models.service"
import type { McpAgentToolsService, McpCaller, McpResult } from "./mcp-agent-tools.service"
import type { McpEvaluationToolsService } from "./mcp-evaluation-tools.service"

export const MCP_SERVER_NAME = "agents"
export const MCP_SERVER_VERSION = "1.2.0"

const MCP_SERVER_INSTRUCTIONS = [
  "Creates, updates, duplicates and evaluates agents on the platform for the signed-in user.",
  "Call list_projects first: an agent always belongs to a project. It lists the projects the user granted to this client, and only the ones with canCreateAgents set to true accept new agents.",
  "Then call create_agent with that project's id. It returns the agent's id and, when the platform knows its public URL, a link to the agent in the studio.",
  "To change an existing agent, call list_agents with the project's id, then update_agent with the agent's id: only the agents with canUpdate set to true can be changed. update_agent edits the draft; the user publishes it in the studio.",
  "To start a variant of an existing agent, call duplicate_agent with the agent's id from list_agents and a new name: only the agents with canDuplicate set to true can be copied. The copy is a new agent of the same project whose settings are a draft (published is false): nothing uses it until the user publishes it in the studio.",
  "Call get_agent before changing an agent: it returns the instructions of its published version and of its draft, and its versions.",
  'To evaluate a conversation agent, put questions and expected answers in a dataset (list_evaluation_datasets, create_evaluation_dataset, add_dataset_records), then call run_evaluation. A run can evaluate the draft (agentRevision: "draft"), so the user can compare versions before publishing one in the studio.',
  "A run is asynchronous: call get_evaluation_run until its status is completed, failed or cancelled, then read each answer and its score with list_evaluation_run_records. Read the answers, not only the average score: a low score says that an answer is wrong, the answer says why.",
].join(" ")

// Tool outputs are loose objects: their JSON Schema allows properties they do not list, so a
// client that listed the tools before a release that adds a field still accepts the answers.
const projectSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  canCreateAgents: z.boolean(),
})

const createAgentInputSchema = z.object({
  projectId: z.uuid().describe("Id of the project the agent belongs to, from list_projects."),
  name: z.string().trim().min(3).describe("Name of the agent, at least 3 characters."),
  type: agentTypeSchema
    .default("conversation")
    .describe(
      "conversation: the agent chats with users. extraction: the agent reads a document and returns JSON that follows outputJsonSchema.",
    ),
  instructions: z
    .string()
    .min(1)
    .describe("System prompt: what the agent does, its tone and the rules it follows."),
  model: z
    .enum(AgentModel)
    .default(AGENT_DEFAULT_MODELS.agent)
    .describe("Language model of the agent."),
  greetingMessage: z
    .string()
    .max(2000)
    .optional()
    .describe("First message shown to users of a conversation agent."),
  outputJsonSchema: outputJsonSchemaSchema
    .optional()
    .describe("JSON Schema of the result. Required for an extraction agent."),
})

const createdAgentSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: agentTypeSchema,
  projectId: z.string(),
  organizationId: z.string(),
  studioUrl: z.string().nullable(),
})

const agentSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: agentTypeSchema,
  model: z.string(),
  published: z.boolean(),
  canUpdate: z.boolean(),
  canDuplicate: z.boolean(),
  studioUrl: z.string().nullable(),
})

const updateAgentInputSchema = z.object({
  agentId: z.uuid().describe("Id of the agent, from list_agents or create_agent."),
  model: z.enum(AgentModel).optional().describe("New language model of the agent."),
  instructions: z.string().min(1).optional().describe("New system prompt of the agent."),
  greetingMessage: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .describe("New first message of a conversation agent, or null to remove it."),
})

const duplicateAgentInputSchema = z.object({
  agentId: z.uuid().describe("Id of the agent to copy, from list_agents."),
  name: duplicateAgentSchema.shape.name.describe(
    "Name of the copy, at least 3 characters, for example the original's name with a suffix.",
  ),
})

const agentVersionSchema = z.looseObject({
  revision: z.number(),
  model: z.string(),
  instructions: z.string(),
  greetingMessage: z.string().nullable(),
})

const agentDetailsSchema = agentSchema.extend({
  publishedVersion: agentVersionSchema.nullable(),
  draft: agentVersionSchema.nullable(),
  revisions: z.array(
    z.looseObject({
      revision: z.number(),
      isDraft: z.boolean(),
      name: z.string().nullable(),
      updatedAt: z.string(),
    }),
  ),
})

const datasetSchema = z.looseObject({ id: z.string(), name: z.string(), recordCount: z.number() })

const datasetRecordSchema = z.looseObject({
  id: z.string(),
  input: z.string(),
  expectedOutput: z.string(),
})

const runSchema = z.looseObject({
  id: z.string(),
  status: z.string(),
  agentId: z.string(),
  agentRevision: z.number(),
  agentRevisionIsDraft: z.boolean(),
  datasetId: z.string(),
  judgeModel: z.string(),
  judgeInstructions: z.string().nullable(),
  summary: z
    .looseObject({
      averageScore: z.number().nullable(),
      errors: z.number(),
      graded: z.number(),
      running: z.number(),
      total: z.number(),
    })
    .nullable(),
  createdAt: z.string(),
  evalUrl: z.string().nullable(),
})

const runRecordSchema = z.looseObject({
  id: z.string(),
  status: z.string(),
  input: z.string(),
  expectedOutput: z.string(),
  output: z.string().nullable(),
  score: z.number().nullable(),
  errorDetails: z.string().nullable(),
})

const pageSchema = <Item extends z.ZodType>(item: Item) =>
  z.looseObject({ items: z.array(item), total: z.number(), page: z.number(), limit: z.number() })

const projectIdInput = z.uuid().describe("Id of the project, from list_projects.")

const pageInput = {
  page: z.number().int().min(0).default(0).describe("Page to read, from 0."),
  limit: z.number().int().min(1).max(100).default(50).describe("Items per page, 100 at most."),
}

const recordInput = z.object({
  input: z
    .string()
    .trim()
    .min(1)
    .max(EVALUATION_CONVERSATION_DATASET_RECORD_MAX_LENGTH)
    .describe(
      `The user's message sent to the agent, ${EVALUATION_CONVERSATION_DATASET_RECORD_MAX_LENGTH} characters at most.`,
    ),
  expectedOutput: z
    .string()
    .trim()
    .min(1)
    .max(EVALUATION_CONVERSATION_DATASET_RECORD_MAX_LENGTH)
    .describe(
      `The reference answer the judge compares the agent's answer with, ${EVALUATION_CONVERSATION_DATASET_RECORD_MAX_LENGTH} characters at most.`,
    ),
})

const runEvaluationInputSchema = z.object({
  projectId: projectIdInput,
  agentId: z.uuid().describe("Id of a conversation agent of the project, from list_agents."),
  datasetId: z.uuid().describe("Id of a dataset of the project, from list_evaluation_datasets."),
  agentRevision: z
    .union([z.number().int().positive(), z.literal("draft")])
    .optional()
    .describe(
      'Version of the agent to evaluate: a revision number from get_agent, or "draft" for its draft. The latest published version when left out.',
    ),
  judgeModel: z
    .enum(AgentModel)
    .default(AGENT_DEFAULT_MODELS.judge)
    .describe("Language model that scores each answer against the expected one."),
  judgeInstructions: z
    .string()
    .trim()
    .max(EVALUATION_CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH)
    .optional()
    .describe("Extra grading rules for the judge, such as what to penalize."),
})

/**
 * One MCP server per request, bound to the person and their grant: the
 * endpoint is stateless, so nothing outlives the HTTP exchange.
 */
export function buildAgentCreationMcpServer({
  caller,
  toolsService,
  evaluationToolsService,
}: {
  caller: McpCaller
  toolsService: McpAgentToolsService
  evaluationToolsService: McpEvaluationToolsService
}): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, title: getMcpServerTitle(), version: MCP_SERVER_VERSION },
    { instructions: MCP_SERVER_INSTRUCTIONS },
  )

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "Lists the projects the user granted to this client, with their organization and whether agents can be created in them.",
      outputSchema: z.looseObject({ projects: z.array(projectSchema) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const projects = await toolsService.listProjects(caller)
      return structuredResult({ projects })
    },
  )

  server.registerTool(
    "create_agent",
    {
      title: "Create agent",
      description:
        "Creates an agent in a project and publishes its first version. Documents, tags and other settings are edited afterwards in the studio.",
      inputSchema: createAgentInputSchema,
      outputSchema: z.looseObject({ agent: createdAgentSchema }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await toolsService.createAgent(caller, input)
      if (!result.ok) {
        return { isError: true, content: [{ type: "text", text: result.error }] }
      }
      return structuredResult({ agent: result.agent })
    },
  )

  server.registerTool(
    "list_agents",
    {
      title: "List agents",
      description:
        "Lists the agents of a project the user is a member of, with their model, whether they are published, and whether update_agent can change them and duplicate_agent can copy them.",
      inputSchema: z.object({
        projectId: z.uuid().describe("Id of the project, from list_projects."),
      }),
      outputSchema: z.looseObject({ agents: z.array(agentSchema) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => {
      const result = await toolsService.listAgents(caller, projectId)
      if (!result.ok) {
        return { isError: true, content: [{ type: "text", text: result.error }] }
      }
      return structuredResult({ agents: result.value })
    },
  )

  server.registerTool(
    "update_agent",
    {
      title: "Update agent",
      description:
        "Changes the draft settings of an agent (model, instructions, greeting). Only the given settings change. Nothing is published: the user reviews and publishes the draft in the studio, from the returned link.",
      inputSchema: updateAgentInputSchema,
      outputSchema: z.looseObject({ agent: agentSchema.extend({ draftRevision: z.number() }) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await toolsService.updateAgent(caller, input)
      if (!result.ok) {
        return { isError: true, content: [{ type: "text", text: result.error }] }
      }
      return structuredResult({ agent: result.value })
    },
  )

  server.registerTool(
    "duplicate_agent",
    {
      title: "Duplicate agent",
      description:
        "Copies an agent into a new agent of the same project, under a new name: its published settings (model, instructions, greeting, built-in tools), its MCP servers, its sub-agents, its documents and resource libraries, and its conversation categories. Conversations, analytics, members and the embed settings are not copied. The copy's settings are a draft: nothing is published, the user reviews and publishes it in the studio, from the returned link.",
      inputSchema: duplicateAgentInputSchema,
      outputSchema: z.looseObject({ agent: agentSchema.extend({ draftRevision: z.number() }) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await toolsService.duplicateAgent(caller, input)
      if (!result.ok) {
        return { isError: true, content: [{ type: "text", text: result.error }] }
      }
      return structuredResult({ agent: result.value })
    },
  )

  server.registerTool(
    "get_agent",
    {
      title: "Get agent",
      description:
        "Returns an agent with the settings (model, instructions, greeting) of its published version, of its draft when the user can see drafts, and the list of its versions. Read it before update_agent or run_evaluation.",
      inputSchema: z.object({
        agentId: z.uuid().describe("Id of the agent, from list_agents."),
      }),
      outputSchema: z.looseObject({ agent: agentDetailsSchema }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ agentId }) =>
      toolResult(await toolsService.getAgent(caller, agentId), (agent) => ({ agent })),
  )

  server.registerTool(
    "list_evaluation_datasets",
    {
      title: "List evaluation datasets",
      description:
        "Lists the conversation evaluation datasets of a project, with their number of records (questions and expected answers).",
      inputSchema: z.object({ projectId: projectIdInput }),
      outputSchema: z.looseObject({ datasets: z.array(datasetSchema) }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) =>
      toolResult(await evaluationToolsService.listDatasets(caller, projectId), (datasets) => ({
        datasets,
      })),
  )

  server.registerTool(
    "create_evaluation_dataset",
    {
      title: "Create evaluation dataset",
      description:
        "Creates an empty conversation evaluation dataset in a project. Fill it with add_dataset_records.",
      inputSchema: z.object({
        projectId: projectIdInput,
        name: z
          .string()
          .trim()
          .min(EVALUATION_CONVERSATION_DATASET_NAME_MIN_LENGTH)
          .describe(
            `Name of the dataset, at least ${EVALUATION_CONVERSATION_DATASET_NAME_MIN_LENGTH} characters.`,
          ),
      }),
      outputSchema: z.looseObject({ dataset: datasetSchema }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) =>
      toolResult(await evaluationToolsService.createDataset(caller, input), (dataset) => ({
        dataset,
      })),
  )

  server.registerTool(
    "add_dataset_records",
    {
      title: "Add dataset records",
      description:
        "Adds records to a conversation evaluation dataset: each one is a user message and the answer expected from the agent. Existing records do not change.",
      inputSchema: z.object({
        projectId: projectIdInput,
        datasetId: z.uuid().describe("Id of the dataset, from list_evaluation_datasets."),
        records: z.array(recordInput).min(1).max(100).describe("Records to add, 100 at most."),
      }),
      outputSchema: z.looseObject({ dataset: datasetSchema }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) =>
      toolResult(await evaluationToolsService.addDatasetRecords(caller, input), (dataset) => ({
        dataset,
      })),
  )

  server.registerTool(
    "list_dataset_records",
    {
      title: "List dataset records",
      description:
        "Lists the records of a conversation evaluation dataset, page by page: each user message and its expected answer.",
      inputSchema: z.object({
        projectId: projectIdInput,
        datasetId: z.uuid().describe("Id of the dataset, from list_evaluation_datasets."),
        ...pageInput,
      }),
      outputSchema: pageSchema(datasetRecordSchema),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) =>
      toolResult(await evaluationToolsService.listDatasetRecords(caller, input), (page) => page),
  )

  server.registerTool(
    "run_evaluation",
    {
      title: "Run evaluation",
      description:
        "Evaluates a conversation agent on a dataset: the agent answers each record, then a judge model scores each answer from 1 to 5 against the expected one. The run starts at once and finishes in the background: follow it with get_evaluation_run. It calls language models for every record. Nothing is published.",
      inputSchema: runEvaluationInputSchema,
      outputSchema: z.looseObject({ run: runSchema }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) =>
      toolResult(
        await evaluationToolsService.runEvaluation(caller, {
          ...input,
          judgeInstructions: input.judgeInstructions || null,
        }),
        (run) => ({ run }),
      ),
  )

  server.registerTool(
    "list_evaluation_runs",
    {
      title: "List evaluation runs",
      description:
        "Lists the conversation evaluation runs of a project, newest first, page by page, with their status, the agent version they evaluated and their average score.",
      inputSchema: z.object({
        projectId: projectIdInput,
        agentId: z.uuid().optional().describe("Only the runs of this agent."),
        ...pageInput,
      }),
      outputSchema: pageSchema(runSchema),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) =>
      toolResult(await evaluationToolsService.listRuns(caller, input), (page) => page),
  )

  server.registerTool(
    "get_evaluation_run",
    {
      title: "Get evaluation run",
      description:
        "Returns an evaluation run with its status (pending, running, completed, failed or cancelled) and its summary: records graded, errors and average score from 1 to 5.",
      inputSchema: z.object({
        projectId: projectIdInput,
        runId: z.uuid().describe("Id of the run, from run_evaluation or list_evaluation_runs."),
      }),
      outputSchema: z.looseObject({ run: runSchema }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) =>
      toolResult(await evaluationToolsService.getRun(caller, input), (run) => ({ run })),
  )

  server.registerTool(
    "list_evaluation_run_records",
    {
      title: "List evaluation run records",
      description:
        "Lists the records of an evaluation run: each user message, the expected answer, the agent's answer and its score from 1 to 5, or the error that stopped it.",
      inputSchema: z.object({
        projectId: projectIdInput,
        runId: z.uuid().describe("Id of the run, from run_evaluation or list_evaluation_runs."),
        ...pageInput,
      }),
      outputSchema: pageSchema(runRecordSchema),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) =>
      toolResult(await evaluationToolsService.listRunRecords(caller, input), (page) => page),
  )

  return server
}

function toolResult<Value, Output extends Record<string, unknown>>(
  result: McpResult<Value>,
  toOutput: (value: Value) => Output,
): CallToolResult {
  if (!result.ok) return { isError: true, content: [{ type: "text", text: result.error }] }
  return structuredResult(toOutput(result.value))
}

function structuredResult<T extends Record<string, unknown>>(output: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output) }],
    structuredContent: output,
  }
}

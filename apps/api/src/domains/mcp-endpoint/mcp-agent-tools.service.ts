import {
  type AgentType,
  type CreateAgentDto,
  createAgentSchema,
  DocumentsRagMode,
  type PartialUpdateAgentSettingsDto,
  partialUpdateAgentSettingsSchema,
} from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ActivitiesService } from "@/domains/activities/activities.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentRepository } from "@/domains/agents/agent.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentsService } from "@/domains/agents/agents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  AGENT_CREATE_PERMISSION,
  AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION,
  PROJECT_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"

export type ProjectWithAccess = {
  project: { id: string; name: string; organizationId: string; organizationName: string }
  canCreateAgents: boolean
}

export type McpCreateAgentInput = Omit<
  CreateAgentDto,
  "documentsRagMode" | "tagsToAdd" | "projectAgentSessionCategoryIds" | "resourceLibraryIds"
> & { projectId: string }

/** The fields of an agent the MCP tools return, without importing the agents domain's entity. */
export type AgentRecord = {
  id: string
  name: string
  type: AgentType
  organizationId: string
  projectId: string
}

/** The fields of an agent's settings revision the MCP tools return. */
export type AgentSettingsRecord = { model: string; revision: number }

export type AgentWithSettings = {
  agent: AgentRecord
  agentSettings: AgentSettingsRecord
  canUpdate: boolean
}

export type McpAgentSettingsFields = Pick<
  PartialUpdateAgentSettingsDto,
  "instructions" | "model" | "temperature" | "locale" | "greetingMessage"
>

/** The agent and the draft its settings went into: the published version does not change. */
export type UpdatedAgentSettings = {
  agent: AgentRecord
  agentSettings: AgentSettingsRecord
}

export type McpResult<Value> = { ok: true; value: Value } | { ok: false; error: string }

/**
 * Who calls a tool: the person, and what they granted the client (ADR 0028).
 * A right needs both: the person holds it now, and granted it on the project.
 */
export type McpCaller = {
  userId: string
  projectIds: string[]
  permissions: string[]
}

/** Same answer for a missing agent, one outside the grant and one the caller cannot change. */
export const AGENT_NOT_FOUND_ERROR =
  "Agent not found, or you are not allowed to change it. Call list_agents to see the agents you can use."

/** Same answer for a missing project, one outside the grant and one the caller cannot create agents in. */
export const PROJECT_NOT_FOUND_ERROR =
  "Project not found, or you are not allowed to create agents in it. Call list_projects to see the projects you can use."

/**
 * What the platform MCP endpoint does on behalf of a person. The checks are
 * the ones the HTTP routes run (`project.read` to list, `agent.create` on the
 * project to create), restricted to the projects and permissions of the
 * grant, so an MCP client never reaches more than the person allowed.
 */
@Injectable()
export class McpAgentToolsService {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly projectRepository: ProjectRepository,
    private readonly agentsService: AgentsService,
    private readonly agentRepository: AgentRepository,
    private readonly agentSettingsService: AgentSettingsService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async listProjects(caller: McpCaller): Promise<ProjectWithAccess[]> {
    if (!caller.permissions.includes(PROJECT_READ_PERMISSION)) return []
    const readableProjectIds = new Set(
      await this.permissionService.listResourceIds(caller.userId, PROJECT_READ_PERMISSION),
    )
    const projects = await this.projectRepository.findPickerProjectsByIds(
      caller.projectIds.filter((projectId) => readableProjectIds.has(projectId)),
    )
    return Promise.all(
      projects.map(async (project) => ({
        project,
        canCreateAgents: await this.canCreateAgents(caller, project.id),
      })),
    )
  }

  async createAgent(
    caller: McpCaller,
    input: McpCreateAgentInput,
  ): Promise<McpResult<AgentRecord>> {
    const { projectId, ...agentFields } = input
    const { userId } = caller

    if (!(await this.canCreateAgents(caller, projectId))) {
      return { ok: false, error: PROJECT_NOT_FOUND_ERROR }
    }
    const [project] = await this.projectRepository.findPickerProjectsByIds([projectId])
    if (!project) {
      return { ok: false, error: PROJECT_NOT_FOUND_ERROR }
    }

    // The defaults the web app's agent creator starts from.
    const parsed = createAgentSchema.safeParse({
      ...agentFields,
      documentsRagMode: DocumentsRagMode.All,
      tagsToAdd: [],
      projectAgentSessionCategoryIds: [],
      resourceLibraryIds: [],
    })
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
          .join("\n"),
      }
    }

    const connectScope = { organizationId: project.organizationId, projectId }
    try {
      const { agent } = await this.agentsService.createAgent({
        connectScope,
        fields: parsed.data,
        userId,
      })
      await this.activitiesService.createActivity({
        action: "agent.create",
        userId,
        organizationId: connectScope.organizationId,
        projectId,
        entityId: null,
        entityType: null,
      })
      return { ok: true, value: agent }
    } catch (error) {
      // Business rules (name length, JSON schema of an extraction agent...)
      // come back as HTTP exceptions with a readable message.
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** Agents of a granted project the person is a member of, with whether update_agent can change them. */
  async listAgents(caller: McpCaller, projectId: string): Promise<McpResult<AgentWithSettings[]>> {
    const canReadProject =
      caller.permissions.includes(PROJECT_READ_PERMISSION) &&
      caller.projectIds.includes(projectId) &&
      (await this.permissionService.has(caller.userId, PROJECT_READ_PERMISSION, {
        type: "project",
        id: projectId,
      }))
    const [project] = canReadProject
      ? await this.projectRepository.findPickerProjectsByIds([projectId])
      : []
    if (!project) {
      return {
        ok: false,
        error: "Project not found. Call list_projects to see the projects you can use.",
      }
    }

    const connectScope = { organizationId: project.organizationId, projectId }
    const agents = await this.agentsService.listAgents({ userId: caller.userId, connectScope })
    const value = await Promise.all(
      agents.map(async (agent) => ({
        agent,
        agentSettings: await this.agentSettingsService.getLast({
          connectScope,
          agentId: agent.id,
        }),
        canUpdate: await this.canUpdateAgent(caller, { ...connectScope, agentId: agent.id }),
      })),
    )
    return { ok: true, value }
  }

  /**
   * Changes the draft settings of an agent, like editing in the studio. The
   * draft goes on top of an existing one, or starts from the published
   * version. Nothing is published: that stays a decision made in the studio.
   */
  async updateAgent(
    caller: McpCaller,
    input: { agentId: string } & McpAgentSettingsFields,
  ): Promise<McpResult<UpdatedAgentSettings>> {
    const { agentId, ...requestedFields } = input
    const scope = await this.agentRepository.findScopeById(agentId)
    if (!scope || !(await this.canUpdateAgent(caller, { ...scope, agentId }))) {
      return { ok: false, error: AGENT_NOT_FOUND_ERROR }
    }

    const fields = Object.fromEntries(
      Object.entries(requestedFields).filter(([, value]) => value !== undefined),
    )
    if (Object.keys(fields).length === 0) {
      return { ok: false, error: "Nothing to change: give at least one setting." }
    }
    const parsed = partialUpdateAgentSettingsSchema.safeParse(fields)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
          .join("\n"),
      }
    }

    const connectScope = scope
    try {
      const { agent, agentSettings } = await this.agentSettingsService.updateAllSettings({
        connectScope,
        agentId,
        fieldsToUpdate: parsed.data,
      })
      await this.activitiesService.createActivity({
        action: "agentSettings.update",
        userId: caller.userId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
        entityId: agentId,
        entityType: "agent",
      })
      return { ok: true, value: { agent, agentSettings } }
    } catch (error) {
      // Business rules (an extraction agent without a JSON schema...) come
      // back as HTTP exceptions with a readable message.
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** Granted on the project, and allowed to edit the agent's draft now. */
  private async canUpdateAgent(
    caller: McpCaller,
    target: { projectId: string; agentId: string },
  ): Promise<boolean> {
    if (!caller.projectIds.includes(target.projectId)) return false
    if (!caller.permissions.includes(AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION)) return false
    return this.permissionService.has(caller.userId, AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION, {
      type: "agent",
      id: target.agentId,
    })
  }

  private async canCreateAgents(caller: McpCaller, projectId: string): Promise<boolean> {
    if (!caller.projectIds.includes(projectId)) return false
    if (!caller.permissions.includes(AGENT_CREATE_PERMISSION)) return false
    return this.permissionService.has(caller.userId, AGENT_CREATE_PERMISSION, {
      type: "project",
      id: projectId,
    })
  }
}

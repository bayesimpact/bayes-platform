import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { AgentCsvExtractionRun } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-run.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type {
  EndpointRequestWithAgentCsvExtractionRun,
  EndpointRequestWithProject,
} from "../request.interface"

@Injectable()
export class AgentCsvExtractionRunContextResolver implements ContextResolver {
  readonly resource = "agentCsvExtractionRun" as const

  constructor(
    @InjectRepository(AgentCsvExtractionRun)
    private readonly repository: Repository<AgentCsvExtractionRun>,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { agentCsvExtractionRunId?: string }
    }
    const agentCsvExtractionRunId = requestWithParams.params?.agentCsvExtractionRunId

    if (!agentCsvExtractionRunId || agentCsvExtractionRunId === ":agentCsvExtractionRunId")
      throw new NotFoundException()

    const requestWithProject = request as EndpointRequestWithProject
    const agentCsvExtractionRun =
      (await this.repository.findOne({
        where: {
          id: agentCsvExtractionRunId,
          organizationId: requestWithProject.organizationId,
          projectId: requestWithProject.project.id,
        },
      })) ?? undefined
    if (!agentCsvExtractionRun) throw new NotFoundException()

    const requestWithRun = request as EndpointRequestWithAgentCsvExtractionRun
    requestWithRun.agentCsvExtractionRun = agentCsvExtractionRun
  }
}

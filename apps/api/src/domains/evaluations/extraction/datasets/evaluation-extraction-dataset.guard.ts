import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { CHECK_POLICY_KEY, type PolicyHandler } from "@/common/policies/check-policy.decorator"
import { requestToProjectPolicyContext } from "../../../projects/helpers"
import type { EvaluationExtractionDataset } from "./evaluation-extraction-dataset.entity"
import { EvaluationExtractionDatasetPolicy } from "./evaluation-extraction-dataset.policy"
import type { EvaluationExtractionDatasetDocument } from "./evaluation-extraction-dataset-document.entity"

@Injectable()
export class EvaluationExtractionDatasetGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as EndpointRequestWithProject & {
      evaluationExtractionDataset?: EvaluationExtractionDataset
      evaluationExtractionDatasetDocument?: EvaluationExtractionDatasetDocument
    }

    // Routes resolve either a dataset or a dataset file; the policy checks the one in context.
    const policy = new EvaluationExtractionDatasetPolicy(
      requestToProjectPolicyContext(request),
      request.evaluationExtractionDataset ?? request.evaluationExtractionDatasetDocument,
    )

    const policyHandler = this.reflector.getAllAndOverride<PolicyHandler>(CHECK_POLICY_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!policyHandler || !policyHandler(policy)) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }

    return true
  }
}

import type {
  CurrentTermsDto,
  TermsDocumentDto,
  TermsDocumentType,
} from "@caseai-connect/api-contracts"
import { NotFoundException } from "@nestjs/common"
import type { TermsAcceptance } from "./terms-acceptance.entity"
import type { TermsDocument } from "./terms-document.entity"

export function toTermsDocumentDto(document: TermsDocument): TermsDocumentDto {
  return {
    type: document.type,
    url: document.url,
    version: document.version,
    updatedAt: document.updatedAt.getTime(),
  }
}

export function toCurrentTermsDto(documents: TermsDocument[]): CurrentTermsDto {
  return {
    generalConditions: toTermsDocumentDto(findByType(documents, "general_conditions")),
    privacyPolicy: toTermsDocumentDto(findByType(documents, "privacy_policy")),
    aiUsagePolicy: toTermsDocumentDto(findByType(documents, "ai_usage_policy")),
  }
}

function findByType(documents: TermsDocument[], type: TermsDocumentType): TermsDocument {
  const document = documents.find((candidate) => candidate.type === type)
  if (!document) {
    throw new NotFoundException(`Terms document "${type}" is not seeded`)
  }
  return document
}

export function isAcceptanceUpToDate(
  acceptance: TermsAcceptance | null,
  documents: TermsDocument[],
): boolean {
  const generalConditions = findByType(documents, "general_conditions")
  const privacyPolicy = findByType(documents, "privacy_policy")
  const aiUsagePolicy = findByType(documents, "ai_usage_policy")

  if (
    generalConditions.url.length === 0 ||
    privacyPolicy.url.length === 0 ||
    aiUsagePolicy.url.length === 0
  ) {
    // If any of the documents is missing a URL, we consider the acceptance up to date to avoid blocking users.
    return true
  }

  if (!acceptance) return false
  return (
    acceptance.generalConditionsVersion === generalConditions.version &&
    acceptance.privacyPolicyVersion === privacyPolicy.version &&
    acceptance.aiUsagePolicyVersion === aiUsagePolicy.version
  )
}

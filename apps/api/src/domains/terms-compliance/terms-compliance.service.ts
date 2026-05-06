import type {
  TERMS_DOCUMENT_TYPES,
  UpdateTermsDocumentsRequestDto,
} from "@caseai-connect/api-contracts"
import { BadRequestException, Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { TermsAcceptance } from "./terms-acceptance.entity"
import { TermsDocument } from "./terms-document.entity"

type TermsDocumentTypeKey = (typeof TERMS_DOCUMENT_TYPES)[number]

@Injectable()
export class TermsComplianceService {
  constructor(
    @InjectRepository(TermsDocument)
    private readonly termsDocumentRepository: Repository<TermsDocument>,
    @InjectRepository(TermsAcceptance)
    private readonly termsAcceptanceRepository: Repository<TermsAcceptance>,
  ) {}

  async listTermsDocuments(): Promise<TermsDocument[]> {
    return this.termsDocumentRepository.find({})
  }

  async getLatestAcceptanceForUser(userId: string): Promise<TermsAcceptance | null> {
    return this.termsAcceptanceRepository.findOne({
      where: { userId },
      order: { createdAt: "DESC" },
    })
  }

  async recordAcceptance(params: {
    userId: string
    aiUsagePolicyAccepted: boolean
  }): Promise<TermsAcceptance> {
    const documents = await this.listTermsDocuments()
    const generalConditions = pickByType(documents, "general_conditions")
    const privacyPolicy = pickByType(documents, "privacy_policy")
    const aiUsagePolicy = pickByType(documents, "ai_usage_policy")

    const acceptance = this.termsAcceptanceRepository.create({
      userId: params.userId,
      generalConditionsUrl: generalConditions.url,
      generalConditionsVersion: generalConditions.version,
      privacyPolicyUrl: privacyPolicy.url,
      privacyPolicyVersion: privacyPolicy.version,
      aiUsagePolicyUrl: aiUsagePolicy.url,
      aiUsagePolicyVersion: aiUsagePolicy.version,
      aiUsagePolicyAccepted: params.aiUsagePolicyAccepted,
    })
    return this.termsAcceptanceRepository.save(acceptance)
  }

  async updateTermsDocuments(input: UpdateTermsDocumentsRequestDto): Promise<TermsDocument[]> {
    const documents = await this.listTermsDocuments()
    const updates: Array<{ type: TermsDocumentTypeKey; url: string; version: number }> = [
      { type: "general_conditions", ...input.generalConditions },
      { type: "privacy_policy", ...input.privacyPolicy },
      { type: "ai_usage_policy", ...input.aiUsagePolicy },
    ]

    for (const update of updates) {
      if (!Number.isInteger(update.version) || update.version < 1) {
        throw new BadRequestException(`Version for "${update.type}" must be a positive integer`)
      }
      if (!update.url || !/^https?:\/\//i.test(update.url)) {
        throw new BadRequestException(`URL for "${update.type}" must be a valid http(s) link`)
      }
    }

    for (const update of updates) {
      const existing = documents.find((document) => document.type === update.type)
      if (!existing) {
        throw new BadRequestException(`Terms document "${update.type}" is not seeded`)
      }
      const urlChanged = existing.url !== update.url
      const versionChanged = existing.version !== update.version

      if (!urlChanged && !versionChanged) continue

      if (urlChanged && update.version <= existing.version) {
        throw new BadRequestException(
          `Version for "${update.type}" must be greater than ${existing.version} when the URL changes`,
        )
      }
      if (!urlChanged && versionChanged && update.version <= existing.version) {
        throw new BadRequestException(
          `Version for "${update.type}" can only be incremented (was ${existing.version})`,
        )
      }

      existing.url = update.url
      existing.version = update.version
      await this.termsDocumentRepository.save(existing)
    }

    return this.listTermsDocuments()
  }
}

function pickByType(documents: TermsDocument[], type: TermsDocumentTypeKey): TermsDocument {
  const document = documents.find((candidate) => candidate.type === type)
  if (!document) {
    throw new BadRequestException(`Terms document "${type}" is not seeded`)
  }
  return document
}

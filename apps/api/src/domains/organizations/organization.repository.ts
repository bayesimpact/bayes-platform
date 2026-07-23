import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Organization } from "./organization.entity"

@Injectable()
export class OrganizationRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findByIds(organizationIds: string[]): Promise<Organization[]> {
    if (organizationIds.length === 0) {
      return []
    }

    return this.organizationRepo().find({
      where: { id: In(organizationIds) },
      order: { createdAt: "DESC" },
    })
  }

  private organizationRepo(): Repository<Organization> {
    return this.transactionService.getManager().getRepository(Organization)
  }
}

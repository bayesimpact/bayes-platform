import { InternalServerErrorException } from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"
import { getDataSourceToken, getRepositoryToken } from "@nestjs/typeorm"
import type { ObjectLiteral, Repository } from "typeorm"
import { OrganizationMembershipService } from "@/domains/organizations/memberships/organization-membership.service"
import { User } from "@/domains/users/user.entity"
import { OrganizationMembership } from "../memberships/organization-membership.entity"
import { Organization } from "../organization.entity"
import { OrganizationAccountProvisioningService } from "./organization-account-provisioning.service"

type MockRepository<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>

function createMockRepository<T extends ObjectLiteral>(): MockRepository<T> {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  }
}

describe("OrganizationAccountProvisioningService", () => {
  let service: OrganizationAccountProvisioningService
  let userRepository: MockRepository<User>
  let organizationRepository: MockRepository<Organization>
  let organizationMembershipRepository: MockRepository<OrganizationMembership>
  let dataSource: { transaction: jest.Mock }

  beforeEach(async () => {
    userRepository = createMockRepository<User>()
    organizationRepository = createMockRepository<Organization>()
    organizationMembershipRepository = createMockRepository<OrganizationMembership>()
    dataSource = {
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: jest.fn((entity) => {
            if (entity === User) return userRepository
            if (entity === Organization) return organizationRepository
            if (entity === OrganizationMembership) return organizationMembershipRepository
            throw new Error("Unknown repository")
          }),
        }),
      ),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationAccountProvisioningService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Organization), useValue: organizationRepository },
        {
          provide: getRepositoryToken(OrganizationMembership),
          useValue: organizationMembershipRepository,
        },
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: OrganizationMembershipService,
          useValue: { createOrganizationOwnerMembership: jest.fn() },
        },
      ],
    }).compile()

    service = module.get<OrganizationAccountProvisioningService>(
      OrganizationAccountProvisioningService,
    )
  })

  it("should create organization and owner membership for a new user", async () => {
    ;(userRepository.findOne as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    ;(userRepository.create as jest.Mock).mockReturnValue({
      id: "user1",
      auth0Id: "auth0|user1",
      email: "new@example.com",
    })
    ;(userRepository.save as jest.Mock).mockResolvedValue({
      id: "user1",
      auth0Id: "auth0|user1",
      email: "new@example.com",
    })

    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    }
    ;(organizationMembershipRepository.createQueryBuilder as jest.Mock).mockReturnValue(
      queryBuilder,
    )
    ;(organizationRepository.create as jest.Mock).mockReturnValue({
      id: "org1",
      name: "Demo Org",
    })
    ;(organizationRepository.save as jest.Mock).mockResolvedValue({
      id: "org1",
      name: "Demo Org",
    })
    ;(organizationMembershipRepository.create as jest.Mock).mockReturnValue({
      id: "mem1",
      userId: "user1",
      organizationId: "org1",
      role: "owner",
    })
    ;(organizationMembershipRepository.save as jest.Mock).mockResolvedValue({
      id: "mem1",
      userId: "user1",
      organizationId: "org1",
      role: "owner",
    })

    const result = await service.provisionOrganizationAccount({
      auth0UserId: "auth0|user1",
      email: "new@example.com",
      organizationName: "Demo Org",
    })

    expect(result).toEqual({
      status: "created",
      organizationId: "org1",
      userId: "user1",
    })
  })

  it("should skip duplicate when owner membership already exists", async () => {
    ;(userRepository.findOne as jest.Mock).mockResolvedValue({
      id: "user1",
      auth0Id: "auth0|user1",
      email: "existing@example.com",
      name: "Existing User",
    })

    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: "mem1",
        userId: "user1",
        organizationId: "org1",
        role: "owner",
      }),
    }
    ;(organizationMembershipRepository.createQueryBuilder as jest.Mock).mockReturnValue(
      queryBuilder,
    )
    ;(userRepository.save as jest.Mock).mockResolvedValue({
      id: "user1",
      auth0Id: "auth0|user1",
      email: "existing@example.com",
      name: "Existing User",
    })

    const result = await service.provisionOrganizationAccount({
      auth0UserId: "auth0|user1",
      email: "existing@example.com",
      organizationName: "Demo Org",
    })

    expect(result).toEqual({
      status: "skipped_duplicate",
      organizationId: "org1",
      userId: "user1",
    })
  })

  it("should throw when email is linked to a different non-placeholder auth0Id", async () => {
    ;(userRepository.findOne as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "user1",
      auth0Id: "auth0|different",
      email: "existing@example.com",
    })

    await expect(
      service.provisionOrganizationAccount({
        auth0UserId: "auth0|new-id",
        email: "existing@example.com",
        organizationName: "Demo Org",
      }),
    ).rejects.toThrow(
      new InternalServerErrorException(
        "Existing user with email existing@example.com has a different Auth0 ID",
      ),
    )
  })
})

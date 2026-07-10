import { InternalServerErrorException } from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"
import { getDataSourceToken, getRepositoryToken } from "@nestjs/typeorm"
import type { ObjectLiteral, Repository } from "typeorm"
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
import { User } from "@/domains/users/user.entity"
import { Organization } from "../organization.entity"
import { OrganizationAccountProvisioningService } from "./organization-account-provisioning.service"

type MockRepository<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>

function createMockRepository<T extends ObjectLiteral>(): MockRepository<T> {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }
}

describe("OrganizationAccountProvisioningService", () => {
  let service: OrganizationAccountProvisioningService
  let userRepository: MockRepository<User>
  let organizationRepository: MockRepository<Organization>
  let organizationMembershipsService: {
    findOwnerMembershipByOrganizationName: jest.Mock
    createOrganizationOwnerMembership: jest.Mock
  }
  let dataSource: { transaction: jest.Mock }

  beforeEach(async () => {
    userRepository = createMockRepository<User>()
    organizationRepository = createMockRepository<Organization>()
    organizationMembershipsService = {
      findOwnerMembershipByOrganizationName: jest.fn(),
      createOrganizationOwnerMembership: jest.fn(),
    }
    dataSource = {
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: jest.fn((entity) => {
            if (entity === User) return userRepository
            if (entity === Organization) return organizationRepository
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
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: OrganizationMembershipsService,
          useValue: organizationMembershipsService,
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
    organizationMembershipsService.findOwnerMembershipByOrganizationName.mockResolvedValue(null)
    ;(organizationRepository.create as jest.Mock).mockReturnValue({
      id: "org1",
      name: "Demo Org",
    })
    ;(organizationRepository.save as jest.Mock).mockResolvedValue({
      id: "org1",
      name: "Demo Org",
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
    expect(organizationMembershipsService.createOrganizationOwnerMembership).toHaveBeenCalledWith({
      userId: "user1",
      organizationId: "org1",
    })
  })

  it("should skip duplicate when owner membership already exists", async () => {
    ;(userRepository.findOne as jest.Mock).mockResolvedValue({
      id: "user1",
      auth0Id: "auth0|user1",
      email: "existing@example.com",
      name: "Existing User",
    })
    organizationMembershipsService.findOwnerMembershipByOrganizationName.mockResolvedValue({
      id: "mem1",
      userId: "user1",
      organizationId: "org1",
      role: "owner",
    })
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

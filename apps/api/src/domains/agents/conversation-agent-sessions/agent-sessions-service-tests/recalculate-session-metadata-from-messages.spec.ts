import { agentSessionControllerTestSetup } from "./test-setup"

const getTestContext = agentSessionControllerTestSetup()

describe("recalculateSessionMetadataFromMessages", () => {
  it("should keep only categories selected by the tool and return nullable title", async () => {
    const {
      service,
      testAgent,
      testAgentSettings,
      testOrganization,
      testProject,
      testUser,
      agentSessionCategoryRepository,
      conversationAgentSessionCategoryRepository,
    } = getTestContext()

    const connectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })

    const billingCategory = await agentSessionCategoryRepository.save(
      agentSessionCategoryRepository.create({
        agentId: testAgent.id,
        name: "billing support",
      }),
    )
    await agentSessionCategoryRepository.save(
      agentSessionCategoryRepository.create({
        agentId: testAgent.id,
        name: "technical bug",
      }),
    )

    const result = await service.recalculateSessionMetadataFromMessages({
      connectScope,
      sessionId: session.id,
      selectedCategoryNames: ["billing support", "does-not-exist"],
      suggestedTitle: null,
    })

    expect(result.suggestedTitle).toBeNull()
    expect(result.selectedCategoryNames).toEqual(["billing support"])

    const sessionCategories = await conversationAgentSessionCategoryRepository.find({
      where: { conversationAgentSessionId: session.id },
    })
    const updatedSession = await service.findById({
      id: session.id,
      connectScope,
    })

    expect(sessionCategories).toHaveLength(1)
    expect(sessionCategories[0]?.agentSessionCategoryId).toBe(billingCategory.id)
    expect(updatedSession?.title).toBeNull()
  })

  it("should persist suggested title when provided", async () => {
    const { service, testAgentSettings, testOrganization, testProject, testUser } = getTestContext()

    const connectScope = {
      organizationId: testOrganization.id,
      projectId: testProject.id,
    }

    const session = await service.createSession({
      connectScope,
      agentSettingsId: testAgentSettings.id,
      userId: testUser.id,
      type: "playground",
    })

    const result = await service.recalculateSessionMetadataFromMessages({
      connectScope,
      sessionId: session.id,
      selectedCategoryNames: [],
      suggestedTitle: "  Billing follow-up  ",
    })

    const updatedSession = await service.findById({
      id: session.id,
      connectScope,
    })

    expect(result.suggestedTitle).toBe("Billing follow-up")
    expect(updatedSession?.title).toBe("Billing follow-up")
  })
})

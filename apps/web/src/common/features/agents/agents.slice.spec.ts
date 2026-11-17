import { describe, expect, it } from "vitest"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { ADS } from "@/common/store/async-data-status"
import { agentFactory } from "./agent.factory"
import { agentsInitialState, agentsSlice } from "./agents.slice"
import { listAgents } from "./agents.thunks"

const reducer = agentsSlice.reducer
const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build()
const agent = agentFactory.transient({ project }).build()
const listArgs = { includeDrafts: true }

describe("agents slice", () => {
  describe("listAgents", () => {
    it("keeps the latest list when an older request is rejected after it", () => {
      const state = [
        listAgents.pending("request-1", listArgs),
        listAgents.pending("request-2", listArgs),
        listAgents.fulfilled([agent], "request-2", listArgs),
        listAgents.rejected(
          new Error("A newer list of agents was requested"),
          "request-1",
          listArgs,
        ),
      ].reduce(reducer, agentsInitialState)

      expect(state.data.status).toBe(ADS.Fulfilled)
      expect(state.data.value).toEqual([agent])
    })
  })
})

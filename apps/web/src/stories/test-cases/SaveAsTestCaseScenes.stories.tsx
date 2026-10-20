import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { AgentSessionMessage } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessage"
import { withRedux } from "@/stories/decorators"
import { seed } from "@/stories/seed"
import { FeedbackItem } from "@/studio/features/agent-message-feedback/components/FeedbackItem"
import { SaveAsTestCaseButton } from "@/studio/features/test-cases/components/SaveAsTestCaseButton"
import { SaveAsTestCaseDialog } from "@/studio/features/test-cases/components/SaveAsTestCaseDialog"
import type { TestCaseSource } from "@/studio/features/test-cases/test-cases.models"
import {
  buildMockTestCaseCallbacks,
  mockDatasets,
  mockFeedbacks,
  mockFirstTurnTestCaseSource,
  mockMessages,
  mockProject,
  mockTestCaseSource,
} from "./fixtures"

const meta = {
  title: "test-cases/Scenes",
  parameters: { layout: "padded" },
  // The message footer reads the current project's feature flags.
  decorators: [withRedux({ state: seed.currentProject(mockProject) })],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const testCaseSourcesByMessageId: Record<string, TestCaseSource> = {
  [mockFirstTurnTestCaseSource.agentMessageId]: mockFirstTurnTestCaseSource,
  [mockTestCaseSource.agentMessageId]: mockTestCaseSource,
}

const callbacks = buildMockTestCaseCallbacks()

/**
 * A playground conversation: every answer gets the flask next to copy, in the footer slot that holds
 * the revision badge today.
 */
function PlaygroundScene() {
  const [testCaseSource, setTestCaseSource] = useState<TestCaseSource | null>(null)
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {mockMessages.map((message) => (
        <AgentSessionMessage
          key={message.id}
          message={message}
          renderMessageVersion={(rendered) => {
            const source = testCaseSourcesByMessageId[rendered.id]
            return source ? (
              <SaveAsTestCaseButton onClick={() => setTestCaseSource(source)} />
            ) : null
          }}
        />
      ))}
      <SaveAsTestCaseDialog
        open={testCaseSource !== null}
        onOpenChange={(open) => !open && setTestCaseSource(null)}
        source={testCaseSource ?? mockTestCaseSource}
        datasets={mockDatasets}
        {...callbacks}
      />
    </div>
  )
}

/** The Feedback page: a user's report becomes a bad answer to save, the report as what is wrong. */
function FeedbackScene() {
  const [testCaseSource, setTestCaseSource] = useState<TestCaseSource | null>(null)
  return (
    <div className="mx-auto max-w-3xl divide-y">
      {mockFeedbacks.map((feedback) => (
        <FeedbackItem
          key={feedback.id}
          feedback={feedback}
          actions={
            <SaveAsTestCaseButton
              withLabel
              onClick={() =>
                setTestCaseSource({ ...mockTestCaseSource, feedback: feedback.content })
              }
            />
          }
        />
      ))}
      <SaveAsTestCaseDialog
        open={testCaseSource !== null}
        onOpenChange={(open) => !open && setTestCaseSource(null)}
        source={testCaseSource ?? mockTestCaseSource}
        datasets={mockDatasets}
        {...callbacks}
      />
    </div>
  )
}

export const Playground: Story = {
  render: () => <PlaygroundScene />,
}

export const FeedbackPage: Story = {
  render: () => <FeedbackScene />,
}

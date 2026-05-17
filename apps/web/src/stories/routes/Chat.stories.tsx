import { Button } from "@caseai-connect/ui/shad/button"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CirclePlusIcon, MicIcon, PaperclipIcon } from "lucide-react"
import { useState } from "react"
import { withRouter } from "storybook-addon-remix-react-router"
import type { AgentSessionMessage } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { AgentSessionMessage as AgentSessionMessageComponent } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessage"
import {
  Chat,
  ChatActions,
  ChatContent,
  ChatFooter,
  ChatHeader,
  ChatInput,
  ChatSubmit,
} from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/Chat"
import { DotsBackground } from "@/studio/components/DotsBackground"
import { withRedux } from "../decorators"

type StoryArgs = {
  messages: AgentSessionMessage[]
}

const meta = {
  title: "components/Chat",
  decorators: [withRouter],
  parameters: { layout: "fullscreen" },
  argTypes: {
    messages: { control: false },
  },
  args: {
    messages: [
      {
        id: "1",
        role: "assistant",
        content: `The **Charge** rule in Warmachine allows a model or unit to rush into melee with a target, gaining momentum for a more powerful first strike.

Here's a detailed breakdown of the charge rule:

### **1. Prerequisites for Charging**
*   A model **must have a melee weapon** to charge.
*   A model requires **line of sight** to its target to declare a charge.

### **2. Declaring a Charge**
*   Before moving, you must **declare the charge** and its **target**.
*   Even if circumstances might cause the charge to fail, a model only needs line of sight to declare a charge.

### **3. Charge Movement**
*   The charging model advances **up to its current SPD (Speed) plus 3 inches** in a straight line.
*   This movement can be in **any direction** that will bring its target into its melee range.
*   During this movement, the model **ignores terrain, the distance to the charge target, and other models**.
*   The charging model **cannot voluntarily stop** its movement until its target is in its melee range. Once the target is in melee range, the model can end its movement at any time.
*   A charging model **stops** if it contacts another model, an obstacle, or an obstruction, or if it is pushed, slammed, thrown, or placed during its movement. If a model can move through such an element due to a special rule, it doesn't stop but is still considered to have contacted it.

### **4. Successful vs. Failed Charge**
*   **Successful Charge:** A charging model makes a successful charge if its charge target is in its melee range at the end of its charge movement.
    *   The charging model must use its Combat Action to make either initial melee attacks or a special attack with a melee weapon.
*   **Failed Charge:** A charging model makes a failed charge if it ends its charge movement without its charge target in its melee range.
    *   If a model makes a failed charge, its **activation ends immediately**.

### **5. Charge Attack**
*   The charging model's **first melee attack** after ending its charge movement **must target the model it charged**.
*   If the charging model advanced **at least 3 inches**, its first attack with a melee weapon targeting the charged model is a **charge attack**.
    *   If this charge attack hits, the **damage roll against the charge target is automatically boosted**.
*   If the charging model moved **less than 3 inches**, its first melee attack is **not a charge attack**, but it must still target the charged model.
*   After resolving its charge attack, the charging model completes its Combat Action normally.

### **6. Warjack and Warbeast Charges**
*   **Warjacks** must spend **1 focus point** to use their Normal Movement to charge.
*   **Warbeasts** must be **forced** to use their Normal Movement to charge.

### **7. Unit Charges**
*   When a unit charges, select **one unengaged model** to move for the unit.
*   Declare the charge and its target before moving that model. This model requires line of sight to the target.
*   After the charging model completes its movement, place the other troopers in its unit within 2 inches of that model as normal.
*   If the charging model advanced at least 3 inches, the first attack with a melee weapon made by **each model in the unit** targeting a model/unit that was in the charging model's melee range at the end of its charge movement are charge attacks.

### **8. Required Charges**
*   If a model is **required to charge** but cannot (e.g., no legal targets or unable to move), it activates but must **forfeit its Normal Movement and Combat Action**.
`,
      },
      {
        id: "2",
        role: "user",
        content: "What can you do?",
      },
    ],
  },
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [withRedux()],
  render: (args) => {
    const typedArgs = args as StoryArgs
    const [messages, setMessages] = useState<AgentSessionMessage[]>(typedArgs.messages)

    const handleSubmit = (value: string) => {
      setMessages((prev: AgentSessionMessage[]) => [
        ...prev,
        { id: String(prev.length + 1), role: "user", content: value },
      ])
    }
    return (
      <div className="h-screen w-screen">
        <DotsBackground className="p-10">
          <Chat>
            <ChatHeader />
            <ChatContent>
              {messages.map((msg: AgentSessionMessage) => (
                <AgentSessionMessageComponent key={msg.id} message={msg} />
              ))}
            </ChatContent>

            <ChatFooter focus={false} onMessageSubmit={handleSubmit}>
              <ChatInput placeholder="Ask a question..." className="resize-none" />

              <ChatActions>
                <div className="flex-1 justify-start flex gap-1">
                  <Button variant="secondary">
                    <CirclePlusIcon />
                  </Button>
                  <Button variant="ghost">
                    <PaperclipIcon />
                  </Button>
                  <Button variant="ghost">
                    <MicIcon />
                  </Button>
                </div>
                <ChatSubmit variant="ghost" />
              </ChatActions>
            </ChatFooter>
          </Chat>
        </DotsBackground>
      </div>
    )
  },
}

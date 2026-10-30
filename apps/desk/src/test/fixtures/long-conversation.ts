/**
 * A long conversation for the stories: the person plans the launch of a new plan with the agent
 * over five exchanges, and each reply uses another part of Markdown (headings, nested lists,
 * tables, a quote, code, a checklist). From the second message on, the person annotates passages
 * of the reply before, which the world adds to their message as the message box sends them.
 */
export const LONG_CONVERSATION_TITLE = "Plan the launch of the Team plan"

/** A passage of the reply before and the person's note on it. */
type LongConversationAnnotation = {
  passage: string
  note: string
  /** Which occurrence of the passage's text in the reply, from 1: the first by default. */
  occurrence?: number
}

/** The messages of the conversation, oldest first, after the agent's greeting. */
export const LONG_CONVERSATION_EXCHANGES: {
  question: string
  annotations?: LongConversationAnnotation[]
  /** The tasks of the reply before that the person ticked, by their place from 1. */
  tickedTasks?: { item: number; text: string }[]
  reply: string
}[] = [
  {
    question: [
      "We want to launch a new Team plan next month, between Starter and Pro.",
      "",
      "It would cover up to 10 people, with shared workspaces but without the integrations. I need a launch plan I can share with the product, support and marketing leads on Monday. Can you propose one, with the main risks?",
    ].join("\n"),
    reply: [
      "Here is a launch plan in three phases. Each phase ends with a decision, so the leads know when they can stop or go on.",
      "",
      "## 1. Prepare (weeks 1 and 2)",
      "",
      "- **Product**",
      "  - Freeze the scope: up to 10 seats, shared workspaces, no integrations.",
      "  - Decide what happens when a team adds an 11th person: a block, or an offer to move to Pro.",
      "- **Support**",
      "  - Write the answers to the ten questions you expect most.",
      "  - Train the team on the upgrades and downgrades between plans.",
      "- **Marketing**",
      "  - Update the plan comparison page.",
      "  - Prepare the announcement for the current customers.",
      "",
      "_Decision at the end of week 2:_ the scope and the price are final.",
      "",
      "## 2. Open to a first group (week 3)",
      "",
      "1. Offer the plan to about 50 Starter customers who already invite colleagues.",
      "2. Follow three numbers every day:",
      "   - the share of customers who accept the offer,",
      "   - the support tickets about the plan,",
      "   - the teams that reach the 10-seat limit.",
      "3. Hold a short review with the three leads on Friday.",
      "",
      "_Decision at the end of week 3:_ open the plan to everyone, or fix what the first group found.",
      "",
      "## 3. Open to everyone (week 4)",
      "",
      "Publish the new comparison page, send the announcement, and keep the daily follow-up for two more weeks.",
      "",
      "## Main risks",
      "",
      "| Risk | Likelihood | Impact | What reduces it |",
      "| --- | --- | --- | --- |",
      "| Pro customers move down to Team | Medium | High | Keep the integrations in Pro only, and say so clearly on the comparison page |",
      "| The 10-seat limit frustrates growing teams | High | Medium | Show the Pro offer at the limit, with a free month to try it |",
      "| Support gets more tickets than it can answer | Medium | Medium | Publish the FAQ before the launch, and add a help link next to the limit |",
      "| The price is too close to Pro | Low | High | Test two prices with the first group |",
      "",
      "> The first risk matters most: a plan that takes revenue from Pro can cost more than it brings.",
      "",
      "Do you want me to adapt this plan to the size of your support team?",
    ].join("\n"),
  },
  {
    question: [
      "Yes, two constraints I forgot:",
      "",
      "- the support team is five people, and two of them are on holiday in week 3,",
      "- marketing cannot publish anything before the 15th.",
      "",
      "Does the plan still hold? If not, what would you change first?",
    ].join("\n"),
    annotations: [
      {
        passage: "Offer the plan to about 50 Starter customers who already invite colleagues.",
        note: "Is 50 still right with the constraints above?",
      },
      {
        passage: "The first risk matters most",
        note: "Agreed, the Pro team will ask about it first. How do we show it on the comparison page?",
      },
    ],
    reply: [
      "The plan holds, but two dates move. With three people in support during week 3, the first group must stay small, and the public launch must wait for the 15th.",
      "",
      "### What changes",
      "",
      "1. **The first group goes from 50 to 20 customers.** Twenty teams send about as many tickets as three people can answer in a day, from what a launch usually brings.",
      "2. **The public launch moves to the 15th.** Week 4 then becomes a second week with the first group, which gives you more data before the launch.",
      "3. **The FAQ comes first.** It is the one thing that cuts tickets before they arrive, so it should be ready before the first group opens.",
      "",
      "### The new timeline",
      "",
      "| Week | Product | Support | Marketing |",
      "| --- | --- | --- | --- |",
      "| 1 | Freeze the scope | Draft the FAQ | Draft the comparison page |",
      "| 2 | Set the price | Publish the FAQ, train the team | Draft the announcement |",
      "| 3 | Open to 20 customers | Three people answer, daily review | Nothing public |",
      "| 4 | Open to 20 more customers | Full team back | Final review of the texts |",
      "| From the 15th | Open to everyone | Follow the tickets | Publish and send the announcement |",
      "",
      "### What I would not change",
      "",
      "- The decision points at the end of weeks 2 and 3: they are what lets the leads stop in time.",
      "- The two prices tested with the first group: twenty customers are few, but enough to see a large gap.",
      "",
      "If the price test shows no clear winner, keep the higher price: it is easier to lower a price later than to raise it.",
    ].join("\n"),
  },
  {
    question:
      "Great. Can you draft the announcement email for the current customers, and the five questions of the FAQ you think matter most? Keep the email short, people don't read long emails.",
    annotations: [
      { passage: "keep the higher price", note: "Product agrees, we keep it." },
      { passage: "The FAQ comes first.", note: "Yes, so start with it below the email." },
      // The reply says "the first group" four times: this is the second.
      { passage: "the first group", note: "The same 20 customers, or 20 new ones?", occurrence: 2 },
    ],
    reply: [
      "Here is the email, under 120 words, then the five questions.",
      "",
      "### The announcement email",
      "",
      "> **Subject: A new plan for small teams**",
      ">",
      "> Hello,",
      ">",
      "> Many of you invite a few colleagues to work together. From today, the **Team plan** is made for you: up to 10 people, shared workspaces, and one invoice for the whole team.",
      ">",
      "> Your current plan does not change. You can move to Team at any time from your account settings, and move back if it does not suit you.",
      ">",
      "> [Compare the plans](https://example.org/plans)",
      ">",
      "> The Product team",
      "",
      "### The five questions of the FAQ",
      "",
      "**1. What is the difference between Team and Pro?**",
      "Team covers up to 10 people with shared workspaces. Pro has no limit on people and adds the integrations, such as webhooks.",
      "",
      "**2. What happens when we reach 10 people?**",
      "You can still use your workspaces, but you cannot invite an 11th person. We then propose Pro, with a free first month.",
      "",
      "**3. Can we move back to Starter?**",
      "Yes, at any time. The shared workspaces become read-only for the people beyond the first one.",
      "",
      "**4. How are we billed when we change plans in the middle of a month?**",
      "We charge the new plan from the day of the change, and credit what remains of the old one.",
      "",
      "**5. Do we keep our data if we leave Team?**",
      "Yes. Nothing is deleted when you change plans.",
      "",
      "Question 3 needs a check with product: the read-only rule is my proposal, not a decision.",
    ].join("\n"),
  },
  {
    question: [
      "Last thing. Our billing tool listens to a webhook when a customer changes plans.",
      "",
      "What should the event look like for the Team plan, and what should the billing team check before the launch?",
    ].join("\n"),
    annotations: [
      {
        passage: "The shared workspaces become read-only for the people beyond the first one.",
        note: "Product confirmed this rule, you can drop the warning.",
      },
      {
        passage: "Nothing is deleted when you change plans.",
        note: "Even after a year on Starter?",
      },
    ],
    reply: [
      "The event can keep the shape of the one you send today, with the new plan in `plan` and the seat limit in `limits`. Here is an example:",
      "",
      "```json",
      "{",
      '  "type": "subscription.plan_changed",',
      '  "occurredAt": "2026-11-15T09:30:00Z",',
      '  "customerId": "cus_4f2a9c",',
      '  "previousPlan": "starter",',
      '  "plan": "team",',
      '  "limits": { "seats": 10, "integrations": false },',
      '  "proration": { "creditCents": 1250, "currency": "EUR" }',
      "}",
      "```",
      "",
      "On the billing side, a small guard keeps an unknown plan from creating a wrong invoice:",
      "",
      "```ts",
      'const KNOWN_PLANS = ["starter", "team", "pro"] as const',
      "",
      "function isKnownPlan(plan: string): plan is (typeof KNOWN_PLANS)[number] {",
      "  return KNOWN_PLANS.some((knownPlan) => knownPlan === plan)",
      "}",
      "```",
      "",
      "### What the billing team should check",
      "",
      "- [ ] The tool accepts `team` as a plan, and rejects a plan it does not know.",
      "- [ ] A change in the middle of a month credits the old plan, as the FAQ promises.",
      "- [ ] A move from Team to Pro and back gives two events, in the right order.",
      "- [ ] The same event received twice creates one invoice only: use `customerId` and `occurredAt` as the key.",
      "- [ ] An event that fails is retried, and someone gets an alert after the third failure.",
      "",
      "Run these checks in week 2, before the first group opens: a billing error seen by the first customers would cost more trust than any other bug of the launch.",
    ].join("\n"),
  },
  {
    // A message of annotations only, as the message box sends one with nothing written.
    question: "",
    annotations: [
      {
        passage: "use customerId and occurredAt as the key",
        note: "We already do this for invoices, so this one is covered.",
      },
      {
        passage: "someone gets an alert after the third failure",
        note: "Who: billing or support?",
      },
    ],
    tickedTasks: [
      {
        item: 4,
        text: "The same event received twice creates one invoice only: use customerId and occurredAt as the key.",
      },
    ],
    reply: [
      "Billing, because only billing can fix an invoice. Support should still hear about it, so they know what to tell a customer who writes in.",
      "",
      "A simple split:",
      "",
      "- **Billing** gets the alert and owns the fix.",
      "- **Support** gets a short daily summary of the failed events, with the customers they affect.",
      "",
      "Since you already key invoices on the same fields, the duplicate check is the one item you can tick today:",
      "",
      "- [x] The same event received twice creates one invoice only.",
      "- [ ] An event that fails is retried, and billing gets the alert after the third failure.",
    ].join("\n"),
  },
]

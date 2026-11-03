import { buildInvitationEmail, buildInvitationLink } from "./invitation-email"

describe("buildInvitationLink", () => {
  it("encodes the email, including a plus sign", () => {
    expect(buildInvitationLink("https://platform.example.org", "first.last+team@example.com")).toBe(
      "https://platform.example.org/?login_hint=first.last%2Bteam%40example.com",
    )
  })
})

describe("buildInvitationEmail", () => {
  const params = {
    to: "invited@example.com",
    link: "https://platform.example.org/?login_hint=invited%40example.com",
    inviterName: "Alex Martin",
    targetType: "agent" as const,
    targetName: "Helpful Assistant",
    organizationName: "Example Org",
  }

  it("writes the invitation in English then French, with the link", () => {
    const email = buildInvitationEmail(params)

    expect(email.to).toBe("invited@example.com")
    expect(email.subject).toBe("Invitation: Helpful Assistant · Invitation : Helpful Assistant")
    expect(email.text).toContain(
      "Alex Martin invited you to join the agent Helpful Assistant (Example Org).",
    )
    expect(email.text).toContain(
      "Alex Martin vous invite à rejoindre l'agent Helpful Assistant (Example Org).",
    )
    expect(email.text).toContain(params.link)
    expect(email.text).toContain("Use exactly this email address: invited@example.com.")
    expect(email.html).toContain(`href="${params.link}"`)
  })

  it("escapes names in the HTML version", () => {
    const email = buildInvitationEmail({ ...params, targetName: "<b>Agent</b>" })

    expect(email.html).toContain("&lt;b&gt;Agent&lt;/b&gt;")
    expect(email.html).not.toContain("<b>Agent</b>")
  })

  it("says what a workspace invitation gives, with one button for both languages", () => {
    const email = buildInvitationEmail({
      ...params,
      targetType: "project",
      targetName: "Demo project",
      workspaceAccess: { role: "member", agentNames: ["Helpful Assistant", "Scheduling Bot"] },
    })

    expect(email.text).toContain("You join as a member, with Helpful Assistant and Scheduling Bot.")
    expect(email.text).toContain(
      "Vous rejoignez en tant que membre, avec Helpful Assistant et Scheduling Bot.",
    )
    expect(email.html.match(/<a /g)).toHaveLength(1)
  })

  it("gives an admin every agent", () => {
    const email = buildInvitationEmail({
      ...params,
      targetType: "project",
      workspaceAccess: { role: "admin", agentNames: [] },
    })

    expect(email.text).toContain("You join as an admin, with every agent.")
    expect(email.text).toContain("Vous rejoignez en tant qu'administrateur, avec tous les agents.")
  })
})

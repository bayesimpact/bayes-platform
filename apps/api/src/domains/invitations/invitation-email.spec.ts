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

  it("writes the invitation in English by default, with the link", () => {
    const email = buildInvitationEmail(params)

    expect(email.to).toBe("invited@example.com")
    expect(email.subject).toBe("Invitation: Helpful Assistant")
    expect(email.text).toBe(
      [
        "Alex Martin invited you to join the agent Helpful Assistant (Example Org).",
        params.link,
        "Sign in with invited@example.com",
      ].join("\n\n"),
    )
    expect(email.html).toContain(`href="${params.link}"`)
    expect(email.html).toContain("Open the invitation")
  })

  it("writes the invitation in French only, for a French inviter", () => {
    const email = buildInvitationEmail({ ...params, language: "fr" })

    expect(email.subject).toBe("Invitation : Helpful Assistant")
    expect(email.text).toBe(
      [
        "Alex Martin vous invite à rejoindre l'agent Helpful Assistant (Example Org).",
        params.link,
        "Connectez-vous avec invited@example.com",
      ].join("\n\n"),
    )
    expect(email.html).toContain("Ouvrir l&#39;invitation")
    expect(email.html).not.toContain("invited you")
  })

  it("escapes names in the HTML version", () => {
    const email = buildInvitationEmail({ ...params, targetName: "<b>Agent</b>" })

    expect(email.html).toContain("&lt;b&gt;Agent&lt;/b&gt;")
    expect(email.html).not.toContain("<b>Agent</b>")
  })

  it("says what a workspace invitation gives, with one button", () => {
    const workspaceParams = {
      ...params,
      targetType: "project" as const,
      targetName: "Demo project",
      workspaceAccess: { role: "member", agentNames: ["Helpful Assistant", "Scheduling Bot"] },
    }

    const english = buildInvitationEmail(workspaceParams)
    const french = buildInvitationEmail({ ...workspaceParams, language: "fr" })

    expect(english.text).toContain(
      "Alex Martin invited you to join the workspace Demo project (Example Org) as a member, with Helpful Assistant and Scheduling Bot.",
    )
    expect(french.text).toContain(
      "Alex Martin vous invite à rejoindre l'espace de travail Demo project (Example Org) en tant que membre, avec Helpful Assistant et Scheduling Bot.",
    )
    expect(english.html.match(/<a /g)).toHaveLength(1)
  })

  it("gives an admin every agent", () => {
    const adminParams = {
      ...params,
      targetType: "project" as const,
      workspaceAccess: { role: "admin", agentNames: [] },
    }

    expect(buildInvitationEmail(adminParams).text).toContain(
      "(Example Org) as an admin, with every agent.",
    )
    expect(buildInvitationEmail({ ...adminParams, language: "fr" }).text).toContain(
      "(Example Org) en tant qu'administrateur, avec tous les agents.",
    )
  })
})

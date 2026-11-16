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

  it("puts the inviter's name in bold, with capital letters", () => {
    const email = buildInvitationEmail({ ...params, inviterName: "jean-pierre martin" })

    expect(email.text).toContain("Jean-Pierre Martin invited you")
    expect(email.html).toContain("<strong>Jean-Pierre Martin</strong> invited you")
  })

  it("leaves an inviter's email as it is", () => {
    const email = buildInvitationEmail({ ...params, inviterName: "alex@example.com" })

    expect(email.text).toContain("alex@example.com invited you")
  })

  it("lists the agents of a workspace invitation in their own sentence, in bold", () => {
    const workspaceParams = {
      ...params,
      targetType: "project" as const,
      targetName: "Demo project",
      workspaceAccess: { role: "member", agentNames: ["Helpful Assistant", "Scheduling Bot"] },
    }

    const english = buildInvitationEmail(workspaceParams)
    const french = buildInvitationEmail({ ...workspaceParams, language: "fr" })

    expect(english.text).toContain(
      "Alex Martin invited you to join the workspace Demo project (Example Org) as a member.\n\nYou will have access to these agents: Helpful Assistant and Scheduling Bot.",
    )
    expect(english.html).toContain(
      "<p>You will have access to these agents: <strong>Helpful Assistant</strong> and <strong>Scheduling Bot</strong>.</p>",
    )
    expect(french.text).toContain(
      "Alex Martin vous invite à rejoindre l'espace de travail Demo project (Example Org) en tant que membre.\n\nVous aurez accès à ces agents : Helpful Assistant et Scheduling Bot.",
    )
    expect(english.html.match(/<a /g)).toHaveLength(1)
  })

  it("adds no agents sentence for a member without agents", () => {
    const email = buildInvitationEmail({
      ...params,
      targetType: "project",
      workspaceAccess: { role: "member", agentNames: [] },
    })

    expect(email.text).toContain("(Example Org) as a member.")
    expect(email.text).not.toContain("access to")
  })

  it("gives an admin every agent", () => {
    const adminParams = {
      ...params,
      targetType: "project" as const,
      workspaceAccess: { role: "admin", agentNames: [] },
    }

    expect(buildInvitationEmail(adminParams).text).toContain(
      "(Example Org) as an admin.\n\nYou will have access to every agent.",
    )
    expect(buildInvitationEmail({ ...adminParams, language: "fr" }).text).toContain(
      "(Example Org) en tant qu'administrateur.\n\nVous aurez accès à tous les agents.",
    )
  })
})

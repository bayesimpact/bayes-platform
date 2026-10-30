export const invitationKeys = {
  all: ["invitations"] as const,
  mine: () => [...invitationKeys.all, "mine"] as const,
}

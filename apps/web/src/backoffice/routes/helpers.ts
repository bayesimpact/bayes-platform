import { defineRoute } from "@/common/routes/helpers"

const home = defineRoute("/backoffice")

export const BackofficeRoutes = { home }

export const BackofficeUserRoutes = {
  users: home.extend("/users"),
  user: home.extend("/users/:userId"),
}

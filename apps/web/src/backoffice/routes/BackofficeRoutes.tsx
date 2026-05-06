import { BackofficeGuard } from "./BackofficeGuard"
import { BackofficeRoute } from "./BackofficeRoute"
import { BackofficeRouteNames } from "./helpers"

export const backofficeRoutes = {
  path: BackofficeRouteNames.HOME,
  element: (
    <BackofficeGuard>
      <BackofficeRoute />
    </BackofficeGuard>
  ),
}

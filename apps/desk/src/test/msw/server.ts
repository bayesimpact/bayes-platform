import { setupServer } from "msw/node"
import { handlers } from "./handlers"

/** The mocked API of the component tests. */
export const server = setupServer(...handlers)

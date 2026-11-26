import { documentsRoutesAt } from "@caseai-connect/chat-contracts"
import { PROJECT_PATH } from "../common/params.dto"

/** The documents a reply cites as its sources. */
export const EvalDocumentsRoutes = documentsRoutesAt(PROJECT_PATH)

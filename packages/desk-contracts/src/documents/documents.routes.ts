import { PROJECT_PATH } from "../common/params.dto"
import { defineSchemaRoute } from "../define-schema-route"
import {
  documentIsPublicOutputSchema,
  documentParamsSchema,
  temporaryUrlOutputSchema,
} from "./documents.dto"

const documentPath = `${PROJECT_PATH}/documents/:documentId`

/** The documents a reply cites as its sources. */
export const DeskDocumentsRoutes = {
  getIsPublic: defineSchemaRoute({
    method: "get",
    path: `${documentPath}/is-public`,
    params: documentParamsSchema,
    response: documentIsPublicOutputSchema,
  }),
  /** Answers 403 for a document that is not public, to a person who cannot read the project's documents. */
  getTemporaryUrl: defineSchemaRoute({
    method: "get",
    path: `${documentPath}/temporary-url`,
    params: documentParamsSchema,
    response: temporaryUrlOutputSchema,
  }),
}

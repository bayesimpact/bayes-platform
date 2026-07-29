import type { RequestPayload } from "@caseai-connect/api-contracts"
import { type ArgumentMetadata, BadRequestException, type PipeTransform } from "@nestjs/common"
import { ZodError, type ZodType } from "zod"

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodType) {}

  transform(value: RequestPayload<unknown> | undefined, _metadata: ArgumentMetadata) {
    try {
      // A request with no body at all (e.g. a POST with every payload field optional) arrives
      // here as `undefined`, not `{ payload: undefined }` (body-parser never populates `req.body`
      // when no body was sent). Fall back to `{}` so schemas whose fields are all optional still
      // validate instead of throwing on `undefined.payload`.
      const parsedValue = this.schema.parse(value?.payload ?? {})
      return { payload: parsedValue }
    } catch (error) {
      this.handleError(error)
    }
  }

  handleError(error: unknown) {
    if (error instanceof ZodError) {
      const formattedIssues = error.issues
        .map((issue, index) => `  [Issue ${index + 1}] ${issue.path.join(".")}:\n ${issue.message}`)
        .join("\n")

      const errorCount = error.issues.length
      throw new BadRequestException(
        `ZodValidationError: found ${errorCount} issue${errorCount > 1 ? "s" : ""}\n${formattedIssues}`,
      )
    }
    throw new BadRequestException({
      message: "Validation failed: An unexpected error occurred during validation.",
    })
  }
}

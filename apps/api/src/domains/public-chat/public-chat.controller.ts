import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PublicChatService } from "./public-chat.service"

/**
 * Base of the public chat API controllers, a versioned contract with external
 * integrators (`docs/public-api-contract.md`).
 *
 * Each served contract has its own folder and controller extending this class: `v1/`
 * (`/public/v1/...`, deprecated) and `v2/` (`/public/v2/...`). Every controller carries the full body of each of its routes and its
 * own DTO mappers, so a contract can change without touching another.
 * Nothing is shared here but the injected service, which returns entities, never DTOs.
 *
 * Before adding a new major, follow the "Shipping a new major version" checklist in
 * `docs/public-api-contract.md`: each major has its own DTOs and route definitions in
 * `api-contracts`, or the new mappers will silently change what an older major serves.
 *
 * This class declares no routes and no guards and is not registered in the module.
 * `@Injectable()` only makes TypeScript emit the constructor metadata the subclasses
 * inherit for dependency injection.
 */
@Injectable()
export abstract class PublicChatController {
  constructor(protected readonly publicChatService: PublicChatService) {}
}

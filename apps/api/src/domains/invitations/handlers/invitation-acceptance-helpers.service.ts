import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import type { Repository } from "typeorm"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  isServiceAuth0Id,
  isServiceUser,
  isServiceUserEmail,
} from "@/domains/users/service-user.helpers"
import type { User } from "@/domains/users/user.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserRepository } from "@/domains/users/user.repository"
import { USER_TYPE_HUMAN } from "@/domains/users/user.types"
import type { Invitation, InvitationTargetType } from "../invitation.entity"

@Injectable()
export class InvitationAcceptanceHelpersService {
  constructor(private readonly userRepository: UserRepository) {}

  async resolveAcceptedUser(auth0Sub: string, email: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase()
    if (isServiceAuth0Id(auth0Sub) || isServiceUserEmail(normalizedEmail)) {
      throw new UnauthorizedException(AUTH_ERRORS.SERVICE_USERS_CANNOT_AUTHENTICATE)
    }

    const byAuth0Id = await this.userRepository.findByAuth0Id(auth0Sub)
    if (byAuth0Id) {
      if (isServiceUser(byAuth0Id)) {
        throw new UnauthorizedException(AUTH_ERRORS.SERVICE_USERS_CANNOT_AUTHENTICATE)
      }
      return byAuth0Id
    }
    const byEmail = await this.userRepository.findByEmail(normalizedEmail)
    if (byEmail) {
      if (isServiceUser(byEmail)) {
        throw new UnauthorizedException(AUTH_ERRORS.SERVICE_USERS_CANNOT_AUTHENTICATE)
      }
      if (byEmail.auth0Id !== auth0Sub) {
        return this.userRepository.updateAuth0Id(byEmail, auth0Sub)
      }
      return byEmail
    }
    return this.userRepository.createUser({
      auth0Id: auth0Sub,
      email: normalizedEmail,
      name: null,
      pictureUrl: null,
      type: USER_TYPE_HUMAN,
    })
  }

  async findAndValidateInvitation(
    invitationRepository: Repository<Invitation>,
    ticketId: string,
    email: string,
    targetType: InvitationTargetType,
  ): Promise<Invitation> {
    const invitation = await invitationRepository.findOne({
      where: { invitationToken: ticketId, targetType },
    })
    if (!invitation) throw new NotFoundException(`Invitation not found for ticket: ${ticketId}`)
    if (invitation.status !== "pending") {
      throw new BadRequestException(
        `Invitation cannot be accepted because it has already been ${invitation.status}`,
      )
    }
    if (
      invitation.invitedEmail &&
      invitation.invitedEmail.trim().toLowerCase() !== email.trim().toLowerCase()
    ) {
      throw new UnauthorizedException(`No invitation found for email: ${email}`)
    }
    return invitation
  }
}

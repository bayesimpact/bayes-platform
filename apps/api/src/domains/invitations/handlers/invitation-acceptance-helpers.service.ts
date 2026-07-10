import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import type { Repository } from "typeorm"
import type { User } from "@/domains/users/user.entity"
import type { Invitation, InvitationTargetType } from "../invitation.entity"

@Injectable()
export class InvitationAcceptanceHelpersService {
  async resolveAcceptedUser(
    userRepository: Repository<User>,
    auth0Sub: string,
    email: string,
  ): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase()
    const byAuth0Id = await userRepository.findOne({ where: { auth0Id: auth0Sub } })
    if (byAuth0Id) return byAuth0Id
    const byEmail = await userRepository.findOne({ where: { email: normalizedEmail } })
    if (byEmail) {
      if (byEmail.auth0Id !== auth0Sub) {
        byEmail.auth0Id = auth0Sub
        return userRepository.save(byEmail)
      }
      return byEmail
    }
    return userRepository.save(
      userRepository.create({
        auth0Id: auth0Sub,
        email: normalizedEmail,
        name: null,
        pictureUrl: null,
      }),
    )
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

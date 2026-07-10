import type { Repository } from "typeorm"
import type { User } from "@/domains/users/user.entity"
import type { Invitation } from "../invitation.entity"

export type BaseInviteMembersContext = {
  invitationRepository: Repository<Invitation>
  userRepository: Repository<User>
}

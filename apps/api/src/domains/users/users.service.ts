import { Injectable, UnauthorizedException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { normalizeAuth0Name } from "@/domains/auth/auth0-userinfo.helper"
import type { Auth0UserInfoResponse } from "@/domains/auth/auth0-userinfo.service"
import { User } from "./user.entity"

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByAuth0Id(auth0Id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { auth0Id } })
  }
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } })
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } })
  }

  async create(auth0UserInfo: Auth0UserInfoResponse): Promise<User> {
    // Ensure email is provided (required field)
    if (!auth0UserInfo.email) {
      throw new Error("Email is required from Auth0 token")
    }

    const user = this.userRepository.create({
      auth0Id: auth0UserInfo.sub,
      email: auth0UserInfo.email,
      name: auth0UserInfo.name || null,
      pictureUrl: auth0UserInfo.picture || null,
    })

    return this.userRepository.save(user)
  }

  async updateUser(userId: string, name: string): Promise<User> {
    await this.userRepository.update(userId, { name })
    const updated = await this.findById(userId)
    if (!updated) throw new Error(`User ${userId} not found after update`)
    return updated
  }

  async findOrCreate({
    sub,
    getUserInfo,
  }: {
    sub: Auth0UserInfoResponse["sub"]
    getUserInfo: () => Promise<Auth0UserInfoResponse>
  }): Promise<User> {
    let user = await this.findByAuth0Id(sub)

    if (!user) {
      const auth0UserInfo = await getUserInfo()

      if (!auth0UserInfo.email) {
        throw new UnauthorizedException("Email is required from Auth0 token")
      }

      user = await this.findByEmail(auth0UserInfo.email)

      if (user) {
        return this.userRepository.save({
          ...user,
          auth0Id: auth0UserInfo.sub, // Link existing user to Auth0 ID
          name: normalizeAuth0Name(auth0UserInfo.name, auth0UserInfo.email),
          picture: auth0UserInfo.picture,
        })
      }

      user = await this.create({
        sub: auth0UserInfo.sub,
        email: auth0UserInfo.email,
        name: normalizeAuth0Name(auth0UserInfo.name, auth0UserInfo.email),
        picture: auth0UserInfo.picture,
      })
    }
    return user
  }
}

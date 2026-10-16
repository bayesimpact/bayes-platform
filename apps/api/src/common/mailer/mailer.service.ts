import { Injectable, Logger } from "@nestjs/common"
import { createTransport, type Transporter } from "nodemailer"
import { getSmtpConfig, type SmtpConfig } from "./smtp-config"

export type MailMessage = {
  to: string
  subject: string
  text: string
  html: string
}

/** Sends emails over SMTP when it is configured. Does nothing otherwise. */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name)
  private readonly config: SmtpConfig | null = getSmtpConfig()
  private transporter: Transporter | null = null

  isEnabled(): boolean {
    return this.config !== null
  }

  /** Throws when the SMTP server refuses the message. Callers decide whether that is fatal. */
  async send(message: MailMessage): Promise<void> {
    if (!this.config) return
    await this.getTransporter(this.config).sendMail({ from: this.config.from, ...message })
    this.logger.log(`Email sent: ${message.subject}`)
  }

  private getTransporter(config: SmtpConfig): Transporter {
    this.transporter ??= createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      name: config.heloName,
    })
    return this.transporter
  }
}

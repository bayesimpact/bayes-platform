import { Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common"
import { Client } from "pg"
import { type Observable, Subject } from "rxjs"
import { databaseSslOptions } from "@/config/database-ssl"

let dbListenersEnabled = false

export function enableDbListeners(): void {
  dbListenersEnabled = true
}

export interface PostgresStatusStreamConfig<TEventDto> {
  channel: string
  expectedType: string
  serviceName: string
  isExpectedEvent: (payload: TEventDto) => boolean
}

export abstract class PostgresStatusStreamService<TEventDto>
  implements OnModuleInit, OnModuleDestroy
{
  protected readonly logger: Logger
  private readonly eventsSubject: Subject<TEventDto>
  private readonly channel: string
  private readonly expectedType: string
  private readonly isExpectedEvent: (payload: TEventDto) => boolean
  private listenerClient: Client | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isShuttingDown = false

  constructor(config: PostgresStatusStreamConfig<TEventDto>) {
    this.logger = new Logger(config.serviceName)
    this.eventsSubject = new Subject<TEventDto>()
    this.channel = config.channel
    this.expectedType = config.expectedType
    this.isExpectedEvent = config.isExpectedEvent
  }

  get events$(): Observable<TEventDto> {
    return this.eventsSubject.asObservable()
  }

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === "test") return
    if (!dbListenersEnabled) return
    await this.connectAndListen()
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.listenerClient) {
      await this.listenerClient.end().catch(() => undefined)
      this.listenerClient = null
    }
    this.eventsSubject.complete()
  }

  private async connectAndListen(): Promise<void> {
    const databasePort = process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : undefined
    const listenerClient = new Client({
      host: process.env.DATABASE_HOST,
      port: databasePort,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      // Same TLS setting as the TypeORM data source (DATABASE_SSL).
      ...databaseSslOptions(),
    })

    listenerClient.on("notification", (notification) => {
      this.logger.debug(`Received notification: ${JSON.stringify(notification)}`)
      if (!notification.payload) return
      try {
        const parsedPayload = JSON.parse(notification.payload) as TEventDto
        if (!this.isExpectedEvent(parsedPayload)) return
        this.eventsSubject.next(parsedPayload)
      } catch (error) {
        this.logger.warn(
          `Failed to parse ${this.expectedType} event payload: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    })

    listenerClient.on("error", (error) => {
      this.logger.error(`${this.expectedType} listener error: ${error.message}`)
      this.scheduleReconnect()
    })

    listenerClient.on("end", () => {
      this.logger.warn(`${this.expectedType} listener ended`)
      this.scheduleReconnect()
    })

    try {
      await listenerClient.connect()
      await listenerClient.query(`LISTEN ${this.channel}`)
      this.listenerClient = listenerClient
      this.logger.log(`Listening for ${this.expectedType} events on ${this.channel}`)
    } catch (error) {
      this.logger.error(
        `Failed to connect ${this.expectedType} listener: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      await listenerClient.end().catch(() => undefined)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown) return
    if (this.reconnectTimeout) return
    if (this.listenerClient) {
      void this.listenerClient.end().catch(() => undefined)
      this.listenerClient = null
    }
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      void this.connectAndListen()
    }, 2000)
  }
}

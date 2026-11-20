import { createClient } from "redis";
import type { Logger } from "pino";

export type CollaborationBusEvent =
  | { type: "document-update"; sourceInstanceId: string; pageId: string; generation: number; updateId: string }
  | { type: "awareness"; sourceInstanceId: string; pageId: string; generation: number; update: string }
  | { type: "document-reset"; sourceInstanceId: string; pageId: string; generation: number };

function parseEvent(value: string): CollaborationBusEvent | null {
  try {
    const candidate = JSON.parse(value) as Partial<CollaborationBusEvent>;
    if (
      typeof candidate !== "object" || candidate === null ||
      typeof candidate.type !== "string" ||
      typeof candidate.sourceInstanceId !== "string" ||
      typeof candidate.pageId !== "string" ||
      typeof candidate.generation !== "number"
    ) return null;

    if (candidate.type === "document-update" && typeof candidate.updateId === "string") {
      return candidate as CollaborationBusEvent;
    }
    if (candidate.type === "awareness" && typeof candidate.update === "string") {
      return candidate as CollaborationBusEvent;
    }
    if (candidate.type === "document-reset") return candidate as CollaborationBusEvent;
    return null;
  } catch {
    return null;
  }
}

export class RedisCollaborationBus {
  private readonly publisher;
  private readonly subscriber;
  private readonly channel: string;
  private started = false;

  constructor(
    redisUrl: string,
    channelPrefix: string,
    private readonly instanceId: string,
    private readonly logger: Logger,
  ) {
    this.publisher = createClient({ url: redisUrl });
    this.subscriber = createClient({ url: redisUrl });
    this.channel = `${channelPrefix}:events`;
    this.publisher.on("error", (error) => this.logger.error({ error }, "Redis collaboration publisher error"));
    this.subscriber.on("error", (error) => this.logger.error({ error }, "Redis collaboration subscriber error"));
  }

  get isReady(): boolean {
    return this.publisher.isReady && this.subscriber.isReady;
  }

  async start(onEvent: (event: CollaborationBusEvent) => void | Promise<void>): Promise<void> {
    if (this.started) return;
    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
    await this.subscriber.subscribe(this.channel, (rawMessage) => {
      const event = parseEvent(rawMessage);
      if (!event || event.sourceInstanceId === this.instanceId) return;
      void Promise.resolve(onEvent(event)).catch((error: unknown) => {
        this.logger.error({ error, eventType: event.type, pageId: event.pageId }, "Redis collaboration event failed");
      });
    });
    this.started = true;
  }

  async publishDocumentUpdate(pageId: string, generation: number, updateId: bigint): Promise<void> {
    await this.publish({
      type: "document-update",
      sourceInstanceId: this.instanceId,
      pageId,
      generation,
      updateId: updateId.toString(),
    });
  }

  async publishAwareness(pageId: string, generation: number, update: Uint8Array): Promise<void> {
    await this.publish({
      type: "awareness",
      sourceInstanceId: this.instanceId,
      pageId,
      generation,
      update: Buffer.from(update).toString("base64url"),
    });
  }

  async publishDocumentReset(pageId: string, generation: number): Promise<void> {
    await this.publish({ type: "document-reset", sourceInstanceId: this.instanceId, pageId, generation });
  }

  async close(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    await this.subscriber.unsubscribe(this.channel).catch(() => undefined);
    await Promise.all([
      this.publisher.quit().catch(() => undefined),
      this.subscriber.quit().catch(() => undefined),
    ]);
  }

  private async publish(event: CollaborationBusEvent): Promise<void> {
    if (!this.publisher.isReady) {
      this.logger.warn({ eventType: event.type, pageId: event.pageId }, "Redis unavailable; PostgreSQL reconciliation will recover document updates");
      return;
    }
    await this.publisher.publish(this.channel, JSON.stringify(event));
  }
}

import { randomUUID } from "node:crypto";
import type { DataSource } from "typeorm";
import { AuditLogEntity } from "../database/entities.js";
import type { AuditLog } from "../types.js";

export interface AuditEvent {
  action: string;
  userId?: string | null;
  applicationId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class AuditService {
  constructor(private readonly dataSource: DataSource) {}

  async write(event: AuditEvent): Promise<void> {
    const log: AuditLog = {
      id: randomUUID(),
      userId: event.userId ?? null,
      applicationId: event.applicationId ?? null,
      action: event.action,
      ip: event.ip ?? null,
      metadata: event.metadata ?? null,
      createdAt: new Date(),
    };
    await this.dataSource.getRepository(AuditLogEntity).save(log);
  }
}

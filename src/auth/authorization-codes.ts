import { randomUUID } from "node:crypto";
import { IsNull, LessThan, MoreThan, type DataSource } from "typeorm";
import type { Config } from "../config.js";
import { ApplicationEntity, AuthorizationCodeEntity } from "../database/entities.js";
import { HttpError } from "../http.js";
import { AccessPolicyService } from "../permissions/service.js";
import type { Application } from "../types.js";
import type { SessionLookup } from "../sessions/service.js";
import { normalizeHostname } from "../applications/hostnames.js";
import { opaqueToken, tokenHash } from "./crypto.js";

export interface AuthorizationIssue {
  application: Application;
  callbackUrl: string;
}

export interface AuthorizationExchange {
  application: Application;
  central: SessionLookup;
  returnTo: string;
}

export class AuthorizationCodeService {
  constructor(private readonly dataSource: DataSource, private readonly config: Config) {}

  async issue(central: SessionLookup, returnTo: string): Promise<AuthorizationIssue> {
    const parsed = new URL(returnTo);
    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) {
      throw new HttpError(400, "Invalid return destination", "invalid_return_destination");
    }
    if (this.config.cookieSecure && parsed.protocol !== "https:") {
      throw new HttpError(400, "HTTPS is required", "https_required");
    }
    const application = await this.dataSource.getRepository(ApplicationEntity).findOneBy({ hostname, enabled: true });
    if (!application) throw new HttpError(403, "Application is not enabled", "application_denied");
    if (!(await new AccessPolicyService(this.dataSource).evaluate(central.user, application)).allowed) {
      throw new HttpError(403, "Access is not allowed", "permission_denied");
    }

    const repository = this.dataSource.getRepository(AuthorizationCodeEntity);
    await repository.delete({ expiresAt: LessThan(new Date()) });
    const code = opaqueToken();
    const now = new Date();
    await repository.insert({
      id: randomUUID(),
      tokenHash: tokenHash(code, this.config.sessionSecret),
      centralSessionId: central.session.id,
      applicationId: application.id,
      returnTo,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.authorizationCodeTtlMs),
      consumedAt: null,
    });

    const callback = new URL(this.config.callbackPath, parsed.origin);
    callback.searchParams.set("code", code);
    return { application, callbackUrl: callback.toString() };
  }

  async consume(code: string, callbackHostname: string): Promise<AuthorizationExchange | null> {
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(code)) return null;
    const repository = this.dataSource.getRepository(AuthorizationCodeEntity);
    const hash = tokenHash(code, this.config.sessionSecret);
    const now = new Date();
    const consumed = await repository.update(
      { tokenHash: hash, consumedAt: IsNull(), expiresAt: MoreThan(now) },
      { consumedAt: now },
    );
    if (consumed.affected !== 1) return null;

    const authorization = await repository.findOne({
      where: { tokenHash: hash },
      relations: { application: true, centralSession: { user: true } },
    });
    if (!authorization?.application || !authorization.centralSession?.user) return null;
    if (authorization.application.hostname !== callbackHostname || !authorization.application.enabled) return null;
    if (authorization.centralSession.applicationId !== null || authorization.centralSession.expiresAt.getTime() <= now.getTime()) return null;
    if (!(await new AccessPolicyService(this.dataSource).evaluate(authorization.centralSession.user, authorization.application)).allowed) return null;

    return {
      application: authorization.application,
      central: { session: authorization.centralSession, user: authorization.centralSession.user },
      returnTo: authorization.returnTo,
    };
  }

  async cleanupExpired(): Promise<void> {
    await this.dataSource.getRepository(AuthorizationCodeEntity).delete({ expiresAt: LessThan(new Date()) });
  }
}

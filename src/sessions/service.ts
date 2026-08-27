import { randomUUID } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { IsNull, LessThan, type DataSource } from "typeorm";
import type { Config } from "../config.js";
import { SessionEntity } from "../database/entities.js";
import type { Application, Session, User } from "../types.js";
import { opaqueToken, tokenHash } from "../auth/crypto.js";

export interface SessionLookup {
  session: Session;
  user: User;
}

export class SessionService {
  constructor(private readonly dataSource: DataSource, private readonly config: Config) {}

  async create(user: User, req: Request, res: Response): Promise<Session> {
    const cookieName = this.config.ssoMode === "cross-domain" ? this.config.ssoCookieName : this.config.cookieName;
    return this.createSession(user, req, res, cookieName, null, null);
  }

  async createApplication(user: User, centralSession: Session, application: Application, req: Request, res: Response): Promise<Session> {
    const current = await this.findApplication(req, application.id, true);
    if (current) await this.dataSource.getRepository(SessionEntity).delete(current.session.id);
    return this.createSession(user, req, res, this.config.applicationCookieName, application.id, centralSession.id, centralSession.expiresAt);
  }

  private async createSession(
    user: User,
    req: Request,
    res: Response,
    cookieName: string,
    applicationId: string | null,
    parentSessionId: string | null,
    maximumExpiry?: Date,
  ): Promise<Session> {
    const token = opaqueToken();
    const now = new Date();
    const expiresAt = new Date(Math.min(now.getTime() + this.config.sessionTtlMs, maximumExpiry?.getTime() ?? Number.POSITIVE_INFINITY));
    const session: Session = {
      id: randomUUID(),
      userId: user.id,
      applicationId,
      parentSessionId,
      tokenHash: tokenHash(token, this.config.sessionSecret),
      createdAt: now,
      expiresAt,
      lastSeenAt: now,
      ip: req.ip || req.socket.remoteAddress || null,
      userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
    };
    await this.dataSource.getRepository(SessionEntity).insert(session);
    res.cookie(cookieName, token, this.sessionCookieOptions(expiresAt.getTime() - now.getTime(), applicationId === null && this.config.ssoMode === "single-domain"));
    return session;
  }

  async find(req: Request, includeDisabled = false): Promise<SessionLookup | null> {
    const cookieName = this.config.ssoMode === "cross-domain" ? this.config.ssoCookieName : this.config.cookieName;
    return this.findToken(req, cookieName, null, includeDisabled);
  }

  async findApplication(req: Request, applicationId: string, includeDisabled = false): Promise<SessionLookup | null> {
    const current = await this.findToken(req, this.config.applicationCookieName, applicationId, includeDisabled);
    return current?.session.parentSessionId ? current : null;
  }

  private async findToken(req: Request, cookieName: string, applicationId: string | null, includeDisabled: boolean): Promise<SessionLookup | null> {
    const token = req.cookies?.[cookieName] as unknown;
    if (typeof token !== "string" || token.length < 32 || token.length > 256) return null;
    const repository = this.dataSource.getRepository(SessionEntity);
    const session = await repository.findOne({
      where: { tokenHash: tokenHash(token, this.config.sessionSecret), applicationId: applicationId === null ? IsNull() : applicationId },
      relations: { user: true },
      select: {
        id: true,
        userId: true,
        applicationId: true,
        parentSessionId: true,
        createdAt: true,
        expiresAt: true,
        lastSeenAt: true,
        ip: true,
        userAgent: true,
        user: {
          id: true,
          username: true,
          email: true,
          role: true,
          enabled: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    });
    if (!session?.user) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await repository.delete(session.id);
      return null;
    }
    if (!includeDisabled && !session.user.enabled) return null;
    if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
      session.lastSeenAt = new Date();
      await repository.update(session.id, { lastSeenAt: session.lastSeenAt });
    }
    return { session, user: session.user };
  }

  async revokeCurrent(req: Request): Promise<SessionLookup | null> {
    const current = await this.find(req, true);
    if (current) await this.dataSource.getRepository(SessionEntity).delete(current.session.id);
    return current;
  }

  clearCookie(res: Response): void {
    const cookieName = this.config.ssoMode === "cross-domain" ? this.config.ssoCookieName : this.config.cookieName;
    res.clearCookie(cookieName, this.sessionCookieOptions(undefined, this.config.ssoMode === "single-domain"));
  }

  async cleanupExpired(): Promise<void> {
    await this.dataSource.getRepository(SessionEntity).delete({ expiresAt: LessThan(new Date()) });
  }

  private sessionCookieOptions(maxAge?: number, legacyDomain = false): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: this.config.cookieSameSite,
      ...(legacyDomain && this.config.cookieDomain ? { domain: this.config.cookieDomain } : {}),
      path: "/",
      ...(maxAge === undefined ? {} : { maxAge }),
    };
  }
}

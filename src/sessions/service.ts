import { randomUUID } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { LessThan, type DataSource } from "typeorm";
import type { Config } from "../config.js";
import { SessionEntity } from "../database/entities.js";
import type { Session, User } from "../types.js";
import { opaqueToken, tokenHash } from "../auth/crypto.js";

export interface SessionLookup {
  session: Session;
  user: User;
}

export class SessionService {
  constructor(private readonly dataSource: DataSource, private readonly config: Config) {}

  async create(user: User, req: Request, res: Response): Promise<Session> {
    const token = opaqueToken();
    const now = new Date();
    const session: Session = {
      id: randomUUID(),
      userId: user.id,
      tokenHash: tokenHash(token, this.config.sessionSecret),
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.sessionTtlMs),
      lastSeenAt: now,
      ip: req.ip || req.socket.remoteAddress || null,
      userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
    };
    await this.dataSource.getRepository(SessionEntity).insert(session);
    res.cookie(this.config.cookieName, token, this.sessionCookieOptions(this.config.sessionTtlMs));
    return session;
  }

  async find(req: Request, includeDisabled = false): Promise<SessionLookup | null> {
    const token = req.cookies?.[this.config.cookieName] as unknown;
    if (typeof token !== "string" || token.length < 32 || token.length > 256) return null;
    const repository = this.dataSource.getRepository(SessionEntity);
    const session = await repository.findOne({
      where: { tokenHash: tokenHash(token, this.config.sessionSecret) },
      relations: { user: true },
      select: {
        id: true,
        userId: true,
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
    res.clearCookie(this.config.cookieName, this.sessionCookieOptions());
  }

  async cleanupExpired(): Promise<void> {
    await this.dataSource.getRepository(SessionEntity).delete({ expiresAt: LessThan(new Date()) });
  }

  private sessionCookieOptions(maxAge?: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: this.config.cookieSameSite,
      domain: this.config.cookieDomain,
      path: "/",
      ...(maxAge === undefined ? {} : { maxAge }),
    };
  }
}

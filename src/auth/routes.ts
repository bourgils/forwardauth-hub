import { randomUUID } from "node:crypto";
import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { DataSource } from "typeorm";
import { z } from "zod";
import type { Config } from "../config.js";
import { UserApplicationAccessEntity, UserEntity } from "../database/entities.js";
import { asyncHandler } from "../http.js";
import { AuditService } from "../audit/service.js";
import { SessionService } from "../sessions/service.js";
import { csrfProtection, issueCsrfToken } from "./csrf.js";
import { hashPassword, verifyPassword } from "./crypto.js";
import { LoginStateService } from "./login-states.js";
import { AuthorizationCodeService } from "./authorization-codes.js";

const dummyPasswordHash = "$argon2id$v=19$m=19456,t=3,p=1$4krZkKMF8kCJEI6kf3X8Zw$fJIIaG1fK6udpG4W4Sg6P+8WMPGgByqmaa6yvGtUPw0";

const credentialsSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{2,63}$/),
  password: z.string().min(1).max(1024),
  state: z.string().max(256).optional(),
});

const signupSchema = credentialsSchema.extend({
  password: z.string().min(12).max(1024),
  email: z.string().trim().toLowerCase().email().max(320).or(z.literal("")).optional(),
});

export function authRouter(dataSource: DataSource, config: Config): Router {
  const router = Router();
  const users = dataSource.getRepository(UserEntity);
  const sessions = new SessionService(dataSource, config);
  const states = new LoginStateService(dataSource, config);
  const codes = new AuthorizationCodeService(dataSource, config);
  const audit = new AuditService(dataSource);
  const csrf = csrfProtection(config);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "unknown")}:${typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "unknown"}`,
    handler: (_req, res) => res.status(429).json({ error: "rate_limited", message: "Too many authentication attempts. Try again later." }),
  });

  router.post("/login", loginLimiter, csrf, asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_credentials", message: "Invalid username or password." });
      return;
    }

    const user = await users.createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("user.username = :username", { username: parsed.data.username })
      .getOne();
    const passwordValid = await verifyPassword(user?.passwordHash ?? dummyPasswordHash, parsed.data.password);
    if (!user || !user.enabled || !passwordValid) {
      await audit.write({ action: "login_failure", userId: user?.id, ip: req.ip, metadata: { username: parsed.data.username } });
      res.status(401).json({ error: "invalid_credentials", message: "Invalid username or password." });
      return;
    }

    await sessions.revokeCurrent(req);
    const session = await sessions.create(user, req, res);
    await audit.write({ action: "login_success", userId: user.id, ip: req.ip });
    const destination = parsed.data.state ? await states.consume(parsed.data.state) : null;
    const continuation = destination && config.ssoMode === "cross-domain"
      ? await codes.issue({ session, user }, destination)
      : null;
    if (continuation) await audit.write({ action: "authorization_code_issued", userId: user.id, applicationId: continuation.application.id, ip: req.ip });
    res.json({
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      redirectTo: continuation?.callbackUrl ?? destination ?? (user.role === "admin" ? "/admin" : "/"),
    });
  }));

  router.post("/logout", csrf, asyncHandler(async (req, res) => {
    const current = await sessions.revokeCurrent(req);
    sessions.clearCookie(res);
    if (current) await audit.write({ action: "logout", userId: current.user.id, ip: req.ip });
    res.json({ loggedOut: true });
  }));

  router.post("/signup", loginLimiter, csrf, asyncHandler(async (req, res) => {
    if (!config.signupEnabled) {
      res.status(404).end();
      return;
    }
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_signup", message: "Use a valid username and a password of at least 12 characters." });
      return;
    }
    if (await users.existsBy({ username: parsed.data.username })) {
      res.status(409).json({ error: "username_exists", message: "This username is unavailable." });
      return;
    }
    const now = new Date();
    const user = {
      id: randomUUID(),
      username: parsed.data.username,
      email: parsed.data.email || null,
      passwordHash: await hashPassword(parsed.data.password),
      role: "user" as const,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    await users.insert(user);
    await audit.write({ action: "user_created", userId: user.id, ip: req.ip, metadata: { source: "signup" } });
    res.status(201).json({ created: true });
  }));

  router.get("/session", asyncHandler(async (req, res) => {
    res.set("Cache-Control", "no-store");
    const current = await sessions.find(req);
    const csrfToken = issueCsrfToken(req, res, config);
    const settings = { signupEnabled: config.signupEnabled, adminUiEnabled: config.adminUiEnabled };
    if (!current) {
      res.status(401).json({ authenticated: false, csrfToken, settings });
      return;
    }
    res.json({
      authenticated: true,
      user: {
        id: current.user.id,
        username: current.user.username,
        email: current.user.email,
        role: current.user.role,
      },
      session: { id: current.session.id, expiresAt: current.session.expiresAt },
      csrfToken,
      settings,
    });
  }));

  router.post("/continue", csrf, asyncHandler(async (req, res) => {
    const current = await sessions.find(req);
    if (!current) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const state = typeof req.body?.state === "string" ? req.body.state : "";
    const destination = state ? await states.consume(state) : null;
    const continuation = destination && config.ssoMode === "cross-domain" ? await codes.issue(current, destination) : null;
    if (continuation) await audit.write({ action: "authorization_code_issued", userId: current.user.id, applicationId: continuation.application.id, ip: req.ip });
    res.json({ redirectTo: continuation?.callbackUrl ?? destination ?? (current.user.role === "admin" ? "/admin" : "/") });
  }));

  router.get("/applications", asyncHandler(async (req, res) => {
    const current = await sessions.find(req);
    if (!current) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const access = await dataSource.getRepository(UserApplicationAccessEntity).find({
      where: { userId: current.user.id, allowed: true },
      relations: { application: true },
    });
    const items = access
      .map((entry) => entry.application)
      .filter((application) => application?.enabled)
      .map((application) => ({ id: application!.id, name: application!.name, hostname: application!.hostname }));
    res.json({ items });
  }));

  return router;
}

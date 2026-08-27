import { randomUUID } from "node:crypto";
import { Router, type RequestHandler } from "express";
import { In, type DataSource } from "typeorm";
import { z } from "zod";
import type { Config } from "../config.js";
import {
  ApplicationEntity,
  AuditLogEntity,
  SessionEntity,
  UserApplicationAccessEntity,
  UserEntity,
} from "../database/entities.js";
import { asyncHandler, HttpError, integerQuery } from "../http.js";
import { SessionService } from "../sessions/service.js";
import { AuditService } from "../audit/service.js";
import { hashPassword } from "../auth/crypto.js";
import { normalizeHostname } from "../applications/hostnames.js";
import { csrfProtection } from "../auth/csrf.js";
import type { User } from "../types.js";

const username = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{2,63}$/);
const email = z.string().trim().toLowerCase().email().max(320).or(z.literal("")).nullable().optional();
const createUserSchema = z.object({
  username,
  email,
  password: z.string().min(12).max(1024),
  role: z.enum(["admin", "user"]).default("user"),
  enabled: z.boolean().default(true),
});
const updateUserSchema = z.object({
  username: username.optional(),
  email,
  password: z.string().min(12).max(1024).optional(),
  role: z.enum(["admin", "user"]).optional(),
  enabled: z.boolean().optional(),
}).strict();
const createApplicationSchema = z.object({ name: z.string().trim().min(1).max(100), hostname: z.string().trim().max(253), enabled: z.boolean().default(true) });
const updateApplicationSchema = createApplicationSchema.partial().strict();
const accessSchema = z.object({ allowed: z.boolean() }).strict();

function publicUser(user: User): Omit<User, "passwordHash"> {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function parameter(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  throw new HttpError(400, "Invalid route parameter", "invalid_route_parameter");
}

export function adminAuth(dataSource: DataSource, config: Config): RequestHandler {
  const sessions = new SessionService(dataSource, config);
  return asyncHandler(async (req, res, next) => {
    const current = await sessions.find(req);
    if (!current) {
      if (req.originalUrl.startsWith("/api/")) res.status(401).json({ error: "unauthenticated" });
      else res.redirect(302, "/login");
      return;
    }
    if (current.user.role !== "admin") {
      res.status(403).json({ error: "admin_required" });
      return;
    }
    res.locals.current = current;
    next();
  });
}

export function adminApiRouter(dataSource: DataSource, config: Config): Router {
  const router = Router();
  const users = dataSource.getRepository(UserEntity);
  const applications = dataSource.getRepository(ApplicationEntity);
  const access = dataSource.getRepository(UserApplicationAccessEntity);
  const sessions = dataSource.getRepository(SessionEntity);
  const auditLogs = dataSource.getRepository(AuditLogEntity);
  const audit = new AuditService(dataSource);

  router.use(adminAuth(dataSource, config));
  router.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) next();
    else csrfProtection(config)(req, res, next);
  });

  router.get("/dashboard", asyncHandler(async (_req, res) => {
    const [userCount, applicationCount, sessionCount, deniedCount] = await Promise.all([
      users.count(), applications.count(), sessions.count(), auditLogs.countBy({ action: "access_denied" }),
    ]);
    res.json({ users: userCount, applications: applicationCount, sessions: sessionCount, accessDenied: deniedCount });
  }));

  router.get("/users", asyncHandler(async (req, res) => {
    const page = integerQuery(req.query.page, 1, 1, 100_000);
    const limit = integerQuery(req.query.limit, 50, 1, 100);
    const [items, total] = await users.findAndCount({ order: { username: "ASC" }, skip: (page - 1) * limit, take: limit });
    res.json({ items: items.map(publicUser), total, page, limit });
  }));

  router.post("/users", asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid user", "invalid_user");
    if (await users.existsBy({ username: parsed.data.username })) throw new HttpError(409, "Username already exists", "username_exists");
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      username: parsed.data.username,
      email: parsed.data.email || null,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      enabled: parsed.data.enabled,
      createdAt: now,
      updatedAt: now,
    };
    await users.insert(user);
    await audit.write({ action: "user_created", userId: res.locals.current.user.id, ip: req.ip, metadata: { targetUserId: user.id, username: user.username } });
    res.status(201).json(publicUser(user));
  }));

  router.get("/users/:id", asyncHandler(async (req, res) => {
    const user = await users.findOneBy({ id: parameter(req.params.id) });
    if (!user) throw new HttpError(404, "User not found", "user_not_found");
    res.json(publicUser(user));
  }));

  router.patch("/users/:id", asyncHandler(async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data).length) throw new HttpError(400, "Invalid update", "invalid_user_update");
    const user = await users.createQueryBuilder("user").addSelect("user.passwordHash").where("user.id = :id", { id: parameter(req.params.id) }).getOne();
    if (!user) throw new HttpError(404, "User not found", "user_not_found");
    const actorId = res.locals.current.user.id as string;
    if (user.id === actorId && (parsed.data.enabled === false || parsed.data.role === "user")) {
      throw new HttpError(409, "You cannot disable or demote your current account", "cannot_lock_current_admin");
    }
    if (parsed.data.username && parsed.data.username !== user.username && await users.existsBy({ username: parsed.data.username })) {
      throw new HttpError(409, "Username already exists", "username_exists");
    }
    const changes: Partial<User> = { ...parsed.data, email: parsed.data.email === "" ? null : parsed.data.email, updatedAt: new Date() };
    if (parsed.data.password) changes.passwordHash = await hashPassword(parsed.data.password);
    delete (changes as Record<string, unknown>).password;
    await users.update(user.id, changes);
    if (parsed.data.enabled === false) await sessions.delete({ userId: user.id });
    await audit.write({ action: parsed.data.enabled === false ? "user_disabled" : "user_updated", userId: actorId, ip: req.ip, metadata: { targetUserId: user.id, fields: Object.keys(parsed.data).filter((field) => field !== "password"), passwordChanged: Boolean(parsed.data.password) } });
    const updated = await users.findOneByOrFail({ id: user.id });
    res.json(publicUser(updated));
  }));

  router.delete("/users/:id", asyncHandler(async (req, res) => {
    const actorId = res.locals.current.user.id as string;
    const id = parameter(req.params.id);
    if (id === actorId) throw new HttpError(409, "You cannot delete your current account", "cannot_delete_current_admin");
    const user = await users.findOneBy({ id });
    if (!user) throw new HttpError(404, "User not found", "user_not_found");
    await users.delete(user.id);
    await audit.write({ action: "user_deleted", userId: actorId, ip: req.ip, metadata: { targetUserId: user.id, username: user.username } });
    res.status(204).end();
  }));

  router.delete("/users/:id/sessions", asyncHandler(async (req, res) => {
    const id = parameter(req.params.id);
    if (!await users.existsBy({ id })) throw new HttpError(404, "User not found", "user_not_found");
    const result = await sessions.delete({ userId: id });
    await audit.write({ action: "session_revoked", userId: res.locals.current.user.id, ip: req.ip, metadata: { targetUserId: id, count: result.affected ?? 0 } });
    res.json({ revoked: result.affected ?? 0 });
  }));

  router.get("/applications", asyncHandler(async (_req, res) => {
    res.json({ items: await applications.find({ order: { name: "ASC" } }) });
  }));

  router.post("/applications", asyncHandler(async (req, res) => {
    const parsed = createApplicationSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid application", "invalid_application");
    const hostname = normalizeHostname(parsed.data.hostname);
    if (!hostname) throw new HttpError(400, "Invalid hostname", "invalid_hostname");
    if (await applications.existsBy({ hostname })) throw new HttpError(409, "Hostname already exists", "hostname_exists");
    const now = new Date();
    const application = { id: randomUUID(), name: parsed.data.name, hostname, enabled: parsed.data.enabled, createdAt: now, updatedAt: now };
    await applications.insert(application);
    await audit.write({ action: "application_created", userId: res.locals.current.user.id, applicationId: application.id, ip: req.ip });
    res.status(201).json(application);
  }));

  router.patch("/applications/:id", asyncHandler(async (req, res) => {
    const parsed = updateApplicationSchema.safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data).length) throw new HttpError(400, "Invalid update", "invalid_application_update");
    const application = await applications.findOneBy({ id: parameter(req.params.id) });
    if (!application) throw new HttpError(404, "Application not found", "application_not_found");
    let hostname: string | undefined;
    if (parsed.data.hostname !== undefined) {
      hostname = normalizeHostname(parsed.data.hostname) ?? undefined;
      if (!hostname) throw new HttpError(400, "Invalid hostname", "invalid_hostname");
      if (hostname !== application.hostname && await applications.existsBy({ hostname })) throw new HttpError(409, "Hostname already exists", "hostname_exists");
    }
    await applications.update(application.id, { ...parsed.data, ...(hostname ? { hostname } : {}), updatedAt: new Date() });
    await audit.write({ action: "application_updated", userId: res.locals.current.user.id, applicationId: application.id, ip: req.ip, metadata: { fields: Object.keys(parsed.data) } });
    res.json(await applications.findOneByOrFail({ id: application.id }));
  }));

  router.delete("/applications/:id", asyncHandler(async (req, res) => {
    const application = await applications.findOneBy({ id: parameter(req.params.id) });
    if (!application) throw new HttpError(404, "Application not found", "application_not_found");
    await applications.delete(application.id);
    await audit.write({ action: "application_deleted", userId: res.locals.current.user.id, ip: req.ip, metadata: { applicationId: application.id, hostname: application.hostname } });
    res.status(204).end();
  }));

  router.get("/applications/:id/access", asyncHandler(async (req, res) => {
    const id = parameter(req.params.id);
    if (!await applications.existsBy({ id })) throw new HttpError(404, "Application not found", "application_not_found");
    const allUsers = await users.find({ order: { username: "ASC" } });
    const rules = allUsers.length ? await access.findBy({ applicationId: id, userId: In(allUsers.map((user) => user.id)) }) : [];
    const ruleMap = new Map(rules.map((rule) => [rule.userId, rule.allowed]));
    res.json({ items: allUsers.map((user) => ({ user: publicUser(user), allowed: ruleMap.get(user.id) === true })) });
  }));

  router.put("/applications/:id/access/:userId", asyncHandler(async (req, res) => {
    const parsed = accessSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid access rule", "invalid_access_rule");
    const applicationId = parameter(req.params.id);
    const userId = parameter(req.params.userId);
    const [applicationExists, userExists] = await Promise.all([
      applications.existsBy({ id: applicationId }), users.existsBy({ id: userId }),
    ]);
    if (!applicationExists) throw new HttpError(404, "Application not found", "application_not_found");
    if (!userExists) throw new HttpError(404, "User not found", "user_not_found");
    await access.upsert({ applicationId, userId, allowed: parsed.data.allowed }, ["userId", "applicationId"]);
    await audit.write({ action: parsed.data.allowed ? "access_granted" : "access_denied", userId: res.locals.current.user.id, applicationId, ip: req.ip, metadata: { targetUserId: userId, administrative: true } });
    res.json({ allowed: parsed.data.allowed });
  }));

  router.get("/sessions", asyncHandler(async (req, res) => {
    const page = integerQuery(req.query.page, 1, 1, 100_000);
    const limit = integerQuery(req.query.limit, 50, 1, 100);
    const [items, total] = await sessions.findAndCount({ relations: { user: true }, order: { lastSeenAt: "DESC" }, skip: (page - 1) * limit, take: limit });
    res.json({ items: items.map((session) => ({ ...session, tokenHash: undefined })), total, page, limit });
  }));

  router.delete("/sessions/:id", asyncHandler(async (req, res) => {
    const session = await sessions.findOneBy({ id: parameter(req.params.id) });
    if (!session) throw new HttpError(404, "Session not found", "session_not_found");
    await sessions.delete(session.id);
    await audit.write({ action: "session_revoked", userId: res.locals.current.user.id, ip: req.ip, metadata: { sessionId: session.id, targetUserId: session.userId } });
    res.status(204).end();
  }));

  router.get("/audit-logs", asyncHandler(async (req, res) => {
    const page = integerQuery(req.query.page, 1, 1, 100_000);
    const limit = integerQuery(req.query.limit, 50, 1, 100);
    const [items, total] = await auditLogs.findAndCount({ relations: { user: true, application: true }, order: { createdAt: "DESC" }, skip: (page - 1) * limit, take: limit });
    res.json({ items, total, page, limit });
  }));

  return router;
}

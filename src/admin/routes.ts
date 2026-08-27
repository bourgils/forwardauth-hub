import { randomUUID } from "node:crypto";
import { Router, type RequestHandler } from "express";
import { In, type DataSource } from "typeorm";
import { z } from "zod";
import type { Config } from "../config.js";
import {
  ApplicationEntity,
  AuditLogEntity,
  GroupApplicationAccessEntity,
  GroupEntity,
  SessionEntity,
  UserApplicationActivityEntity,
  UserEntity,
  UserGroupEntity,
} from "../database/entities.js";
import { asyncHandler, HttpError, integerQuery } from "../http.js";
import { SessionService } from "../sessions/service.js";
import { AuditService } from "../audit/service.js";
import { hashPassword } from "../auth/crypto.js";
import { normalizeHostname } from "../applications/hostnames.js";
import { csrfProtection } from "../auth/csrf.js";
import { isUserActive } from "../permissions/service.js";
import type { Group, User } from "../types.js";

const username = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{2,63}$/);
const email = z.string().trim().toLowerCase().email().max(320).or(z.literal("")).nullable().optional();
const date = z.string().datetime({ offset: true }).or(z.literal("")).nullable().optional();
const groupIds = z.array(z.string().uuid()).max(100);
const userFields = {
  username,
  email,
  role: z.enum(["admin", "user"]),
  enabled: z.boolean(),
  accessStartsAt: date,
  accessEndsAt: date,
  groupIds,
};
const createUserSchema = z.object({
  ...userFields,
  password: z.string().min(12).max(1024),
  role: userFields.role.default("user"),
  enabled: userFields.enabled.default(true),
  groupIds: userFields.groupIds.default([]),
}).strict();
const updateUserSchema = z.object({
  username: username.optional(),
  email,
  password: z.string().min(12).max(1024).optional(),
  role: userFields.role.optional(),
  enabled: userFields.enabled.optional(),
  accessStartsAt: date,
  accessEndsAt: date,
  groupIds: userFields.groupIds.optional(),
}).strict();
const createApplicationSchema = z.object({ name: z.string().trim().min(1).max(100), hostname: z.string().trim().max(253), enabled: z.boolean().default(true) }).strict();
const updateApplicationSchema = createApplicationSchema.partial().strict();
const createGroupSchema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).or(z.literal("")).nullable().optional(), enabled: z.boolean().default(true) }).strict();
const updateGroupSchema = createGroupSchema.partial().strict();
const membershipSchema = z.object({ member: z.boolean() }).strict();
const accessSchema = z.object({ allowed: z.boolean() }).strict();

function publicUser(user: User, memberships: string[] = []): Omit<User, "passwordHash"> & { groupIds: string[] } {
  const { passwordHash: _passwordHash, ...safe } = user;
  return { ...safe, groupIds: memberships };
}

function parameter(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  throw new HttpError(400, "Invalid route parameter", "invalid_route_parameter");
}

function optionalDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function validateAccessWindow(startsAt: Date | null, endsAt: Date | null): void {
  if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) {
    throw new HttpError(400, "Access end must be after access start", "invalid_access_window");
  }
}

async function ensureGroups(dataSource: DataSource, ids: string[]): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return;
  if (await dataSource.getRepository(GroupEntity).countBy({ id: In(uniqueIds) }) !== uniqueIds.length) {
    throw new HttpError(400, "One or more groups do not exist", "invalid_groups");
  }
}

async function membershipMap(dataSource: DataSource, userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!userIds.length) return map;
  const memberships = await dataSource.getRepository(UserGroupEntity).findBy({ userId: In(userIds) });
  for (const membership of memberships) map.set(membership.userId, [...(map.get(membership.userId) ?? []), membership.groupId]);
  return map;
}

async function groupDetails(dataSource: DataSource, groups: Group[]): Promise<Array<Group & { userIds: string[]; applicationIds: string[] }>> {
  if (!groups.length) return [];
  const ids = groups.map((group) => group.id);
  const [memberships, permissions] = await Promise.all([
    dataSource.getRepository(UserGroupEntity).findBy({ groupId: In(ids) }),
    dataSource.getRepository(GroupApplicationAccessEntity).findBy({ groupId: In(ids) }),
  ]);
  return groups.map((group) => ({
    ...group,
    userIds: memberships.filter((membership) => membership.groupId === group.id).map((membership) => membership.userId),
    applicationIds: permissions.filter((permission) => permission.groupId === group.id).map((permission) => permission.applicationId),
  }));
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
  const groups = dataSource.getRepository(GroupEntity);
  const memberships = dataSource.getRepository(UserGroupEntity);
  const permissions = dataSource.getRepository(GroupApplicationAccessEntity);
  const sessions = dataSource.getRepository(SessionEntity);
  const auditLogs = dataSource.getRepository(AuditLogEntity);
  const activity = dataSource.getRepository(UserApplicationActivityEntity);
  const audit = new AuditService(dataSource);

  router.use(adminAuth(dataSource, config));
  router.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) next();
    else csrfProtection(config)(req, res, next);
  });

  router.get("/dashboard", asyncHandler(async (_req, res) => {
    const [userCount, applicationCount, groupCount, sessionCount, deniedCount] = await Promise.all([
      users.count(), applications.count(), groups.count(), sessions.count(), auditLogs.countBy({ action: "access_denied" }),
    ]);
    res.json({ users: userCount, applications: applicationCount, groups: groupCount, sessions: sessionCount, accessDenied: deniedCount });
  }));

  router.get("/users", asyncHandler(async (req, res) => {
    const page = integerQuery(req.query.page, 1, 1, 100_000);
    const limit = integerQuery(req.query.limit, 50, 1, 100);
    const [items, total] = await users.findAndCount({ order: { username: "ASC" }, skip: (page - 1) * limit, take: limit });
    const membershipByUser = await membershipMap(dataSource, items.map((user) => user.id));
    res.json({ items: items.map((user) => publicUser(user, membershipByUser.get(user.id))), total, page, limit });
  }));

  router.post("/users", asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid user", "invalid_user");
    if (await users.existsBy({ username: parsed.data.username })) throw new HttpError(409, "Username already exists", "username_exists");
    await ensureGroups(dataSource, parsed.data.groupIds);
    const accessStartsAt = optionalDate(parsed.data.accessStartsAt);
    const accessEndsAt = optionalDate(parsed.data.accessEndsAt);
    validateAccessWindow(accessStartsAt, accessEndsAt);
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      username: parsed.data.username,
      email: parsed.data.email || null,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      enabled: parsed.data.enabled,
      accessStartsAt,
      accessEndsAt,
      createdAt: now,
      updatedAt: now,
    };
    await dataSource.transaction(async (manager) => {
      await manager.getRepository(UserEntity).insert(user);
      if (parsed.data.groupIds.length) await manager.getRepository(UserGroupEntity).insert([...new Set(parsed.data.groupIds)].map((groupId) => ({ userId: user.id, groupId })));
    });
    await audit.write({ action: "user_created", userId: res.locals.current.user.id, ip: req.ip, metadata: { targetUserId: user.id, username: user.username, groupIds: parsed.data.groupIds } });
    res.status(201).json(publicUser(user, parsed.data.groupIds));
  }));

  router.get("/users/:id", asyncHandler(async (req, res) => {
    const user = await users.findOneBy({ id: parameter(req.params.id) });
    if (!user) throw new HttpError(404, "User not found", "user_not_found");
    const userMemberships = await memberships.findBy({ userId: user.id });
    res.json(publicUser(user, userMemberships.map((membership) => membership.groupId)));
  }));

  router.patch("/users/:id", asyncHandler(async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data).length) throw new HttpError(400, "Invalid update", "invalid_user_update");
    const user = await users.createQueryBuilder("user").addSelect("user.passwordHash").where("user.id = :id", { id: parameter(req.params.id) }).getOne();
    if (!user) throw new HttpError(404, "User not found", "user_not_found");
    const actorId = res.locals.current.user.id as string;
    if (parsed.data.username && parsed.data.username !== user.username && await users.existsBy({ username: parsed.data.username })) throw new HttpError(409, "Username already exists", "username_exists");
    if (parsed.data.groupIds) await ensureGroups(dataSource, parsed.data.groupIds);

    const accessStartsAt = parsed.data.accessStartsAt === undefined ? user.accessStartsAt : optionalDate(parsed.data.accessStartsAt);
    const accessEndsAt = parsed.data.accessEndsAt === undefined ? user.accessEndsAt : optionalDate(parsed.data.accessEndsAt);
    validateAccessWindow(accessStartsAt, accessEndsAt);
    const updatedState: User = {
      ...user,
      username: parsed.data.username ?? user.username,
      email: parsed.data.email === undefined ? user.email : parsed.data.email || null,
      role: parsed.data.role ?? user.role,
      enabled: parsed.data.enabled ?? user.enabled,
      accessStartsAt,
      accessEndsAt,
      updatedAt: new Date(),
    };
    if (user.id === actorId && (updatedState.role !== "admin" || !isUserActive(updatedState) || updatedState.accessEndsAt !== null)) throw new HttpError(409, "You cannot lock your current account", "cannot_lock_current_admin");
    if (parsed.data.password) updatedState.passwordHash = await hashPassword(parsed.data.password);

    await dataSource.transaction(async (manager) => {
      await manager.getRepository(UserEntity).update(user.id, {
        username: updatedState.username,
        email: updatedState.email,
        passwordHash: updatedState.passwordHash,
        role: updatedState.role,
        enabled: updatedState.enabled,
        accessStartsAt,
        accessEndsAt,
        updatedAt: updatedState.updatedAt,
      });
      if (parsed.data.groupIds) {
        await manager.getRepository(UserGroupEntity).delete({ userId: user.id });
        const uniqueGroupIds = [...new Set(parsed.data.groupIds)];
        if (uniqueGroupIds.length) await manager.getRepository(UserGroupEntity).insert(uniqueGroupIds.map((groupId) => ({ userId: user.id, groupId })));
      }
    });
    if (!isUserActive(updatedState)) await sessions.delete({ userId: user.id });
    await audit.write({ action: isUserActive(updatedState) ? "user_updated" : "user_disabled", userId: actorId, ip: req.ip, metadata: { targetUserId: user.id, fields: Object.keys(parsed.data).filter((field) => field !== "password"), passwordChanged: Boolean(parsed.data.password) } });
    const updated = await users.findOneByOrFail({ id: user.id });
    const userMemberships = await memberships.findBy({ userId: user.id });
    res.json(publicUser(updated, userMemberships.map((membership) => membership.groupId)));
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

  router.get("/groups", asyncHandler(async (_req, res) => {
    const items = await groups.find({ order: { name: "ASC" } });
    res.json({ items: await groupDetails(dataSource, items) });
  }));

  router.post("/groups", asyncHandler(async (req, res) => {
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid group", "invalid_group");
    if (await groups.existsBy({ name: parsed.data.name })) throw new HttpError(409, "Group name already exists", "group_name_exists");
    const now = new Date();
    const group: Group = { id: randomUUID(), name: parsed.data.name, description: parsed.data.description || null, enabled: parsed.data.enabled, createdAt: now, updatedAt: now };
    await groups.insert(group);
    await audit.write({ action: "group_created", userId: res.locals.current.user.id, ip: req.ip, metadata: { groupId: group.id, name: group.name } });
    res.status(201).json({ ...group, userIds: [], applicationIds: [] });
  }));

  router.patch("/groups/:id", asyncHandler(async (req, res) => {
    const parsed = updateGroupSchema.safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data).length) throw new HttpError(400, "Invalid update", "invalid_group_update");
    const group = await groups.findOneBy({ id: parameter(req.params.id) });
    if (!group) throw new HttpError(404, "Group not found", "group_not_found");
    if (parsed.data.name && parsed.data.name !== group.name && await groups.existsBy({ name: parsed.data.name })) throw new HttpError(409, "Group name already exists", "group_name_exists");
    await groups.update(group.id, { ...parsed.data, description: parsed.data.description === "" ? null : parsed.data.description, updatedAt: new Date() });
    await audit.write({ action: "group_updated", userId: res.locals.current.user.id, ip: req.ip, metadata: { groupId: group.id, fields: Object.keys(parsed.data) } });
    const updated = await groups.findOneByOrFail({ id: group.id });
    res.json((await groupDetails(dataSource, [updated]))[0]);
  }));

  router.delete("/groups/:id", asyncHandler(async (req, res) => {
    const group = await groups.findOneBy({ id: parameter(req.params.id) });
    if (!group) throw new HttpError(404, "Group not found", "group_not_found");
    await groups.delete(group.id);
    await audit.write({ action: "group_deleted", userId: res.locals.current.user.id, ip: req.ip, metadata: { groupId: group.id, name: group.name } });
    res.status(204).end();
  }));

  router.put("/groups/:id/members/:userId", asyncHandler(async (req, res) => {
    const parsed = membershipSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid membership", "invalid_membership");
    const groupId = parameter(req.params.id);
    const userId = parameter(req.params.userId);
    const [groupExists, userExists] = await Promise.all([groups.existsBy({ id: groupId }), users.existsBy({ id: userId })]);
    if (!groupExists) throw new HttpError(404, "Group not found", "group_not_found");
    if (!userExists) throw new HttpError(404, "User not found", "user_not_found");
    if (parsed.data.member) await memberships.upsert({ groupId, userId }, ["userId", "groupId"]);
    else await memberships.delete({ groupId, userId });
    await audit.write({ action: parsed.data.member ? "group_member_added" : "group_member_removed", userId: res.locals.current.user.id, ip: req.ip, metadata: { groupId, targetUserId: userId } });
    res.json({ member: parsed.data.member });
  }));

  router.put("/groups/:id/applications/:applicationId", asyncHandler(async (req, res) => {
    const parsed = accessSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid access rule", "invalid_access_rule");
    const groupId = parameter(req.params.id);
    const applicationId = parameter(req.params.applicationId);
    const [groupExists, applicationExists] = await Promise.all([groups.existsBy({ id: groupId }), applications.existsBy({ id: applicationId })]);
    if (!groupExists) throw new HttpError(404, "Group not found", "group_not_found");
    if (!applicationExists) throw new HttpError(404, "Application not found", "application_not_found");
    if (parsed.data.allowed) await permissions.upsert({ groupId, applicationId }, ["groupId", "applicationId"]);
    else await permissions.delete({ groupId, applicationId });
    await audit.write({ action: parsed.data.allowed ? "group_access_granted" : "group_access_revoked", userId: res.locals.current.user.id, applicationId, ip: req.ip, metadata: { groupId } });
    res.json({ allowed: parsed.data.allowed });
  }));

  router.get("/applications", asyncHandler(async (_req, res) => {
    const items = await applications.find({ order: { name: "ASC" } });
    const rules = items.length ? await permissions.findBy({ applicationId: In(items.map((application) => application.id)) }) : [];
    res.json({ items: items.map((application) => ({ ...application, groupIds: rules.filter((rule) => rule.applicationId === application.id).map((rule) => rule.groupId) })) });
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
    res.status(201).json({ ...application, groupIds: [] });
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
    const updated = await applications.findOneByOrFail({ id: application.id });
    const rules = await permissions.findBy({ applicationId: application.id });
    res.json({ ...updated, groupIds: rules.map((rule) => rule.groupId) });
  }));

  router.delete("/applications/:id", asyncHandler(async (req, res) => {
    const application = await applications.findOneBy({ id: parameter(req.params.id) });
    if (!application) throw new HttpError(404, "Application not found", "application_not_found");
    await applications.delete(application.id);
    await audit.write({ action: "application_deleted", userId: res.locals.current.user.id, ip: req.ip, metadata: { applicationId: application.id, hostname: application.hostname } });
    res.status(204).end();
  }));

  router.get("/applications/:id/groups", asyncHandler(async (req, res) => {
    const applicationId = parameter(req.params.id);
    if (!await applications.existsBy({ id: applicationId })) throw new HttpError(404, "Application not found", "application_not_found");
    const allGroups = await groups.find({ order: { name: "ASC" } });
    const rules = await permissions.findBy({ applicationId });
    const allowedIds = new Set(rules.map((rule) => rule.groupId));
    res.json({ items: allGroups.map((group) => ({ group, allowed: allowedIds.has(group.id) })) });
  }));

  router.put("/applications/:id/groups/:groupId", asyncHandler(async (req, res) => {
    const parsed = accessSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid access rule", "invalid_access_rule");
    const applicationId = parameter(req.params.id);
    const groupId = parameter(req.params.groupId);
    const [applicationExists, groupExists] = await Promise.all([applications.existsBy({ id: applicationId }), groups.existsBy({ id: groupId })]);
    if (!applicationExists) throw new HttpError(404, "Application not found", "application_not_found");
    if (!groupExists) throw new HttpError(404, "Group not found", "group_not_found");
    if (parsed.data.allowed) await permissions.upsert({ applicationId, groupId }, ["groupId", "applicationId"]);
    else await permissions.delete({ applicationId, groupId });
    await audit.write({ action: parsed.data.allowed ? "group_access_granted" : "group_access_revoked", userId: res.locals.current.user.id, applicationId, ip: req.ip, metadata: { groupId } });
    res.json({ allowed: parsed.data.allowed });
  }));

  router.get("/activity", asyncHandler(async (req, res) => {
    const page = integerQuery(req.query.page, 1, 1, 100_000);
    const limit = integerQuery(req.query.limit, 50, 1, 100);
    const query = activity.createQueryBuilder("activity")
      .leftJoinAndSelect("activity.user", "user")
      .leftJoinAndSelect("activity.application", "application")
      .orderBy("activity.lastAccessAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);
    if (typeof req.query.userId === "string") query.andWhere("activity.userId = :userId", { userId: req.query.userId });
    if (typeof req.query.applicationId === "string") query.andWhere("activity.applicationId = :applicationId", { applicationId: req.query.applicationId });
    const [items, total] = await query.getManyAndCount();
    res.json({ items, total, page, limit });
  }));

  router.get("/sessions", asyncHandler(async (req, res) => {
    const page = integerQuery(req.query.page, 1, 1, 100_000);
    const limit = integerQuery(req.query.limit, 50, 1, 100);
    const [items, total] = await sessions.findAndCount({ relations: { user: true, application: true }, order: { lastSeenAt: "DESC" }, skip: (page - 1) * limit, take: limit });
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

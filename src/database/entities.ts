import { EntitySchema } from "typeorm";
import type {
  Application,
  AuditLog,
  AuthorizationCode,
  Group,
  GroupApplicationAccess,
  LoginState,
  Session,
  User,
  UserApplicationActivity,
  UserGroup,
} from "../types.js";

const timestamps = {
  createdAt: { type: Date, name: "created_at" },
  updatedAt: { type: Date, name: "updated_at" },
} as const;

export const UserEntity = new EntitySchema<User>({
  name: "User",
  tableName: "users",
  columns: {
    id: { type: String, primary: true, length: 36 },
    username: { type: String, length: 64, unique: true },
    email: { type: String, length: 320, nullable: true },
    passwordHash: { type: String, name: "password_hash", length: 255, select: false },
    role: { type: String, length: 16 },
    enabled: { type: Boolean, default: true },
    accessStartsAt: { type: Date, name: "access_starts_at", nullable: true },
    accessEndsAt: { type: Date, name: "access_ends_at", nullable: true },
    ...timestamps,
  },
});

export const ApplicationEntity = new EntitySchema<Application>({
  name: "Application",
  tableName: "applications",
  columns: {
    id: { type: String, primary: true, length: 36 },
    name: { type: String, length: 100 },
    hostname: { type: String, length: 253, unique: true },
    enabled: { type: Boolean, default: true },
    ...timestamps,
  },
});

export const GroupEntity = new EntitySchema<Group>({
  name: "Group",
  tableName: "groups",
  columns: {
    id: { type: String, primary: true, length: 36 },
    name: { type: String, length: 100, unique: true },
    description: { type: String, length: 500, nullable: true },
    enabled: { type: Boolean, default: true },
    ...timestamps,
  },
});

export const UserGroupEntity = new EntitySchema<UserGroup>({
  name: "UserGroup",
  tableName: "user_groups",
  columns: {
    userId: { type: String, name: "user_id", primary: true, length: 36 },
    groupId: { type: String, name: "group_id", primary: true, length: 36 },
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "user_id" },
      onDelete: "CASCADE",
    },
    group: {
      type: "many-to-one",
      target: "Group",
      joinColumn: { name: "group_id" },
      onDelete: "CASCADE",
    },
  },
  indices: [{ columns: ["groupId"] }],
});

export const GroupApplicationAccessEntity = new EntitySchema<GroupApplicationAccess>({
  name: "GroupApplicationAccess",
  tableName: "group_application_access",
  columns: {
    groupId: { type: String, name: "group_id", primary: true, length: 36 },
    applicationId: { type: String, name: "application_id", primary: true, length: 36 },
  },
  relations: {
    group: {
      type: "many-to-one",
      target: "Group",
      joinColumn: { name: "group_id" },
      onDelete: "CASCADE",
    },
    application: {
      type: "many-to-one",
      target: "Application",
      joinColumn: { name: "application_id" },
      onDelete: "CASCADE",
    },
  },
  indices: [{ columns: ["applicationId"] }],
});

export const UserApplicationActivityEntity = new EntitySchema<UserApplicationActivity>({
  name: "UserApplicationActivity",
  tableName: "user_application_activity",
  columns: {
    userId: { type: String, name: "user_id", primary: true, length: 36 },
    applicationId: { type: String, name: "application_id", primary: true, length: 36 },
    firstAccessAt: { type: Date, name: "first_access_at" },
    lastAccessAt: { type: Date, name: "last_access_at" },
    accessCount: { type: Number, name: "access_count", default: 0 },
    lastIp: { type: String, name: "last_ip", length: 64, nullable: true },
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "user_id" },
      onDelete: "CASCADE",
    },
    application: {
      type: "many-to-one",
      target: "Application",
      joinColumn: { name: "application_id" },
      onDelete: "CASCADE",
    },
  },
  indices: [{ columns: ["lastAccessAt"] }, { columns: ["applicationId"] }],
});

export const SessionEntity = new EntitySchema<Session>({
  name: "Session",
  tableName: "sessions",
  columns: {
    id: { type: String, primary: true, length: 36 },
    userId: { type: String, name: "user_id", length: 36 },
    applicationId: { type: String, name: "application_id", length: 36, nullable: true },
    parentSessionId: { type: String, name: "parent_session_id", length: 36, nullable: true },
    tokenHash: { type: String, name: "token_hash", length: 64, unique: true, select: false },
    createdAt: { type: Date, name: "created_at" },
    expiresAt: { type: Date, name: "expires_at" },
    lastSeenAt: { type: Date, name: "last_seen_at" },
    ip: { type: String, length: 64, nullable: true },
    userAgent: { type: String, name: "user_agent", length: 512, nullable: true },
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "user_id" },
      onDelete: "CASCADE",
    },
    application: {
      type: "many-to-one",
      target: "Application",
      joinColumn: { name: "application_id" },
      onDelete: "CASCADE",
      nullable: true,
    },
    parentSession: {
      type: "many-to-one",
      target: "Session",
      joinColumn: { name: "parent_session_id" },
      onDelete: "CASCADE",
      nullable: true,
    },
  },
  indices: [{ columns: ["userId"] }, { columns: ["applicationId"] }, { columns: ["parentSessionId"] }, { columns: ["expiresAt"] }],
});

export const AuthorizationCodeEntity = new EntitySchema<AuthorizationCode>({
  name: "AuthorizationCode",
  tableName: "authorization_codes",
  columns: {
    id: { type: String, primary: true, length: 36 },
    tokenHash: { type: String, name: "token_hash", length: 64, unique: true, select: false },
    centralSessionId: { type: String, name: "central_session_id", length: 36 },
    applicationId: { type: String, name: "application_id", length: 36 },
    returnTo: { type: String, name: "return_to", length: 2048 },
    createdAt: { type: Date, name: "created_at" },
    expiresAt: { type: Date, name: "expires_at" },
    consumedAt: { type: Date, name: "consumed_at", nullable: true },
  },
  relations: {
    centralSession: {
      type: "many-to-one",
      target: "Session",
      joinColumn: { name: "central_session_id" },
      onDelete: "CASCADE",
    },
    application: {
      type: "many-to-one",
      target: "Application",
      joinColumn: { name: "application_id" },
      onDelete: "CASCADE",
    },
  },
  indices: [{ columns: ["expiresAt"] }, { columns: ["centralSessionId"] }, { columns: ["applicationId"] }],
});

export const LoginStateEntity = new EntitySchema<LoginState>({
  name: "LoginState",
  tableName: "login_states",
  columns: {
    id: { type: String, primary: true, length: 36 },
    tokenHash: { type: String, name: "token_hash", length: 64, unique: true, select: false },
    returnTo: { type: String, name: "return_to", length: 2048 },
    createdAt: { type: Date, name: "created_at" },
    expiresAt: { type: Date, name: "expires_at" },
  },
  indices: [{ columns: ["expiresAt"] }],
});

export const AuditLogEntity = new EntitySchema<AuditLog>({
  name: "AuditLog",
  tableName: "audit_logs",
  columns: {
    id: { type: String, primary: true, length: 36 },
    userId: { type: String, name: "user_id", length: 36, nullable: true },
    action: { type: String, length: 64 },
    applicationId: { type: String, name: "application_id", length: 36, nullable: true },
    ip: { type: String, length: 64, nullable: true },
    metadata: { type: "simple-json", nullable: true },
    createdAt: { type: Date, name: "created_at" },
  },
  relations: {
    user: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "user_id" },
      onDelete: "SET NULL",
      nullable: true,
    },
    application: {
      type: "many-to-one",
      target: "Application",
      joinColumn: { name: "application_id" },
      onDelete: "SET NULL",
      nullable: true,
    },
  },
  indices: [{ columns: ["createdAt"] }, { columns: ["userId"] }, { columns: ["applicationId"] }],
});

export const entities = [
  UserEntity,
  ApplicationEntity,
  GroupEntity,
  UserGroupEntity,
  GroupApplicationAccessEntity,
  UserApplicationActivityEntity,
  SessionEntity,
  AuthorizationCodeEntity,
  LoginStateEntity,
  AuditLogEntity,
];

import { EntitySchema } from "typeorm";
import type {
  Application,
  AuditLog,
  LoginState,
  Session,
  User,
  UserApplicationAccess,
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

export const UserApplicationAccessEntity = new EntitySchema<UserApplicationAccess>({
  name: "UserApplicationAccess",
  tableName: "user_application_access",
  columns: {
    userId: { type: String, name: "user_id", primary: true, length: 36 },
    applicationId: { type: String, name: "application_id", primary: true, length: 36 },
    allowed: { type: Boolean, default: false },
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
});

export const SessionEntity = new EntitySchema<Session>({
  name: "Session",
  tableName: "sessions",
  columns: {
    id: { type: String, primary: true, length: 36 },
    userId: { type: String, name: "user_id", length: 36 },
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
  },
  indices: [{ columns: ["userId"] }, { columns: ["expiresAt"] }],
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
  UserApplicationAccessEntity,
  SessionEntity,
  LoginStateEntity,
  AuditLogEntity,
];

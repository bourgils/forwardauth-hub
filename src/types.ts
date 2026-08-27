export type UserRole = "admin" | "user";

export interface User {
  id: string;
  username: string;
  email: string | null;
  passwordHash: string;
  role: UserRole;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Application {
  id: string;
  name: string;
  hostname: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserApplicationAccess {
  userId: string;
  applicationId: string;
  allowed: boolean;
  user?: User;
  application?: Application;
}

export interface Session {
  id: string;
  userId: string;
  applicationId: string | null;
  parentSessionId: string | null;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
  ip: string | null;
  userAgent: string | null;
  user?: User;
  application?: Application | null;
  parentSession?: Session | null;
}

export interface AuthorizationCode {
  id: string;
  tokenHash: string;
  centralSessionId: string;
  applicationId: string;
  returnTo: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  centralSession?: Session;
  application?: Application;
}

export interface LoginState {
  id: string;
  tokenHash: string;
  returnTo: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  applicationId: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  user?: User | null;
  application?: Application | null;
}

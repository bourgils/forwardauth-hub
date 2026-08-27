export interface User {
  id: string;
  username: string;
  email: string | null;
  role: "admin" | "user";
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Application {
  id: string;
  name: string;
  hostname: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Session {
  id: string;
  userId: string;
  applicationId: string | null;
  parentSessionId: string | null;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
  user?: User;
  application?: Application | null;
}

export interface AuditLog {
  id: string;
  action: string;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user?: User | null;
  application?: Application | null;
}

export interface Settings {
  signupEnabled: boolean;
  adminUiEnabled: boolean;
}

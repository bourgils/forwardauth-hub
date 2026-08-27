export const adminNavigationSections = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/admin", description: "Authentication service overview", keywords: "overview home metrics" },
    ],
  },
  {
    label: "Access management",
    items: [
      { label: "Users", to: "/admin/users", description: "Manage accounts and access windows", keywords: "users accounts people" },
      { label: "Groups", to: "/admin/groups", description: "Manage memberships and assignments", keywords: "groups members assignments" },
      { label: "Applications", to: "/admin/applications", description: "Manage protected applications and permissions", keywords: "applications apps permissions" },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { label: "Activity", to: "/admin/activity", description: "Review successful application access", keywords: "activity access requests" },
      { label: "Sessions", to: "/admin/sessions", description: "Review and revoke active sessions", keywords: "sessions revoke login" },
      { label: "Audit logs", to: "/admin/audit-logs", description: "Review authentication and administration events", keywords: "audit logs events denied" },
    ],
  },
] as const;

export const adminDestinations = adminNavigationSections.flatMap((section) => section.items.map((item) => ({ ...item, section: section.label })));
